// Сводка отчёта: «взгляд с высоты» перед списком находок (UX-принцип №1).
// Числа по severity, общий диапазон риска и строка про допущение о размере компании.
import type { Report, Severity, CompanySizeTier } from '@/lib/scanner/types';
import { FineRangeBox } from './FineRangeBox';

// Русские подписи размера компании.
const TIER_LABELS: Record<CompanySizeTier, string> = {
  solo: 'самозанятый / один человек',
  small: 'малый бизнес',
  sme: 'среднее предприятие',
  large: 'крупная компания',
};

// Порядок и оформление плиток severity (critical -> low).
const SEVERITY_META: {
  key: Severity;
  label: string;
  dotClass: string;
  textClass: string;
}[] = [
  { key: 'critical', label: 'Критично', dotClass: 'bg-red-500', textClass: 'text-red-700 dark:text-red-400' },
  { key: 'high', label: 'Высокий', dotClass: 'bg-orange-500', textClass: 'text-orange-700 dark:text-orange-400' },
  { key: 'medium', label: 'Средний', dotClass: 'bg-amber-500', textClass: 'text-amber-700 dark:text-amber-400' },
  { key: 'low', label: 'Низкий', dotClass: 'bg-zinc-400', textClass: 'text-zinc-600 dark:text-zinc-400' },
];

export function ReportSummary({
  summary,
  input,
}: {
  summary: Report['summary'];
  input: Report['input'];
}) {
  const { counts, totalFindings, overallRange } = summary;
  const tierLabel = TIER_LABELS[input.companySizeTier] ?? input.companySizeTier;

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Сводка</h2>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          Всего находок:{' '}
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{totalFindings}</span>
        </span>
      </div>

      {totalFindings === 0 ? (
        // Осторожная формулировка: отсутствие находок ≠ обещание соответствия закону.
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Явных нарушений не обнаружено. Это не гарантия соответствия закону — см. дисклеймер выше.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SEVERITY_META.map((s) => (
            <div
              key={s.key}
              className="flex flex-col items-center rounded-lg border border-zinc-200 py-3 dark:border-zinc-800"
            >
              <span className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${s.dotClass}`} aria-hidden="true" />
                <span className={`text-2xl font-bold ${s.textClass}`}>{counts[s.key]}</span>
              </span>
              <span className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Общий диапазон риска — только если он посчитан. */}
      {overallRange && <FineRangeBox range={overallRange} />}

      {/* Допущение о размере компании: без интерактивности, достаточно текста. */}
      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        Оценка сделана в допущении:{' '}
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{tierLabel}</span>
        {input.repeatOffender ? ', повторное нарушение' : ', нарушение впервые'}
        {input.assumedDefaults ? ' (значения по умолчанию — вы не уточняли). ' : '. '}
        Оценка изменится, если уточнить размер компании.
      </p>
    </section>
  );
}
