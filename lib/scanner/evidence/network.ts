// ============================================================================
// Сводка по сетевым запросам, пойманным ДО согласия. Чистая функция —
// без браузера. Источник типов — @/lib/scanner/types (не переопределяем).
// ============================================================================
import type { CapturedRequest, NetworkEvidence } from '@/lib/scanner/types';

// ---------------------------------------------------------------------------
// eTLD+1 (регистрируемый домен) — грубое приближение без внешних пакетов.
// Нужно, чтобы поддомены самого сайта (cdn.delfi.lv) не считались сторонними.
// Для известных двухуровневых суффиксов (co.uk, com.lv…) берём три последние
// метки, иначе — две.
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
    .replace(/\.$/, '')
    .replace(/^\./, '');
  if (!host) return '';
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return host; // IPv4 как есть
  const labels = host.split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  const lastTwo = labels.slice(-2).join('.');
  if (TWO_LEVEL_SUFFIXES.has(lastTwo)) return labels.slice(-3).join('.');
  return lastTwo;
}

// ---------------------------------------------------------------------------
// Публичная сигнатура (вызывается из capture.ts) — менять нельзя.
// ---------------------------------------------------------------------------
export function analyzeNetwork(
  requests: CapturedRequest[],
  siteHostname: string,
): NetworkEvidence {
  const siteDomain = registrableDomain(siteHostname);
  const thirdPartyHosts = new Set<string>();
  let thirdPartyRequests = 0;

  for (const req of requests) {
    const host = (req.hostname || '').trim().toLowerCase();
    if (!host) continue; // data:/blob: и прочее без хоста — не считаем сторонним
    if (registrableDomain(host) !== siteDomain) {
      thirdPartyRequests += 1;
      thirdPartyHosts.add(host);
    }
  }

  return {
    totalRequests: requests.length,
    thirdPartyRequests,
    thirdPartyHostnames: [...thirdPartyHosts].sort(),
  };
}
