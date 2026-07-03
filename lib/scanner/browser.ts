// Запуск/остановка headless chromium. Держим настройки браузера в одном месте,
// чтобы уменьшить бот-детекцию и вести себя как реальный посетитель.
//
// ДВА РЕЖИМА (для деплоя на Vercel, docs/roadmap/phases.md):
//   • Локально / обычный сервер → полный пакет `playwright` со своим chromium.
//   • Serverless (Vercel/AWS Lambda) → `playwright-core` + `@sparticuz/chromium`
//     (специальная лёгкая сборка chromium, которая помещается в лимиты функции).
// Определяем окружение по env; облачные пакеты грузим ДИНАМИЧЕСКИ, чтобы локальная
// разработка от них не зависела.
import { chromium as playwrightChromium, type Browser, type BrowserContext } from 'playwright';

/** UA реального Chrome — снижает шанс, что сайт отдаст «headless»-заглушку. */
const REALISTIC_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Мы в бессерверном окружении (Vercel / AWS Lambda)? Там нужен @sparticuz/chromium. */
const IS_SERVERLESS = Boolean(process.env.VERCEL) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

/** Флаги chromium, общие для обоих режимов (меньше бот-детекции, стабильнее в контейнере). */
const COMMON_ARGS = [
  '--no-sandbox',
  '--disable-blink-features=AutomationControlled',
  '--disable-dev-shm-usage',
];

export async function launchBrowser(): Promise<Browser> {
  if (IS_SERVERLESS) {
    // Динамический импорт: эти пакеты нужны ТОЛЬКО в облаке, локально их не тянем.
    const sparticuz = (await import('@sparticuz/chromium')).default;
    const { chromium: core } = await import('playwright-core');
    const executablePath = await sparticuz.executablePath();
    const browser = await core.launch({
      // sparticuz.args уже включает --no-sandbox/--disable-dev-shm-usage и оптимизации под Lambda.
      args: [...sparticuz.args, '--disable-blink-features=AutomationControlled'],
      executablePath,
      headless: true,
    });
    // Типы playwright и playwright-core структурно совпадают (playwright зависит от core).
    return browser as unknown as Browser;
  }

  return playwrightChromium.launch({
    headless: true,
    args: COMMON_ARGS,
  });
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
