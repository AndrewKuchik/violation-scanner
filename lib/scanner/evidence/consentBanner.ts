// ============================================================================
// Коллектор улик: баннер согласия на куки (CMP). Самый сложный детектор.
//
// Отдаёт ConsentBannerEvidence для правил №3–6 (см. docs/modules/rules.md):
//   №3 — баннер отсутствует; №4 — асимметрия трения (accept 1 клик / reject много);
//   №5 — нет видимой кнопки отказа; №6 — предустановленные чекбоксы согласия.
//
// ПРИНЦИПЫ ЧЕСТНОСТИ (docs/product/legal-guardrails.md §6):
//   • функция НИКОГДА не кидает — всё в try/catch, при непонятной ситуации
//     возвращаем безопасный дефолт confidence:'inconclusive' + detail;
//   • present:false + 'not-found' ставим ТОЛЬКО когда реально прошли по DOM
//     (включая iframe и shadow-DOM) и ничего похожего нет;
//   • при пустом/заблокированном DOM (бот-детекция) — 'inconclusive', НЕ ложное
//     «баннера нет».
//
// v1 НЕ кликает по кнопкам — фиксируем только состояние ДО взаимодействия.
// ============================================================================
import type { Page, Frame, Locator } from 'playwright';
import type { ConsentBannerEvidence, BoundingBox } from '@/lib/scanner/types';

// ---------------------------------------------------------------------------
// Известные CMP: селекторы контейнера баннера. Глобальные объекты window.*
// проверяются отдельно (detectGlobals). Порядок = приоритет опознания вендора.
// ---------------------------------------------------------------------------
interface CmpDefinition {
  vendor: string;
  selectors: string[];
}

const KNOWN_CMPS: CmpDefinition[] = [
  { vendor: 'OneTrust', selectors: ['#onetrust-banner-sdk', '#onetrust-consent-sdk', '.onetrust-banner-sdk', '#ot-sdk-container'] },
  { vendor: 'Cookiebot', selectors: ['#CybotCookiebotDialog', '#CybotCookiebotDialogBodyContent'] },
  { vendor: 'Osano', selectors: ['.osano-cm-dialog', '.osano-cm-window'] },
  { vendor: 'Didomi', selectors: ['#didomi-host', '.didomi-popup-container', '.didomi-notice-banner'] },
  { vendor: 'Usercentrics', selectors: ['#usercentrics-root', '#usercentrics-cmp-ui', 'div[data-testid="uc-app-container"]'] },
  { vendor: 'Quantcast', selectors: ['.qc-cmp2-container', '#qc-cmp2-ui', '.qc-cmp2-summary-buttons'] },
  { vendor: 'CookieYes', selectors: ['.cky-consent-bar', '.cky-consent-container', '.cky-modal'] },
  { vendor: 'Complianz', selectors: ['#cmplz-cookiebanner-container', '.cmplz-cookiebanner'] },
  { vendor: 'TrustArc', selectors: ['#truste-consent-track', '#consent_blackbar', '.truste_box_overlay'] },
  { vendor: 'Termly', selectors: ['#termly-code-snippet-support', '.t-preference-modal', '.termly-styles-root'] },
];

// Глобальные объекты window.* → вендор CMP (TCF-интерфейс __tcfapi проверяем отдельно).
const GLOBAL_VENDOR_MAP: Record<string, string> = {
  OneTrust: 'OneTrust',
  OptanonWrapper: 'OneTrust',
  Optanon: 'OneTrust',
  Cookiebot: 'Cookiebot',
  Osano: 'Osano',
  Didomi: 'Didomi',
  __ucCmp: 'Usercentrics',
  UC_UI: 'Usercentrics',
  truste: 'TrustArc',
};

// Селектор для «дать баннеру время появиться» — известные CMP + generic-паттерны.
const KNOWN_SELECTORS: string[] = KNOWN_CMPS.reduce<string[]>((acc, c) => acc.concat(c.selectors), []);
const WAIT_SELECTOR: string = KNOWN_SELECTORS.concat([
  '[id*="cookie" i]',
  '[class*="cookie" i]',
  '[id*="consent" i]',
  '[class*="consent" i]',
  '[role="dialog"]',
  '[aria-modal="true"]',
]).join(',');

