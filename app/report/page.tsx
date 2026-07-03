'use client';

// Страница отчёта. Отчёт кладётся в sessionStorage на лендинге и читается здесь.
// sessionStorage доступен только в браузере — читаем в useEffect. Если отчёта
// нет (например, прямой заход по ссылке) — показываем дружелюбную заглушку.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Report } from '@/lib/scanner/types';
import { ReportView } from '@/components/report/ReportView';

/** Ключ, под которым лендинг сохраняет отчёт. */
const STORAGE_KEY = 'violation-scanner:last-report';

export default function ReportPage() {
  const [report, setReport] = useState<Report | null>(null);
  // ready = прочитали sessionStorage. До этого не рендерим ни отчёт, ни заглушку,
  // чтобы не было мигания и расхождения с серверным рендером (гидратацией).
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setReport(JSON.parse(raw) as Report);
    } catch {
      // Повреждённые данные — покажем экран «Отчёта пока нет».
    }
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100"
          aria-hidden="true"
        />
      </main>
    );
  }

  if (!report) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Отчёта пока нет
          </h1>
          <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">
            Похоже, вы открыли эту страницу напрямую. Запустите проверку сайта — и отчёт
            появится здесь.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-zinc-900 px-6 py-3 text-base font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Проверить сайт
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full flex-1">
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              aria-hidden="true"
            >
              <path d="M12 5 7 10 12 15" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Новая проверка
          </Link>
        </div>
        <ReportView report={report} />
      </div>
    </main>
  );
}
