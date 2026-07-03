// Запуск/остановка headless chromium. Держим настройки браузера в одном месте,
// чтобы уменьшить бот-детекцию и вести себя как реальный посетитель.
import { chromium, type Browser, type BrowserContext } from 'playwright';

/** UA реального Chrome — снижает шанс, что сайт отдаст «headless»-заглушку. */
const REALISTIC_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
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
