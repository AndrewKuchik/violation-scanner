// Заметная плашка дисклеймера. Закреплена ВВЕРХУ отчёта (не в подвале) —
// юридическое требование (docs/product/legal-guardrails.md, п.3).
export function DisclaimerBanner({ text }: { text: string }) {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm dark:border-amber-700/60 dark:bg-amber-950/50"
    >
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-lg leading-none">
        ⚠️
      </span>
      <div className="min-w-0">
        <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          Важно
        </div>
        <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-100">{text}</p>
      </div>
    </div>
  );
}