// ---------------------------------------------------------------------------
// Классификация подписей кнопок (МНОГОЯЗЫЧНО: EN / LV / RU). Подстрочный поиск —
// устойчивее к словоформам, чем \b (который в JS ненадёжен для кириллицы).
// ---------------------------------------------------------------------------
// Ссылки на политики/условия — исключаем из accept/reject, чтобы «Соглашение»
// (документ) не спутать с «Согласиться» (кнопка).
const POLICY_RE = /privacy|cookie polic|polic(y|ies)|politik|noteikum|konfidencial|terms|agreement|условия|политик|соглашение/i;
const NECESSARY_RE = /necessar|essential|strictly|required|mandator|nepiecieš|obligāt|obligat|technical|функцион|необходим|обязательн|строго/i;

const ACCEPT_TOKENS: string[] = [
  'accept', 'allow', 'agree', 'got it', 'i understand', 'understand', 'enable', 'yes', 'okay',
  'piekrīt', 'piekrit', 'atļauj', 'atlauj', 'labi',
  'принять', 'принима', 'соглас', 'разреш', 'хорошо',
];
const REJECT_TOKENS: string[] = [
  'reject', 'decline', 'deny', 'refuse', 'disagree', 'do not', 'only necessary', 'necessary only',
  'use necessary', 'essential only', 'opt out', 'opt-out',
  'noraid', 'atteik', 'nepiekrīt', 'nepiekrit',
  'откл', 'отказ', 'не прин', 'не согла', 'запрет',
];
const MANAGE_TOKENS: string[] = [
  'manage', 'setting', 'preference', 'customi', 'option', 'more info', 'learn more', 'choose',
  'configure', 'details',
  'iestatīj', 'pārvald', 'izvēl', 'uzzināt', 'vairāk',
  'настрой', 'управл', 'параметр', 'подробн', 'выбрать', 'персонализ',
];

interface ButtonClassification {
  accept: boolean;
  reject: boolean;
  manage: boolean;
}

/** Классифицируем набор видимых подписей кнопок. Reject имеет приоритет над accept
 *  (напр. «Accept only necessary» = фактический отказ от маркетинга). */
