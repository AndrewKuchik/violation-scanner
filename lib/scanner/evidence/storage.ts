// ============================================================================
// Коллектор ключей localStorage / sessionStorage (снимок ДО согласия).
// Только имена ключей — значения в отчёт не тянем. Источник типов —
// @/lib/scanner/types (контракт не переопределяем).
// ============================================================================
import type { Page } from 'playwright';
import type { StorageRecord } from '@/lib/scanner/types';

export async function collectStorage(page: Page): Promise<StorageRecord[]> {
  try {
    // Весь доступ к storage — внутри браузера. На некоторых origin
    // (sandbox / opaque) даже чтение localStorage кидает SecurityError,
    // поэтому внешний try/catch обязателен: при любой ошибке возвращаем [].
    return await page.evaluate(() => {
      const out: { key: string; scope: 'local' | 'session' }[] = [];
      for (const key of Object.keys(window.localStorage)) {
        out.push({ key, scope: 'local' });
      }
      for (const key of Object.keys(window.sessionStorage)) {
        out.push({ key, scope: 'session' });
      }
      return out;
    });
  } catch {
    return [];
  }
}
