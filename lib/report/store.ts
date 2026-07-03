// ============================================================================
// Сохранение/чтение отчёта для функции «Поделиться» (публичная ссылка на отчёт).
//
// Хранилище — Vercel Blob (публичный JSON-файл на каждый отчёт). Авторизация в
// среде Vercel идёт автоматически по BLOB_STORE_ID (в новой версии Blob отдельный
// BLOB_READ_WRITE_TOKEN не обязателен; если он есть — используем его явно).
// Если Blob не подключён (локально) — шаринг просто выключен, а сайт продолжает
// работать по-старому (отчёт через sessionStorage). Все функции НИКОГДА не кидают:
// при сбое возвращают null, чтобы скан из-за шаринга не падал.
// ============================================================================
import { put, list } from '@vercel/blob';
import type { Report } from '@/lib/scanner/types';

/**
 * Токен доступа к Blob, если он задан. Обычно BLOB_READ_WRITE_TOKEN, но Vercel
 * может назвать его <ИМЯ_СТОРА>_READ_WRITE_TOKEN — берём первый подходящий ключ.
 * Может отсутствовать: в новом Blob авторизация идёт по BLOB_STORE_ID автоматически.
 */
function resolveBlobToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const key = Object.keys(process.env).find((k) => /READ_WRITE_TOKEN$/i.test(k));
  return key ? process.env[key] : undefined;
}

/** Опции авторизации Blob: явный токен, если он есть; иначе — авто-авторизация SDK. */
function tokenOpts(): { token?: string } {
  const token = resolveBlobToken();
  return token ? { token } : {};
}

/** Включён ли шаринг (подключён ли Blob-стор): есть токен ИЛИ store id. */
export function isShareEnabled(): boolean {
  return Boolean(resolveBlobToken() || process.env.BLOB_STORE_ID);
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
  if (!isShareEnabled()) return null;
  try {
    const id = newId();
    await put(`${PREFIX}${id}.json`, JSON.stringify(report), {
      access: 'public',
      addRandomSuffix: false, // предсказуемый путь reports/<id>.json
      contentType: 'application/json',
      ...tokenOpts(),
    });
    return id;
  } catch {
    return null;
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
