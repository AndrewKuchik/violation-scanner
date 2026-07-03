// Панель улик «где именно». Для DOM-находок со скриншотом — картинка с подсветкой
// (главный дифференциатор продукта). Для остальных — аккуратная таблица деталей.
// Устойчива к пустым/undefined полям.
import type { EvidencePointer } from '@/lib/scanner/types';

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
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {pointer.label}
      </div>

      {hasScreenshot ? (
        // eslint-disable-next-line @next/next/no-img-element -- base64 data URI, оптимизация next/image неприменима
        <img
          src={`data:image/png;base64,${pointer.screenshotBase64}`}
          alt={pointer.label || 'Скриншот улики на странице'}
          className="max-w-full rounded border border-zinc-300 dark:border-zinc-600"
        />
      ) : detailEntries.length > 0 ? (
        <table className="w-full border-collapse text-sm">
          <tbody>
            {detailEntries.map(([key, value]) => (
              <tr
                key={key}
                className="border-b border-zinc-200 last:border-0 dark:border-zinc-700"
              >
                <td className="py-1 pr-4 align-top font-mono text-xs text-zinc-500 dark:text-zinc-400">
                  {key}
                </td>
                <td className="py-1 align-top break-all text-zinc-700 dark:text-zinc-300">
                  {String(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Дополнительных деталей нет.
        </p>
      )}
    </div>
  );
}
