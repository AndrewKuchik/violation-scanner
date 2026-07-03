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

/** Включён ли шаринг (подключён ли Blob-стор). */
export function isShareEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
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
    const { blobs } = await list({ prefix: `${PREFIX}${id}.json`, limit: 1 });
    const blob = blobs.find((b) => b.pathname === `${PREFIX}${id}.json`);
    if (!blob) return null;
    const res = await fetch(blob.url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as Report;
  } catch {
    return null;
  }
}
