// ============================================================================
// HTTPS и mixed content по финальному URL и логу запросов. Чистая функция —
// без браузера. Источник типов — @/lib/scanner/types (не переопределяем).
// ============================================================================
import type { CapturedRequest, TlsEvidence } from '@/lib/scanner/types';

/** Локальные адреса — не считаем их «небезопасным подресурсом». */
function isLoopbackHttp(rawUrl: string): boolean {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '[::1]' ||
      /^127\./.test(host)
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Публичная сигнатура (вызывается из capture.ts) — менять нельзя.
// ---------------------------------------------------------------------------
export function analyzeTls(
  finalUrl: string,
  requests: CapturedRequest[],
): TlsEvidence {
  const https = (finalUrl || '').trim().toLowerCase().startsWith('https://');

  // Небезопасные (http://) подресурсы, кроме локальных адресов.
  const insecure = requests
    .map((r) => r.url || '')
    .filter((u) => /^http:\/\//i.test(u) && !isLoopbackHttp(u));

  // «Mixed content» имеет смысл только на https-странице: защищённая страница
  // тянет незащищённые подресурсы. Если сама страница http — это отражено в
  // поле https, а не здесь.
  const mixedContent = https && insecure.length > 0;

  return {
    https,
    finalUrl,
    // Без исходного (до редиректов) URL надёжно определить нельзя — оставляем false.
    redirectedToHttps: false,
    mixedContent,
    insecureRequests: mixedContent ? [...new Set(insecure)].slice(0, 10) : [],
  };
}
