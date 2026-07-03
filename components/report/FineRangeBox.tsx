// Диапазон штрафа: крупно «€8 000 – €45 000», НИКОГДА не одна цифра.
// Ниже — факторы и допущение (юридическое требование: диапазон + факторы).
import type { FineRange } from '@/lib/scanner/types';

// Форматирует евро с разделителем тысяч (неразрывный пробел).
// Ручная реализация — детерминированно, без зависимости от locale/ICU
// (важно: одинаковый результат на сервере и в браузере, без hydration-рассинхрона).
function formatEur(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded).toString();
  // Вставляем неразрывный пробел каждые 3 разряда: 8000 -> 8 000.
  const withThousands = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}€${withThousands}`;
}

export function FineRangeBox({ range }: { range: FineRange }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/40">
      <div className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
        Возможный диапазон штрафа
      </div>
      {/* Всегда диапазон: min – max, даже если значения близки. */}
      <div className="mt-1 text-2xl font-bold text-amber-900 dark:text-amber-200">
        {formatEur(range.minEur)} – {formatEur(range.maxEur)}
      </div>

      {range.factors && range.factors.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-800 dark:text-amber-300">
          {range.factors.map((factor, i) => (
            <li key={i}>{factor}</li>
          ))}
        </ul>
      )}

      {range.assumption && (
        <p className="mt-2 text-xs italic text-amber-700 dark:text-amber-400">
          Допущение: {range.assumption}
        </p>
      )}
    </div>
  );
}
