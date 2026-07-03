// ============================================================================
// Коллектор улик: ссылки на политики (питает правило №7 «нет политики»).
//
// Собирает все <a href> со страницы и по многоязычным паттернам (LV/EN/RU)
// определяет наличие ссылки на Политику конфиденциальности и Cookie-политику.
// БЕЗ HTTP-проверки доступности (reachable = null) — быстро и без побочных
// эффектов. Всё обёрнуто в try/catch, чтобы сбор ссылок не ронял скан.
// ============================================================================
import type { Page } from 'playwright';
import type { LinksEvidence, LinkCheck } from '@/lib/scanner/types';

/**
 * Паттерны Политики конфиденциальности (в нижнем регистре) — ищем по href И тексту.
 * LV: privatums/privātums, konfidencialitāte, datu aizsardzība; EN: privacy;
 * RU: политика конфиденциальности.
 */
const PRIVACY_PATTERNS: readonly string[] = [
  'privacy',
  'privatums',
  'privātums',
  'konfidencial',
  'konfidencialitāte',
  'datu-aizsardziba',
  'datu aizsardzība',
  'политика конфиденциальности',
  'конфиденциальн',
];

/**
 * Паттерны Cookie-политики (в нижнем регистре) — ищем по href И тексту.
 * LV: sikdatnes/sīkdatnes, sikfaili; EN: cookie(s); RU: куки.
 */
const COOKIE_PATTERNS: readonly string[] = [
  'cookie',
  'sikdatnes',
  'sīkdatnes',
  'sikfaili',
  'куки',
  'cookies-policy',
  'cookie-policy',
];

/** Приводит href (с попыткой раскодировать %-энкодинг) и текст к одной строке-стогу. */
function buildHaystack(href: string, text: string): string {
  let decodedHref = href;
  try {
    decodedHref = decodeURIComponent(href);
  } catch {
    // Некорректный %-энкодинг — оставляем href как есть.
  }
  return `${href} ${decodedHref} ${text}`.toLowerCase();
}

/** Встречается ли хоть один паттерн в строке. */
function matchesAny(haystack: string, patterns: readonly string[]): boolean {
  return patterns.some((p) => haystack.includes(p));
}

/** Приводит href к абсолютному (относительные — через baseUrl); при ошибке — как есть. */
function resolveHref(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

/**
 * Собирает ссылки страницы и определяет Privacy Policy / Cookie Policy.
 * privacyPolicy — обязательное поле (found: false, если не нашли); cookiePolicy —
 * заполняется, когда проверка выполнена; checks — журнал выполненных проверок.
 */
export async function collectLinks(page: Page, baseUrl: string): Promise<LinksEvidence> {
  const privacy: LinkCheck = { kind: 'privacy-policy', found: false, href: null, reachable: null };
  const cookie: LinkCheck = { kind: 'cookie-policy', found: false, href: null, reachable: null };

  try {
    // href берём как DOM-свойство (уже абсолютное), плюс текст ссылки.
    const anchors = await page.$$eval('a[href]', (els) =>
      els.map((a) => {
        const anchor = a as HTMLAnchorElement;
        return {
          href: anchor.href || anchor.getAttribute('href') || '',
          text: (anchor.textContent || '').trim(),
        };
      }),
    );

    for (const a of anchors) {
      const haystack = buildHaystack(a.href, a.text);

      if (!privacy.found && matchesAny(haystack, PRIVACY_PATTERNS)) {
        privacy.found = true;
        privacy.href = resolveHref(a.href, baseUrl);
      }
      if (!cookie.found && matchesAny(haystack, COOKIE_PATTERNS)) {
        cookie.found = true;
        cookie.href = resolveHref(a.href, baseUrl);
      }
      if (privacy.found && cookie.found) break;
    }
  } catch {
    // Любая ошибка (страница закрылась, DOM недоступен) не должна ронять скан:
    // отдаём privacy = не найдено и пустую cookie-проверку.
    const fallback: LinkCheck = { kind: 'privacy-policy', found: false, href: null, reachable: null };
    return { privacyPolicy: fallback, checks: [fallback] };
  }

  return {
    privacyPolicy: privacy,
    cookiePolicy: cookie,
    checks: [privacy, cookie],
  };
}
