// ============================================================================
// Батч 2: обход нескольких страниц (docs/roadmap/phases.md, Ф.8).
//
// Проблема: у больших сайтов реквизиты/возврат/условия/доступность лежат НЕ на
// главной, а на отдельных страницах («Контакты», «Оферта», «Возврат»). Скан
// только главной давал ложные «не нашли».
//
// Решение: с главной собираем ссылки, эвристикой выбираем 2–3 ключевые внутренние
// страницы того же домена, заходим на них и ПЕРЕЗАПУСКАЕМ только ТЕКСТОВЫЕ
// коллекторы (imprint, consumer, accessibility-statement, language). Итог —
// объединение по OR («найдено, если найдено хоть на одной странице»).
//
// ВАЖНО: куки/трекеры/баннер/tls/network/axe тут НЕ трогаем — это про состояние
// «до согласия» на СТАРТОВОЙ странице; их место — capture.ts на главной.
// Каждая страница со своим таймаутом; всё в try/catch — обход НЕ роняет скан.
// ============================================================================
import type { BrowserContext, Page } from 'playwright';
import { collectImprint } from './evidence/imprint';
import { collectAccessibility } from './evidence/accessibility';
import { collectLanguage } from './evidence/language';
import { collectConsumer } from './evidence/consumer';
import type {
  ImprintEvidence,
  AccessibilityEvidence,
  LanguageEvidence,
  ConsumerEvidence,
  ScannedPage,
} from './types';

/** Таймаут навигации на одну внутреннюю страницу (короче главной — бережём общий бюджет). */
const SUBPAGE_GOTO_TIMEOUT_MS = 12_000;
/** Пауза после DOM: дать дорисоваться позднему контенту (реквизиты в футере и т.п.). */
const SUBPAGE_SETTLE_MS = 1_200;
/** Сколько внутренних страниц максимум обходим (сверх главной). */
export const MAX_SUBPAGES = 3;

/** Цель обхода: абсолютный URL + человекочитаемая (RU) подпись категории. */
export interface CrawlTarget {
  url: string;
  label: string;
}

/** Текстовые улики, снятые с одной внутренней страницы (частичные, любое поле — null при сбое). */
interface SubpageEvidence {
  imprint: ImprintEvidence | null;
  accessibility: AccessibilityEvidence | null;
  language: LanguageEvidence | null;
  consumer: ConsumerEvidence | null;
}

/** Категории целевых страниц: паттерн (href+текст) → подпись. Порядок = приоритет. */
interface PageCategory {
  re: RegExp;
  label: string;
}
const PAGE_CATEGORIES: PageCategory[] = [
  { re: /contact|kontakt|saziņa|sazina|контакт/i, label: 'Контакты' },
  { re: /rekviz[iī]t|imprint|impres|реквизит/i, label: 'Реквизиты' },
  { re: /return|refund|atteikum|atgrie[sš]an|garantij|возврат|гарантия/i, label: 'Возврат / гарантия' },
  { re: /terms|noteikumi|lieto[sš]anas|oferta|l[iī]gum|услови|оферта|договор/i, label: 'Условия / оферта' },
  { re: /privacy|priv[aā]tum|konfidencial|s[iī]kdatn|cookie|datu.?aizsardz|конфиденциальн|куки/i, label: 'Приватность / cookies' },
  { re: /piek[ļl]ūstam[iī]b|piekluustam|accessibility|доступност/i, label: 'Доступность' },
  { re: /about|par.?mums|uz[nņ][eē]mum|о.?нас|о.?компани/i, label: 'О компании' },
];

