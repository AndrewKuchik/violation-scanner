// ============================================================================
// Коллектор cookie ДО согласия. Снимает cookies из контекста Playwright,
// помечает first-/third-party и грубо категоризирует по известным именам/доменам.
// Источник типов — @/lib/scanner/types (контракт не переопределяем).
// ============================================================================
import type { BrowserContext } from 'playwright';
import type { CookieRecord } from '@/lib/scanner/types';

/** Значение куки не нужно целиком — усекаем ради приватности отчёта. */
const MAX_VALUE_LEN = 40;

// ---------------------------------------------------------------------------
// eTLD+1 (регистрируемый домен) — грубое приближение без внешних пакетов.
// Задача не «идеальный Public Suffix List», а чтобы www.delfi.lv и ads.delfi.lv
// считались одним сайтом. Для известных двухуровневых суффиксов (co.uk, com.lv…)
// берём три последние метки, иначе — две.
// ---------------------------------------------------------------------------
const TWO_LEVEL_SUFFIXES = new Set<string>([
  // Великобритания
  'co.uk', 'org.uk', 'gov.uk', 'ac.uk', 'me.uk', 'net.uk', 'ltd.uk', 'plc.uk',
  // Латвия и соседи по ЕС (фокус продукта)
  'com.lv', 'org.lv', 'net.lv', 'id.lv', 'edu.lv', 'gov.lv',
  'com.ua', 'com.pl', 'com.ro', 'com.gr', 'com.cy', 'com.es', 'com.pt',
  // Крупные международные
  'com.au', 'net.au', 'org.au', 'co.jp', 'co.nz', 'co.in', 'co.kr', 'co.za',
  'com.br', 'com.mx', 'com.tr', 'com.cn', 'com.hk', 'com.sg', 'com.tw',
]);

function registrableDomain(hostname: string): string {
  const host = (hostname || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '') // хвостовая точка FQDN
    .replace(/^\./, ''); // ведущая точка cookie-домена (.delfi.lv)
  if (!host) return '';
  // IPv4 сравниваем как есть.
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return host;
  const labels = host.split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  const lastTwo = labels.slice(-2).join('.');
  if (TWO_LEVEL_SUFFIXES.has(lastTwo)) return labels.slice(-3).join('.');
  return lastTwo;
}

// ---------------------------------------------------------------------------
// Категоризация по известным именам и доменам.
// ---------------------------------------------------------------------------
type CookieCategory = NonNullable<CookieRecord['category']>;

/** Домены, которые ставят аналитические куки. */
const ANALYTICS_DOMAINS = [
  'google-analytics.com',
  'analytics.google.com',
  'hotjar.com',
  'matomo',
  'mixpanel.com',
  'segment.io',
  'segment.com',
  'amplitude.com',
  'clarity.ms',
];

/** Рекламные / маркетинговые домены. */
const MARKETING_DOMAINS = [
  'doubleclick.net',
  'facebook.com',
  'facebook.net',
  'fbcdn.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adservice.google',
  'ads-twitter.com',
  'ads.linkedin.com',
  'criteo.com',
  'taboola.com',
  'outbrain.com',
  'adnxs.com',
  'pubmatic.com',
  'rubiconproject.com',
  'bing.com',
  'yandex',
];

function categorize(name: string, domain: string): CookieCategory {
  const n = name.toLowerCase();
  const d = domain.toLowerCase().replace(/^\./, '');

  // 1) Строго необходимые: сессия, CSRF, анти-бот Cloudflare.
  if (
    n === '__cf_bm' ||
    n === 'cf_clearance' ||
    n.includes('csrf') ||
    n.includes('xsrf') ||
    n.includes('session') ||
    n.startsWith('sess') ||
    n === 'phpsessid' ||
    n === 'jsessionid'
  ) {
    return 'necessary';
  }

  // 2) Маркетинг / реклама: пиксели, ретаргетинг, конверсии.
  if (
    n === '_fbp' ||
    n === '_fbc' ||
    n === 'fr' ||
    n === 'ide' ||
    n === 'test_cookie' || // DoubleClick
    n === 'anid' ||
    n === 'muid' ||
    n === 'muidb' || // Microsoft Ads
    n === 'personalization_id' || // X / Twitter
    n.startsWith('_gcl') || // Google Ads linker (_gcl_au, _gcl_aw…)
    n.startsWith('_uet') || // Bing UET
    MARKETING_DOMAINS.some((m) => d.includes(m))
  ) {
    return 'marketing';
  }

  // 3) Аналитика: семейство Google Analytics и известные счётчики.
  if (
    n === '_ga' ||
    n.startsWith('_ga_') || // GA4 (_ga_XXXXXXX)
    n === '_gid' ||
    n === '_gat' ||
    n.startsWith('_gat_') ||
    n.startsWith('_dc_gtm') ||
    n.startsWith('_hj') || // Hotjar
    n.startsWith('_pk_') || // Matomo / Piwik
    n.includes('analytics') ||
    ANALYTICS_DOMAINS.some((a) => d.includes(a))
  ) {
    return 'analytics';
  }

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Публичная сигнатура (вызывается из capture.ts) — менять нельзя.
// ---------------------------------------------------------------------------
export async function collectCookies(
  context: BrowserContext,
  siteHostname: string,
): Promise<CookieRecord[]> {
  try {
    const raw = await context.cookies();
    const siteDomain = registrableDomain(siteHostname);

    return raw.map((c) => {
      const record: CookieRecord = {
        name: c.name,
        domain: c.domain,
        firstParty: registrableDomain(c.domain) === siteDomain,
        category: categorize(c.name, c.domain),
      };
      // Необязательные поля добавляем только когда они реально есть.
      if (typeof c.path === 'string' && c.path) record.path = c.path;
      if (typeof c.expires === 'number') record.expires = c.expires;
      if (typeof c.httpOnly === 'boolean') record.httpOnly = c.httpOnly;
      if (typeof c.secure === 'boolean') record.secure = c.secure;
      if (typeof c.sameSite === 'string') record.sameSite = c.sameSite;
      const value = (c.value ?? '').slice(0, MAX_VALUE_LEN);
      if (value) record.value = value;
      return record;
    });
  } catch {
    // Доступ к cookies — работа с браузером; при сбое честно возвращаем пусто.
    return [];
  }
}
