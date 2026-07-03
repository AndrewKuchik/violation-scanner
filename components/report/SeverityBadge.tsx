// Цветной бейдж уровня серьёзности с русской подписью.
// Без интерактивности — работает и на сервере, и в клиентском бандле.
import type { Severity } from '@/lib/scanner/types';

// Русские подписи для каждого уровня.
const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Критично',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

// Цвета: critical=красный, high=оранжевый, medium=янтарный, low=серый.
const SEVERITY_CLASSES: Record<Severity, string> = {
  critical:
    'bg-red-100 text-red-800 ring-red-600/20 dark:bg-red-950 dark:text-red-300 dark:ring-red-400/30',
  high: 'bg-orange-100 text-orange-800 ring-orange-600/20 dark:bg-orange-950 dark:text-orange-300 dark:ring-orange-400/30',
  medium:
    'bg-amber-100 text-amber-800 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-400/30',
  low: 'bg-zinc-100 text-zinc-700 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-400/30',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${SEVERITY_CLASSES[severity]}`}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