/** Расширения, которые нет смысла (или вредно) открывать как страницу. */
const SKIP_EXT_RE = /\.(pdf|jpe?g|png|gif|svg|webp|zip|rar|docx?|xlsx?|mp4|mp3|avi|csv)(\?|#|$)/i;

/** Приводит href к абсолютному относительно base; null при неудаче. */
function toAbsolute(href: string, base: string): string | null {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

/** Нормализует URL для дедупликации: без hash, без завершающего «/», хост в нижнем регистре. */
function normalizeForDedup(u: string): string {
  try {
    const url = new URL(u);
    url.hash = '';
    let s = url.toString();
    s = s.replace(/\/$/, '');
    return s.toLowerCase();
  } catch {
    return u.toLowerCase();
  }
}

/** Хост без ведущего «www.» (для сравнения «тот же домен»). */
function bareHost(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Из ссылок главной выбирает до `limit` ключевых внутренних страниц того же домена.
 * По одной странице на категорию (разнообразие охвата, а не 3× «Контакты»).
 */
export function pickInternalPages(
  anchors: { href: string; text: string }[],
  mainUrl: string,
  limit: number = MAX_SUBPAGES,
): CrawlTarget[] {
  const mainHost = bareHost(mainUrl);
  const seen = new Set<string>([normalizeForDedup(mainUrl)]);
  // Одна цель на категорию — Map сохраняет первую (самую приоритетную) находку.
  const byCategory = new Map<string, CrawlTarget>();

  for (const a of anchors) {
    if (byCategory.size >= limit) break;
    const href = (a.href || '').trim();
    if (!href) continue;
    // Отсекаем не-навигационные схемы сразу.
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) continue;

    const abs = toAbsolute(href, mainUrl);
    if (!abs) continue;
    if (!/^https?:/i.test(abs)) continue;
    if (bareHost(abs) !== mainHost) continue; // только тот же домен
    if (SKIP_EXT_RE.test(abs)) continue;

    const norm = normalizeForDedup(abs);
    if (seen.has(norm)) continue;

    const hay = `${abs} ${a.text || ''}`.toLowerCase();
    const category = PAGE_CATEGORIES.find((c) => c.re.test(hay));
    if (!category) continue;
    if (byCategory.has(category.label)) continue; // категория уже покрыта

    seen.add(norm);
    byCategory.set(category.label, { url: abs, label: category.label });
  }

  return Array.from(byCategory.values()).slice(0, limit);
}

/** Открывает одну внутреннюю страницу и снимает текстовые улики. НИКОГДА не кидает. */
async function scanOne(
  context: BrowserContext,
  target: CrawlTarget,
): Promise<{ ev: SubpageEvidence | null; scanned: ScannedPage }> {
  const page: Page | null = await context.newPage().catch(() => null);
  if (!page) return { ev: null, scanned: { url: target.url, label: target.label, ok: false } };

  try {
    await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: SUBPAGE_GOTO_TIMEOUT_MS });
    await page.waitForTimeout(SUBPAGE_SETTLE_MS);

    const [imprint, accessibility, language, consumer] = await Promise.all([
      collectImprint(page).catch(() => null),
      collectAccessibility(page).catch(() => null),
      collectLanguage(page).catch(() => null),
      collectConsumer(page).catch(() => null),
    ]);

    return {
      ev: { imprint, accessibility, language, consumer },
      scanned: { url: target.url, label: target.label, ok: true },
    };
  } catch {
    // Навигация упала (таймаут/бот-детекция/сеть) — честно помечаем ok:false.
    return { ev: null, scanned: { url: target.url, label: target.label, ok: false } };
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Обходит выбранные внутренние страницы ПАРАЛЛЕЛЬНО (вкладки одного контекста —
 * один процесс браузера, не плодит Chromium). Возвращает частичные улики каждой
 * страницы и журнал «что просканировали» (для честности охвата в отчёте).
 */
export async function crawlSubpages(
  context: BrowserContext,
  targets: CrawlTarget[],
): Promise<{ subpages: SubpageEvidence[]; scanned: ScannedPage[] }> {
  if (targets.length === 0) return { subpages: [], scanned: [] };
  const results = await Promise.all(targets.map((t) => scanOne(context, t)));
  const subpages: SubpageEvidence[] = [];
  const scanned: ScannedPage[] = [];
  for (const r of results) {
    if (r.ev) subpages.push(r.ev);
    scanned.push(r.scanned);
  }
  return { subpages, scanned };
}

// ---------------------------------------------------------------------------
// Слияние по OR: «найдено, если найдено хоть на одной странице».
// Базой всегда служит главная; внутренние страницы могут только ДОБАВИТЬ находку.
// ---------------------------------------------------------------------------

/** Текстовые улики, которые Батч 2 объединяет между страницами. */
export interface MergeableEvidence {
  imprint: ImprintEvidence;
  accessibility: AccessibilityEvidence;
  language: LanguageEvidence;
  consumer: ConsumerEvidence;
}

function mergeImprint(base: ImprintEvidence, subs: SubpageEvidence[]): ImprintEvidence {
  const r: ImprintEvidence = { ...base, found: [...base.found] };
  for (const s of subs) {
    const e = s.imprint;
    if (!e) continue;
    r.companyName = r.companyName || e.companyName;
    r.address = r.address || e.address;
    r.email = r.email || e.email;
    r.registrationNumber = r.registrationNumber || e.registrationNumber;
    r.vatNumber = r.vatNumber || e.vatNumber;
    for (const f of e.found) {
      if (r.found.length >= 12) break;
      if (!r.found.some((x) => x.kind === f.kind && x.sample === f.sample)) r.found.push(f);
    }
  }
  return r;
}

function mergeAccessibility(base: AccessibilityEvidence, subs: SubpageEvidence[]): AccessibilityEvidence {
  // ORим ТОЛЬКО текстовый сигнал «заявление о доступности». htmlLang/картинки/axe
  // остаются с главной (они про стартовую страницу, а не про наличие документа).
  const r: AccessibilityEvidence = { ...base };
  if (!r.statementLink) {
    for (const s of subs) {
      const e = s.accessibility;
      if (e && e.statementLink) {
        r.statementLink = true;
        r.statementHref = e.statementHref ?? r.statementHref ?? null;
        break;
      }
    }
  }
  return r;
}

function mergeLanguage(base: LanguageEvidence, subs: SubpageEvidence[]): LanguageEvidence {
  // htmlLang остаётся с главной; доступность латышского и переключатель ORим.
  const r: LanguageEvidence = { ...base };
  for (const s of subs) {
    const e = s.language;
    if (!e) continue;
    r.latvianAvailable = r.latvianAvailable || e.latvianAvailable;
    r.hasLanguageSwitcher = r.hasLanguageSwitcher || e.hasLanguageSwitcher;
  }
  return r;
}

function mergeConsumer(base: ConsumerEvidence, subs: SubpageEvidence[]): ConsumerEvidence {
  const r: ConsumerEvidence = { ...base };
  for (const s of subs) {
    const e = s.consumer;
    if (!e) continue;
    if (!r.staleOdrLink && e.staleOdrLink) {
      r.staleOdrLink = true;
      r.staleOdrHref = e.staleOdrHref ?? r.staleOdrHref ?? null;
    }
    r.returnPolicy = r.returnPolicy || e.returnPolicy;
    r.mentions14Days = r.mentions14Days || e.mentions14Days;
    r.pricesVisible = r.pricesVisible || e.pricesVisible;
    r.priceTaxWording = r.priceTaxWording || e.priceTaxWording;
  }
  return r;
}

/** Объединяет улики главной с улик внутренних страниц по OR. */
export function mergeSubpageEvidence(base: MergeableEvidence, subs: SubpageEvidence[]): MergeableEvidence {
  if (subs.length === 0) return base;
  return {
    imprint: mergeImprint(base.imprint, subs),
    accessibility: mergeAccessibility(base.accessibility, subs),
    language: mergeLanguage(base.language, subs),
    consumer: mergeConsumer(base.consumer, subs),
  };
}

/** Собирает {href,text} всех ссылок главной для выбора внутренних страниц. Пусто при сбое. */
export async function collectAnchors(page: Page): Promise<{ href: string; text: string }[]> {
  try {
    return await page.$$eval('a[href]', (els) =>
      els.slice(0, 800).map((a) => {
        const anchor = a as HTMLAnchorElement;
        return {
          href: anchor.href || anchor.getAttribute('href') || '',
          text: (anchor.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
        };
      }),
    );
  } catch {
    return [];
  }
}