function classifyButtons(labels: string[]): ButtonClassification {
  const result: ButtonClassification = { accept: false, reject: false, manage: false };
  for (const raw of labels) {
    const l = raw.toLowerCase().replace(/\s+/g, ' ').trim();
    // Слишком длинная строка — это абзац текста, а не подпись кнопки.
    if (!l || l.length > 40) continue;
    const hit = (tokens: string[]): boolean => tokens.some((t) => l.indexOf(t) !== -1);
    const isPolicy = POLICY_RE.test(l);
    const isReject = hit(REJECT_TOKENS);
    const isAccept = !isReject && hit(ACCEPT_TOKENS);
    if (!isPolicy) {
      if (isReject) result.reject = true;
      else if (isAccept) result.accept = true;
    }
    if (hit(MANAGE_TOKENS)) result.manage = true;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Мелкие безопасные обёртки над Playwright (никогда не кидают).
// ---------------------------------------------------------------------------
async function safeVisible(loc: Locator): Promise<boolean> {
  try {
    return await loc.isVisible();
  } catch {
    return false;
  }
}

async function safeCount(loc: Locator): Promise<number> {
  try {
    return await loc.count();
  } catch {
    return 0;
  }
}

async function safeBoundingBox(loc: Locator): Promise<BoundingBox | null> {
  try {
    const b = await loc.boundingBox();
    if (!b) return null;
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  } catch {
    return null;
  }
}

/** Скриншот именно элемента баннера → base64 PNG БЕЗ префикса data:. */
async function safeScreenshot(loc: Locator): Promise<string | null> {
  try {
    const buf = await loc.screenshot({ timeout: 5_000, animations: 'disabled' });
    return buf.toString('base64');
  } catch {
    return null;
  }
}

function safeErr(err: unknown): string {
  try {
    const m = err instanceof Error ? err.message : String(err);
    return m.slice(0, 120);
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Извлечение содержимого баннера (в контексте браузера, ПРОБИВАЕМ open shadow-DOM).
// Возвращаем подписи видимых кнопок + состояние чекбоксов + факт shadow-DOM.
// ВАЖНО: внутри функции нельзя ссылаться на переменные Node и нельзя использовать
// синтаксис, который TS даунлевелит через хелперы (for..of, spread) — только
// forEach / индексные циклы / Array.from(...).some.
// ---------------------------------------------------------------------------
interface ExtractResult {
  buttons: string[];
  checkboxes: { checked: boolean; disabled: boolean; label: string }[];
  usedShadow: boolean;
}

async function extractBanner(loc: Locator): Promise<ExtractResult> {
  try {
    return await loc.evaluate((el: HTMLElement | SVGElement): ExtractResult => {
      const buttons: string[] = [];
      const checkboxes: { checked: boolean; disabled: boolean; label: string }[] = [];
      const seen = new Set<Element>();
      let usedShadow = false;

      const isVisible = (node: Element): boolean => {
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
        if (parseFloat(style.opacity || '1') === 0) return false;
        const r = node.getBoundingClientRect();
        return r.width > 1 && r.height > 1;
      };
      const labelOf = (node: Element): string => {
        const aria = node.getAttribute('aria-label') || '';
        const text = (node as HTMLElement).innerText || node.textContent || '';
        const val = (node as HTMLInputElement).value || '';
        const title = node.getAttribute('title') || '';
        return (aria || text || val || title).replace(/\s+/g, ' ').trim();
      };
      const labelForCheckbox = (node: Element, root: ParentNode): string => {
        let lbl = node.getAttribute('aria-label') || '';
        const id = node.getAttribute('id');
        if (!lbl && id) {
          const safe = window.CSS && window.CSS.escape ? window.CSS.escape(id) : id;
          const l = root.querySelector('label[for="' + safe + '"]');
          if (l) lbl = (l as HTMLElement).innerText || '';
        }
        if (!lbl) {
          const parentLabel = (node as HTMLElement).closest ? (node as HTMLElement).closest('label') : null;
          if (parentLabel) lbl = (parentLabel as HTMLElement).innerText || '';
        }
        return lbl.replace(/\s+/g, ' ').trim();
      };

      const walk = (root: Element | ShadowRoot): void => {
        const all = root.querySelectorAll('*');
        all.forEach((node) => {
          if (seen.has(node)) return;
          seen.add(node);
          const tag = node.tagName.toLowerCase();
          const role = (node.getAttribute('role') || '').toLowerCase();
          const type = (node.getAttribute('type') || '').toLowerCase();

          // «Кнопкоподобные» элементы (a включаем целиком — фильтрует классификатор).
          const buttonLike =
            tag === 'button' ||
            role === 'button' ||
            tag === 'a' ||
            tag === 'summary' ||
            (tag === 'input' && (type === 'button' || type === 'submit' || type === 'reset'));
          if (buttonLike && isVisible(node)) {
            const lbl = labelOf(node);
            if (lbl) buttons.push(lbl);
          }

          // Чекбоксы и переключатели (native + ARIA).
          const isNativeCb = tag === 'input' && type === 'checkbox';
          const isAriaCb = role === 'checkbox' || role === 'switch';
          if (isNativeCb || isAriaCb) {
            const checked = isNativeCb
              ? (node as HTMLInputElement).checked
              : node.getAttribute('aria-checked') === 'true';
            const disabled = isNativeCb
              ? (node as HTMLInputElement).disabled
              : node.getAttribute('aria-disabled') === 'true';
            checkboxes.push({ checked, disabled, label: labelForCheckbox(node, root) });
          }

          // Спускаемся в открытый shadow-root.
          const sr = node.shadowRoot;
          if (sr) {
            usedShadow = true;
            walk(sr);
          }
        });
      };

      walk(el as HTMLElement);
      if (el.getRootNode() instanceof ShadowRoot) usedShadow = true;
      return { buttons, checkboxes, usedShadow };
    });
  } catch {
    return { buttons: [], checkboxes: [], usedShadow: false };
  }
}

// ---------------------------------------------------------------------------
// Сборка итога из локатора найденного баннера (для known-CMP и generic путей).
// ---------------------------------------------------------------------------
async function buildFromLocator(loc: Locator, vendor: string, inIframe: boolean): Promise<ConsentBannerEvidence> {
  const data = await extractBanner(loc);
  const cls = classifyButtons(data.buttons);
  const preTicked = data.checkboxes.some((c) => c.checked && !c.disabled && !NECESSARY_RE.test(c.label));
  const box = await safeBoundingBox(loc);
  const shot = await safeScreenshot(loc);
  const inShadow = data.usedShadow;
  const inIframeOrShadow = inIframe || inShadow;

  // Есть ли вообще подтверждение, что это реальный видимый баннер?
  const confirmed = data.buttons.length > 0 || box !== null || shot !== null;

  const notes: string[] = [];
  if (inIframe) notes.push('баннер в iframe — детекция кнопок может быть неполной');
  else if (inShadow) notes.push('баннер использует shadow-DOM');
  if (!confirmed) notes.push('CMP-элемент найден в DOM, но видимость/содержимое не подтверждены');
  if (data.buttons.length === 0 && confirmed) notes.push('кнопки не распознаны (возможно, закрытый shadow-DOM)');
  else if (cls.accept && !cls.reject) notes.push('видимой кнопки отказа нет — вероятно, отказ спрятан за «Настройки» (асимметрия трения)');

  return {
    present: true,
    confidence: confirmed ? 'detected' : 'inconclusive',
    cmpVendor: vendor,
    hasAcceptButton: cls.accept,
    hasRejectButton: cls.reject,
    // Трение: 1 клик, если соответствующая кнопка видна на верхнем уровне баннера.
    acceptClicks: cls.accept ? 1 : null,
    // null = прямой кнопки отказа нет (спрятана за «Настройки/Manage») = асимметрия.
    rejectClicks: cls.reject ? 1 : null,
    preTickedBoxes: preTicked,
    inIframeOrShadow,
    screenshotBase64: shot,
    boundingBox: box,
    detail: notes.length ? notes.join('; ') : undefined,
  };
}

// ---------------------------------------------------------------------------
// Поиск известного CMP по селекторам в заданном фрейме (main или iframe).
// ---------------------------------------------------------------------------
interface KnownHit {
  vendor: string;
  loc: Locator;
  inIframe: boolean;
}

/** Первый селектор из списka, присутствующий в DOM (предпочитаем видимый). */
async function firstPresent(scope: Frame, selectors: string[]): Promise<{ loc: Locator; visible: boolean } | null> {
  let fallback: { loc: Locator; visible: boolean } | null = null;
  for (const sel of selectors) {
    try {
      const loc = scope.locator(sel).first();
      if ((await safeCount(loc)) === 0) continue;
      const visible = await safeVisible(loc);
      if (visible) return { loc, visible };
      if (!fallback) fallback = { loc, visible };
    } catch {
      // некорректный селектор в этом контексте — пропускаем
    }
  }
  return fallback;
}

async function searchKnown(scope: Frame, inIframe: boolean): Promise<KnownHit | null> {
  let fallback: KnownHit | null = null;
  for (const cmp of KNOWN_CMPS) {
    const m = await firstPresent(scope, cmp.selectors);
    if (m) {
      if (m.visible) return { vendor: cmp.vendor, loc: m.loc, inIframe };
      if (!fallback) fallback = { vendor: cmp.vendor, loc: m.loc, inIframe };
    }
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Generic-детекция: ищем видимый контейнер с cookie/consent-текстом И кнопками.
// Помечаем его атрибутом, чтобы затем получить Playwright-локатор для скриншота.
// ---------------------------------------------------------------------------
async function findGenericIn(scope: Frame, inIframe: boolean): Promise<ConsentBannerEvidence | null> {
  let res: { found: boolean } | null = null;
  try {
    res = await scope.evaluate((): { found: boolean } => {
      // Многоязычный текст про cookie/согласие (LV / EN / RU).
      const textRe = /cookie|cookies|куки|sīkdatn|sikdatn|sīkfail|sikfail|consent|piekrīt|piekrit|noraid|gdpr|privātum|konfidencial|согла|использ.{0,20}(cookie|куки|файл)/i;
      const buttonSel = 'button,[role="button"],a,summary,input[type="button"],input[type="submit"]';

      const isVisible = (node: Element): boolean => {
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
        if (parseFloat(style.opacity || '1') === 0) return false;
        const r = node.getBoundingClientRect();
        return r.width > 1 && r.height > 1;
      };
      const getLabel = (node: Element): string => {
        const el = node as HTMLElement;
        const aria = node.getAttribute('aria-label') || '';
        const text = el.innerText || node.textContent || '';
        const val = (node as HTMLInputElement).value || '';
        return (aria || text || val).replace(/\s+/g, ' ').trim().toLowerCase();
      };
      // Подпись кнопки РЕАЛЬНОГО действия согласия (принять/отклонить/настроить), EN/LV/RU.
      const actionRe =
        /accept|agree|allow|got it|understand|enable|okay|\byes\b|decline|reject|deny|refuse|disagree|only necessary|necessary only|opt.?out|manage|setting|preference|customi|piekr|atļauj|atlauj|noraid|atteik|nepiekr|iestat|pārvald|izvēl|прин|согла|разреш|хорошо|откл|отказ|не согл|настрой|управл/i;

      const visibleButtons = (node: Element): Element[] => {
        const list: Element[] = [];
        Array.from(node.querySelectorAll(buttonSel)).forEach((b) => {
          if (isVisible(b)) list.push(b);
        });
        // Поверхностно заглядываем в открытые shadow-root.
        node.querySelectorAll('*').forEach((h) => {
          const sr = h.shadowRoot;
          if (sr) {
            Array.from(sr.querySelectorAll(buttonSel)).forEach((b) => {
              if (isVisible(b)) list.push(b);
            });
          }
        });
        return list;
      };
      const hasVisibleButton = (node: Element): boolean => visibleButtons(node).length > 0;
      const hasActionButton = (node: Element): boolean =>
        visibleButtons(node).some((b) => actionRe.test(getLabel(b)));

      const candidates = new Set<Element>();
      document
        .querySelectorAll(
          '[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i],' +
            '[id*="gdpr" i],[class*="gdpr" i],[id*="cmp" i],[class*="cmp" i],' +
            '[id*="sikdat" i],[class*="sikdat" i],[aria-label*="cookie" i],' +
            '[role="dialog"],[role="alertdialog"],[aria-modal="true"]',
        )
        .forEach((e) => candidates.add(e));
      // Плюс любые fixed/sticky-контейнеры (баннеры почти всегда такие).
      document.querySelectorAll('div,section,aside,footer,dialog,form').forEach((e) => {
        const s = window.getComputedStyle(e);
        if (s.position === 'fixed' || s.position === 'sticky') candidates.add(e);
      });

      // Предпочитаем самый компактный контейнер, где ЕСТЬ кнопка ДЕЙСТВИЯ согласия
      // (принять/отклонить). Так фрагментированный баннер (текст и кнопки в разных
      // соседних блоках) не даёт ложное «нет кнопки отказа». Фолбэк — самый
      // компактный контейнер с любой кнопкой (на случай нестандартной вёрстки).
      let bestAction: Element | null = null;
      let bestActionArea = Infinity;
      let bestAny: Element | null = null;
      let bestAnyArea = Infinity;
      candidates.forEach((el) => {
        if (!isVisible(el)) return;
        const text = ((el as HTMLElement).innerText || '').trim();
        if (text.length < 8) return;
        if (!textRe.test(text)) return;
        if (!hasVisibleButton(el)) return;
        const r = el.getBoundingClientRect();
        const area = r.width * r.height;
        if (area < bestAnyArea) {
          bestAny = el;
          bestAnyArea = area;
        }
        if (hasActionButton(el) && area < bestActionArea) {
          bestAction = el;
          bestActionArea = area;
        }
      });

      const best = (bestAction || bestAny) as Element | null;
      if (!best) return { found: false };
      best.setAttribute('data-vs-consent-banner', '1');
      return { found: true };
    });
  } catch {
    return null;
  }

  if (!res || !res.found) return null;
  const loc = scope.locator('[data-vs-consent-banner="1"]').first();
  return await buildFromLocator(loc, 'generic', inIframe);
}

// ---------------------------------------------------------------------------
// Проверки на уровне страницы (глобальные объекты, признаки блокировки).
// ---------------------------------------------------------------------------
async function detectGlobals(page: Page): Promise<{ vendor: string | null; hasTcf: boolean }> {
  try {
    return await page.evaluate((map: Record<string, string>): { vendor: string | null; hasTcf: boolean } => {
      const w = window as unknown as Record<string, unknown>;
      let vendor: string | null = null;
      const keys = Object.keys(map);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (typeof w[k] !== 'undefined' && w[k] !== null) {
          vendor = map[k];
          break;
        }
      }
      const hasTcf =
        typeof w['__tcfapi'] === 'function' || typeof w['__cmp'] === 'function' || typeof w['__tcfapi'] !== 'undefined';
      return { vendor, hasTcf };
    }, GLOBAL_VENDOR_MAP);
  } catch {
    return { vendor: null, hasTcf: false };
  }
}

async function domStats(page: Page): Promise<{ elementCount: number; likelyBlocked: boolean }> {
  try {
    return await page.evaluate((): { elementCount: number; likelyBlocked: boolean } => {
      const elementCount = document.querySelectorAll('*').length;
      const body = document.body ? document.body.innerText || '' : '';
      const hay = (body + ' ' + (document.title || '')).toLowerCase();
      const markers = [
        'just a moment',
        'checking your browser',
        'attention required',
        'verify you are human',
        'enable javascript and cookies',
        'ddos protection by',
        'cf-chl',
        'access denied',
      ];
      let blocked = elementCount < 15;
      for (let i = 0; i < markers.length; i++) {
        if (hay.indexOf(markers[i]) !== -1) {
          blocked = true;
          break;
        }
      }
      return { elementCount, likelyBlocked: blocked };
    });
  } catch {
    // Не смогли даже посчитать DOM — считаем ситуацию неубедительной.
    return { elementCount: 0, likelyBlocked: true };
  }
}

/** Дать асинхронным CMP время появиться. Не дождались — это нормально, идём дальше. */
async function settle(page: Page): Promise<void> {
  try {
    await page.waitForSelector(WAIT_SELECTOR, { state: 'visible', timeout: 4_000 });
  } catch {
    // баннер мог не появиться (его нет либо он в iframe/shadow) — не ошибка
  }
}

// ---------------------------------------------------------------------------
// Публичная точка входа.
// ---------------------------------------------------------------------------
export async function detectConsentBanner(page: Page): Promise<ConsentBannerEvidence> {
  try {
    // 0. Дать баннеру отрисоваться.
    await settle(page);

    const main = page.mainFrame();
    const frames = page.frames();
    const childFrames = frames.filter((f) => f !== main);

    // 1. Глобальные объекты известных CMP (window.OneTrust и т.п.).
    const globals = await detectGlobals(page);

    // 2. Известный CMP по селекторам — сначала на главной странице.
    let hit = await searchKnown(main, false);
    // 2b. Затем в дочерних iframe (эквивалент page.frameLocator()).
    if (!hit) {
      for (const fr of childFrames) {
        try {
          hit = await searchKnown(fr, true);
        } catch {
          hit = null;
        }
        if (hit) break;
      }
    }
    if (hit) {
      const vendor = hit.vendor || globals.vendor || 'generic';
      return await buildFromLocator(hit.loc, vendor, hit.inIframe);
    }

    // 3. Generic-детекция на главной странице.
    const genMain = await findGenericIn(main, false);
    if (genMain) return genMain;

    // 4. Generic-детекция внутри iframe.
    for (const fr of childFrames) {
      try {
        const g = await findGenericIn(fr, true);
        if (g) return g;
      } catch {
        // сбойный/кросс-доменный фрейм — пропускаем
      }
    }

    // 5. CMP опознан только по глобальному объекту, но видимый баннер не локализован.
    if (globals.vendor) {
      return {
        present: true,
        confidence: 'inconclusive',
        cmpVendor: globals.vendor,
        inIframeOrShadow: false,
        screenshotBase64: null,
        boundingBox: null,
        detail:
          'CMP «' +
          globals.vendor +
          '» обнаружен по глобальному объекту, но видимый баннер не локализован (отложенная отрисовка или регион вне области действия).',
      };
    }

    // 6. Ничего не нашли — различаем «баннера нет» и «страница не отрендерилась».
    const stats = await domStats(page);
    if (stats.likelyBlocked) {
      return {
        present: false,
        confidence: 'inconclusive',
        cmpVendor: null,
        inIframeOrShadow: false,
        screenshotBase64: null,
        boundingBox: null,
        detail: globals.hasTcf
          ? 'Найден TCF-интерфейс (__tcfapi), но баннер не отрисован; очень мало DOM — возможна бот-блокировка. Скан баннера может быть неполным.'
          : 'Очень мало DOM или признаки защиты от ботов — страница могла не отрендериться. Скан баннера может быть неполным (не утверждаем, что баннера нет).',
      };
    }

    // Реально прошли по DOM (включая iframe/shadow) — баннера нет.
    return {
      present: false,
      confidence: 'not-found',
      cmpVendor: null,
      hasAcceptButton: false,
      hasRejectButton: false,
      acceptClicks: null,
      rejectClicks: null,
      preTickedBoxes: false,
      inIframeOrShadow: false,
      screenshotBase64: null,
      boundingBox: null,
      detail: 'Прошли по DOM (включая iframe и shadow-DOM), элементов баннера согласия не найдено.',
    };
  } catch (err) {
    // Абсолютный предохранитель: функция не имеет права кидать.
    return {
      present: false,
      confidence: 'inconclusive',
      cmpVendor: null,
      inIframeOrShadow: false,
      screenshotBase64: null,
      boundingBox: null,
      detail: 'Внутренняя ошибка детекции баннера — результат неубедителен. ' + safeErr(err),
    };
  }
}
