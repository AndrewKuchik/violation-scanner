// Запуск/остановка headless chromium. Держим настройки браузера в одном месте,
// чтобы уменьшить бот-детекцию и вести себя как реальный посетитель.
//
// ДВА РЕЖИМА (для деплоя на Vercel, docs/deploy-vercel.md):
//   • Локально / обычный сервер → полный пакет `playwright` со своим chromium.
//   • Serverless (Vercel/AWS Lambda) → `playwright-core` + `@sparticuz/chromium`
//     (лёгкая сборка chromium, помещается в лимиты функции).
// ВАЖНО: импорты браузерных пакетов — ДИНАМИЧЕСКИЕ (внутри функции), чтобы в облаке
// НЕ подгружался полный `playwright` (он тянет browsers.json и падает в serverless).
// Типы берём из `playwright-core` — они type-only и в рантайм не попадают.
import type { Browser, BrowserContext } from 'playwright-core';

/** UA реального Chrome — снижает шанс, что сайт отдаст «headless»-заглушку. */
const REALISTIC_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Мы в бессерверном окружении (Vercel / AWS Lambda)? Там нужен @sparticuz/chromium. */
const IS_SERVERLESS = Boolean(process.env.VERCEL) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

/** Флаги chromium для локального режима (меньше бот-детекции, стабильнее в контейнере). */
const LOCAL_ARGS = [
  '--no-sandbox',
  '--disable-blink-features=AutomationControlled',
  '--disable-dev-shm-usage',
];

export async function launchBrowser(): Promise<Browser> {
  if (IS_SERVERLESS) {
    // Динамические импорты: эти пакеты нужны ТОЛЬКО в облаке.
    const sparticuz = (await import('@sparticuz/chromium')).default;
    const { chromium } = await import('playwright-core');
    const executablePath = await sparticuz.executablePath();
    return chromium.launch({
      // sparticuz.args уже включает --no-sandbox/--disable-dev-shm-usage и оптимизации под Lambda.
      args: [...sparticuz.args, '--disable-blink-features=AutomationControlled'],
      executablePath,
      headless: true,
    });
  }

  // Локально грузим ПОЛНЫЙ playwright динамически — в облаке этот путь не выполняется,
  // поэтому его тяжёлые файлы (browsers.json и т.п.) в serverless не требуются.
  const { chromium } = await import('playwright');
  // Типы playwright и playwright-core структурно совпадают (playwright зависит от core).
  return chromium.launch({ headless: true, args: LOCAL_ARGS }) as unknown as Browser;
}

/**
 * Новый изолированный контекст под один скан.
 * ignoreHTTPSErrors=true — чтобы всё равно открыть сайт с проблемным сертификатом
 * и честно сообщить о нём, а не молча провалить скан.
 */
export async function newScanContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    userAgent: REALISTIC_UA,
    viewport: { width: 1366, height: 900 },
    locale: 'lv-LV',
    ignoreHTTPSErrors: true,
  });
}
