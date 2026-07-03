'use client';

// Кнопка «Поделиться отчётом»: копирует текущий адрес (публичную ссылку на отчёт)
// в буфер обмена и показывает подтверждение. Используется на странице /report/<id>,
// где адрес уже является постоянной ссылкой на сохранённый отчёт.
import { useState } from 'react';

export function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Буфер обмена недоступен (старый браузер / нет https) — тихо игнорируем;
      // пользователь всегда может скопировать адрес из адресной строки вручную.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus:ring-white/10"
      aria-live="polite"
    >
      {copied ? (
        <>
          <svg viewBox="0 0 20 20" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="currentColor" aria-hidden="true">
            <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.6 7.6a1 1 0 0 1-1.4 0L3.3 9.9a1 1 0 1 1 1.4-1.4l3.7 3.7 6.9-6.9a1 1 0 0 1 1.4 0Z" />
          </svg>
          Ссылка скопирована
        </>
      ) : (
        <>
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M7.5 10.5 12.5 7.5M7.5 9.5 12.5 12.5" strokeLinecap="round" />
            <circle cx="5.5" cy="10" r="2.2" />
            <circle cx="14.5" cy="6" r="2.2" />
            <circle cx="14.5" cy="14" r="2.2" />
          </svg>
          Поделиться отчётом
        </>
      )}
    </button>
  );
}
