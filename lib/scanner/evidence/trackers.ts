// ============================================================================
// Коллектор улик: известные трекеры (питает правило №2 «трекер до согласия»).
//
// Работает поверх сырья из capture.ts: берёт список сетевых запросов, пойманных
// ДО любого взаимодействия, и сверяет их с исчерпывающим статическим списком
// доменов известных трекеров. Никаких сетевых обращений — чистая функция.
// ============================================================================
import type { CapturedRequest, TrackerHit } from '@/lib/scanner/types';

/** Одна запись базы трекеров: имя, категория и список его доменов/паттернов. */
export interface TrackerDef {
  name: string;
  category: TrackerHit['category'];
  /**
   * Домены трекера. Запись без '/' — чистый домен (совпадение по хосту и его
   * поддоменам). Запись с '/' — паттерн «хост+путь» (напр. 'facebook.com/tr'),
   * проверяется и по хосту, и по подстроке URL.
   */
  domains: string[];
}

/**
 * Исчерпывающий статический список известных трекеров.
 * Категории соцплатформ ('social') — это их рекламные/конверсионные пиксели
 * (Meta Pixel, TikTok Pixel и т.п.); выделены отдельно от чистых рекламных сетей.
 */
export const TRACKERS: TrackerDef[] = [
  // — Аналитика —
  {
    name: 'Google Analytics',
    category: 'analytics',
    domains: ['google-analytics.com', 'analytics.google.com', 'region1.google-analytics.com'],
  },
  { name: 'Hotjar', category: 'analytics', domains: ['hotjar.com', 'hotjar.io'] },
  { name: 'Yandex Metrica', category: 'analytics', domains: ['mc.yandex.ru', 'yandex.ru/clck'] },
  { name: 'Microsoft Clarity', category: 'analytics', domains: ['clarity.ms'] },
  { name: 'Cxense / Piano', category: 'analytics', domains: ['cxense.com', 'piano.io'] },

  // — Менеджер тегов —
  { name: 'Google Tag Manager', category: 'tag-manager', domains: ['googletagmanager.com'] },

  // — Реклама (рекламные сети) —
  {
    name: 'Google Ads / DoubleClick',
    category: 'advertising',
    domains: ['doubleclick.net', 'googleadservices.com', 'googlesyndication.com', 'google.com/ads'],
  },
  { name: 'Adform', category: 'advertising', domains: ['adform.net'] },
  { name: 'Criteo', category: 'advertising', domains: ['criteo.com', 'criteo.net'] },
  { name: 'Microsoft / Bing Ads', category: 'advertising', domains: ['bat.bing.com'] },
  { name: 'Bidtheatre', category: 'advertising', domains: ['bidtheatre.com'] },
  { name: 'Taboola', category: 'advertising', domains: ['taboola.com'] },
  { name: 'Outbrain', category: 'advertising', domains: ['outbrain.com'] },
  { name: 'Amazon Ads', category: 'advertising', domains: ['amazon-adsystem.com'] },

  // — Соцсети (пиксели соцплатформ) —
  { name: 'Meta Pixel', category: 'social', domains: ['connect.facebook.net', 'facebook.com/tr'] },
  { name: 'TikTok Pixel', category: 'social', domains: ['analytics.tiktok.com', 'tiktok.com/i18n/pixel'] },
  { name: 'LinkedIn Insight', category: 'social', domains: ['px.ads.linkedin.com', 'snap.licdn.com'] },
  { name: 'Pinterest Tag', category: 'social', domains: ['ct.pinterest.com'] },
  { name: 'Twitter / X Ads', category: 'social', domains: ['static.ads-twitter.com', 'analytics.twitter.com'] },
];

/** Хост совпадает с доменом точно или как его поддомен (foo.example.com ⊃ example.com). */
function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith('.' + domain);
}

/** Совпадает ли запрос с одним доменом/паттерном трекера. */
function requestMatchesDomain(req: CapturedRequest, domain: string): boolean {
  const host = (req.hostname || '').toLowerCase();
  const url = (req.url || '').toLowerCase();
  const d = domain.toLowerCase();

  const slash = d.indexOf('/');
  if (slash !== -1) {
    // Паттерн «хост+путь»: проверяем и хост (чтобы посторонний URL с этой строкой
    // в query не дал ложное совпадение), и наличие подстроки в URL.
    const patternHost = d.slice(0, slash);
    return hostMatches(host, patternHost) && url.includes(d);
  }
  // Чистый домен — совпадение по хосту или его поддомену.
  return hostMatches(host, d);
}

/**
 * Находит известные трекеры среди запросов и агрегирует их по имени.
 * Один запрос засчитывается максимум одному трекеру. Возвращает уникальные
 * трекеры: requestCount — сколько запросов совпало, exampleUrl/hostname — от
 * первого совпавшего запроса.
 */
export function detectTrackers(requests: CapturedRequest[]): TrackerHit[] {
  const byName = new Map<string, TrackerHit>();

  for (const req of requests) {
    for (const tracker of TRACKERS) {
      if (!tracker.domains.some((d) => requestMatchesDomain(req, d))) continue;

      const hit = byName.get(tracker.name);
      if (hit) {
        hit.requestCount += 1;
      } else {
        byName.set(tracker.name, {
          name: tracker.name,
          category: tracker.category,
          hostname: req.hostname,
          exampleUrl: req.url,
          requestCount: 1,
        });
      }
      // Домены трекеров не пересекаются — дальше по этому запросу не ищем.
      break;
    }
  }

  return Array.from(byName.values());
}
