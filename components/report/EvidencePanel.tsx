// Панель улик «почему мы так решили». Для DOM-находок со скриншотом — картинка
// с подсветкой (главный дифференциатор продукта). Для остальных — читаемые строки
// с человеческими подписями. Устойчива к пустым/undefined/null полям.
import type { EvidencePointer } from '@/lib/scanner/types';

// Перевод технических ключей details на человеческий русский.
// Неизвестные ключи выводим как есть.
const KEY_LABELS: Record<string, string> = {
  name: 'Имя',
  domain: 'Домен',
  category: 'Категория',
  hostname: 'Хост',
  requestCount: 'Запросов',
  finalUrl: 'Адрес',
  href: 'Ссылка',
  url: 'Адрес',
  exampleUrl: 'Пример запроса',
  path: 'Путь',
  value: 'Значение',
  expires: 'Истекает',
  sameSite: 'SameSite',
  scope: 'Хранилище',
  key: 'Ключ',
  protocol: 'Протокол',
  securityProtocol: 'Протокол шифрования',
  https: 'HTTPS',
  reachable: 'Доступна',
  found: 'Найдена',
  present: 'Присутствует',
  confidence: 'Уверенность',
  cmpVendor: 'Система согласия',
  firstParty: 'Свой домен',
  thirdPartyRequests: 'Сторонних запросов',
  totalRequests: 'Всего запросов',
  timestamp: 'Момент (мс)',
};

function labelFor(key: string): string {
  return KEY_LABELS[key] ?? key;
}

// Значения bool/числа делаем понятнее для человека.
function humanValue(value: string | number | boolean): string {
  if (value === true) return 'да';
  if (value === false) return 'нет';
  return String(value);
}

export function EvidencePanel({ evidence }: { evidence: EvidencePointer[] }) {
  if (!evidence || evidence.length === 0) return null;

  return (
    <div className="space-y-3">
      {evidence.map((pointer, i) => (
        <EvidenceItem key={i} pointer={pointer} />
      ))}
    </div>
  );
}

function EvidenceItem({ pointer }: { pointer: EvidencePointer }) {
  // Скриншот показываем только для DOM-улик, и только если он есть.
  const hasScreenshot = pointer.kind === 'dom' && Boolean(pointer.screenshotBase64);

  // Детали: выкидываем пустые/undefined/null значения.
  const detailEntries = pointer.details
    ? Object.entries(pointer.details).filter(
        ([, value]) => value !== null && value !== undefined && value !== '',
      )
    : [];

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
      {pointer.label && (
        <div className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          {pointer.label}
        </div>
      )}

      {hasScreenshot ? (
        <figure className="m-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URI, оптимизация next/image неприменима */}
          <img
            src={`data:image/png;base64,${pointer.screenshotBase64}`}
            alt={pointer.label || 'Скриншот места на странице'}
            className="max-w-full rounded-md border border-zinc-300 shadow-sm dark:border-zinc-600"
          />
          <figcaption className="mt-1.5 text-xs italic text-zinc-500 dark:text-zinc-400">
            Так выглядит место на сайте
          </figcaption>
        </figure>
      ) : detailEntries.length > 0 ? (
        <dl className="space-y-1.5 text-sm">
          {detailEntries.map(([key, value]) => (
            <div
              key={key}
              className="flex flex-col gap-0.5 sm:flex-row sm:gap-2"
            >
              <dt className="shrink-0 font-semibold text-zinc-700 dark:text-zinc-300 sm:w-40">
                {labelFor(key)}
              </dt>
              <dd className="min-w-0 break-all text-zinc-600 dark:text-zinc-400">
                {humanValue(value as string | number | boolean)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Дополнительных деталей нет.</p>
      )}
    </div>
  );
}
