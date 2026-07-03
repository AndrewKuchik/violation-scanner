// ============================================================================
// Сохранение/чтение отчёта для функции «Поделиться» (публичная ссылка на отчёт).
//
// Хранилище — Vercel Blob (публичный JSON-файл на каждый отчёт). Работает ТОЛЬКО
// если подключён Blob-стор (тогда Vercel сам кладёт в env BLOB_READ_WRITE_TOKEN).
// Если токена нет (локально или Blob не настроен) — шаринг просто выключен, а сайт
// продолжает работать по-старому (отчёт через sessionStorage). Все функции
// НИКОГДА не кидают: при сбое возвращают null, чтобы скан из-за шаринга не падал.
// ============================================================================
import { put, list } from '@vercel/blob';
import type { Report } from '@/lib/scanner/types';

/**
 * Токен доступа к Blob. Обычно это BLOB_READ_WRITE_TOKEN, но при нескольких
 * сторах / особом имени Vercel кладёт его как <ИМЯ_СТОРА>_READ_WRITE_TOKEN.
 * Поэтому берём первый подходящий ключ окружения.
 */
export function resolveBlobToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const key = Object.keys(process.env).find((k) => /READ_WRITE_TOKEN$/i.test(k));
  return key ? process.env[key] : undefined;
}

/** Имена ключей окружения, похожих на токен Blob (только имена, без значений). */
export function blobTokenKeyNames(): string[] {
  return Object.keys(process.env).filter((k) => /BLOB|READ_WRITE_TOKEN$/i.test(k));
}

/**
 * Включён ли шаринг. В новой версии Vercel Blob токена может не быть — авторизация
 * идёт по BLOB_STORE_ID автоматически в среде Vercel. Поэтому включаем, если есть
 * либо токен, либо store id.
 */
export function isShareEnabled(): boolean {
  return Boolean(resolveBlobToken() || process.env.BLOB_STORE_ID);
}

/** Опции авторизации Blob: явный токен, если он есть; иначе — авто-авторизация SDK. */
function tokenOpts(): { token?: string } {
  const token = resolveBlobToken();
  return token ? { token } : {};
}

/** Папка в Blob, где лежат отчёты. */
const PREFIX = 'reports/';

/** Разрешённый вид id — защита от подстановки чужого пути в prefix. */
const ID_RE = /^[A-Za-z0-9_-]{6,40}$/;

/** Короткий случайный id для ссылки (без дефисов UUID, ~12 символов). */
function newId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

/**
 * Сохраняет отчёт в Blob и возвращает его id (для ссылки /report/<id>).
 * Если шаринг выключен или произошёл сбой — возвращает null (не кидает).
 */
export async function saveReport(report: Report): Promise<string | null> {
  return (await saveReportDebug(report)).id;
}

/**
 * Как saveReport, но возвращает причину сбоя — для временной диагностики на боевом
 * (подключён ли токен и, если запись упала, текст ошибки).
 */
export async function saveReportDebug(
  report: Report,
): Promise<{ id: string | null; enabled: boolean; error: string | null }> {
  if (!isShareEnabled()) return { id: null, enabled: false, error: null };
  try {
    const id = newId();
    await put(`${PREFIX}${id}.json`, JSON.stringify(report), {
      access: 'public',
      addRandomSuffix: false, // предсказуемый путь reports/<id>.json
      contentType: 'application/json',
      ...tokenOpts(),
    });
    return { id, enabled: true, error: null };
  } catch (e) {
    return { id: null, enabled: true, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Читает отчёт по id из Blob. Возвращает null, если id некорректен, отчёт не
 * найден или произошёл сбой (страница покажет дружелюбную заглушку).
 */
export async function loadReport(id: string): Promise<Report | null> {
  if (!ID_RE.test(id)) return null;
  try {
    // Находим публичный URL блоба по его пути (базовый адрес стора не хардкодим).
    const { blobs } = await list({ prefix: `${PREFIX}${id}.json`, limit: 1, ...tokenOpts() });
    const blob = blobs.find((b) => b.pathname === `${PREFIX}${id}.json`);
    if (!blob) return null;
    const res = await fetch(blob.url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as Report;
  } catch {
    return null;
  }
}
