// ============================================================================
// Полный захват улик: драйвит headless chromium и собирает ScanEvidence.
//
// КРИТИЧНО (docs/modules/scanner.md): подписка на page.on('request') стоит ДО
// page.goto(), а снимок cookies/storage снимается ПОСЛЕ загрузки, но ДО любого
// взаимодействия — так мы честно ловим состояние «до согласия».
// v1 сознательно НЕ кликает по баннеру (хрупко) — фиксируем pre-interaction.
// ============================================================================
import type { Browser } from 'playwright';
import { newScanContext } from './browser';
import { collectCookies } from './evidence/cookies';
import { collectStorage } from './evidence/storage';
import { analyzeNetwork } from './evidence/network';
import { detectTrackers } from './evidence/trackers';
import { analyzeTls } from './evidence/tls';
import { collectLinks } from './evidence/links';
import { detectConsentBanner } from './evidence/consentBanner';
import type {
  ScanEvidence,
  CapturedRequest,
  ScanMeta,
  LinksEvidence,
  LinkCheck,
  ConsentBannerEvidence,
} from './types';

/** Признаки «страницу отдали не нам, а защите от ботов» (Cloudflare и т.п.). */
const BOT_WALL_RE =
  /just a moment|checking your browser|attention required|cf-browser-verification|verifying you are human|enable javascript and cookies/i;

/**
 * Открывает сайт, собирает все улики и возвращает единый ScanEvidence.
 * Каждый коллектор устойчив к ошибкам сам, но здесь всё дополнительно
 * подстраховано, чтобы скан не падал целиком из-за одной проблемы.
 */
export async function captureEvidence(browser: Browser, requestedUrl: string): Promise<ScanEvidence> {
  const context = await newScanContext(browser);
  const page = await context.newPage();
  const navStart = Date.now();

  // --- Подписка на сеть ДО goto: ловим запросы, уходящие до согласия. ---
  const requests: CapturedRequest[] = [];
  page.on('request', (req) => {
    let hostname = '';
    try {
      hostname = new URL(req.url()).hostname;
    } catch {
      /* data:/blob:/about: — без hostname */
    }
    requests.push({
      url: req.url(),
      method: req.method(),
      resourceType: req.resourceType(),
      hostname,
      timestamp: Date.now() - navStart,
    });
  });

  let title = '';
  let finalUrl = requestedUrl;
  let botBlocked = false;
  let incompleteReason: string | null = null;

  try {
    const resp = await page.goto(requestedUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    // Дать доставиться поздним трекерам/кукам (они часто ставятся после DOM).
    await page.waitForTimeout(3_000);

    title = await page.title().catch(() => '');
    finalUrl = page.url();

    // Бот-детекция: код ответа или характерный текст «стены».
    const status = resp?.status() ?? 0;
    const bodyText = await page
      .evaluate(() => document.body?.innerText?.slice(0, 4000) ?? '')
      .catch(() => '');
    if (status === 403 || status === 429 || BOT_WALL_RE.test(`${title}\n${bodyText}`)) {
      botBlocked = true;
      incompleteReason =
        'Похоже на защиту от ботов (например Cloudflare) — скан может быть неполным, не все улики удалось собрать.';
    }
  } catch (err) {
    incompleteReason =
      'Не удалось полностью загрузить страницу: ' + (err instanceof Error ? err.message : String(err));
  }

  const siteHostname = safeHostname(finalUrl) || safeHostname(requestedUrl) || '';

  // --- Коллекторы, которым нужен живой браузер (параллельно, каждый со страховкой). ---
  const [cookies, storage, links, consentBanner] = await Promise.all([
    collectCookies(context, siteHostname).catch(() => []),
    collectStorage(page).catch(() => []),
    collectLinks(page, finalUrl).catch(() => emptyLinks()),
    detectConsentBanner(page).catch(() => inconclusiveBanner()),
  ]);

  // --- Чистые коллекторы поверх пойманных запросов. ---
  const network = analyzeNetwork(requests, siteHostname);
  const trackers = detectTrackers(requests);
  const tls = analyzeTls(finalUrl, requests);

  await context.close().catch(() => {});

  const meta: ScanMeta = {
    url: requestedUrl,
    finalUrl,
    title,
    scannedAt: new Date().toISOString(),
    botBlocked,
    incompleteReason,
    durationMs: Date.now() - navStart,
  };

  return { meta, cookies, storage, network, trackers, consentBanner, links, tls };
}

function safeHostname(u: string): string {
  try {
    return new URL(u).hostname;
  } catch {
    return '';
  }
}

/** Валидный пустой LinksEvidence на случай сбоя коллектора ссылок. */
function emptyLinks(): LinksEvidence {
  const pp: LinkCheck = { kind: 'privacy-policy', found: false, href: null, reachable: null };
  return { privacyPolicy: pp, checks: [pp] };
}

/** Валидный «неубедительный» баннер на случай сбоя детектора. */
function inconclusiveBanner(): ConsentBannerEvidence {
  return {
    present: false,
    confidence: 'inconclusive',
    detail: 'Детекция баннера не выполнена из-за ошибки сбора — вывод об отсутствии баннера делать нельзя.',
  };
}
