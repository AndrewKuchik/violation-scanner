// Заметная плашка дисклеймера. Закреплена ВВЕРХУ отчёта (не в подвале) —
// юридическое требование (docs/product/legal-guardrails.md, п.3).
export function DisclaimerBanner({ text }: { text: string }) {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/50 dark:text-amber-100"
    >
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-lg leading-none">
        ⚠
      </span>
      <p className="text-sm leading-relaxed">{text}</p>
    </div>
  );
}
