'use client';

// Поле ввода URL + кнопка запуска проверки. Полностью контролируемый компонент:
// значение и состояние загрузки приходят сверху (из app/page.tsx).

interface ScanFormProps {
  /** Текущее значение поля URL. */
  value: string;
  /** Вызывается при каждом изменении поля. */
  onChange: (value: string) => void;
  /** Вызывается при отправке формы (кнопка или Enter). */
  onSubmit: () => void;
  /** Идёт проверка — блокирует поле и кнопку. */
  loading: boolean;
}

export function ScanForm({ value, onChange, onSubmit, loading }: ScanFormProps) {
  // Кнопка неактивна, пока идёт проверка или поле пустое.
  const disabled = loading || value.trim().length === 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled) return;
        onSubmit();
      }}
      className="flex w-full flex-col gap-3 sm:flex-row"
    >
      <input
        type="text"
        inputMode="url"
        autoComplete="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Адрес сайта"
        placeholder="example.com"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="w-full flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-900/10 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-white/10"
      />
      <button
        type="submit"
        disabled={disabled}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-6 py-3 text-base font-medium text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus:ring-white/20"
      >
        {loading && (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        )}
        {loading ? 'Проверяю…' : 'Проверить сайт'}
      </button>
    </form>
  );
}
