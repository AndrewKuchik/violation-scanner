'use client';

// Лендинг: одно поле URL, короткая строка-пояснение и свёрнутый блок
// уточняющих вопросов. По сабмиту запускаем скан, кладём отчёт в
// sessionStorage и уходим на /report.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CompanySizeTier, Report } from '@/lib/scanner/types';
import { ScanForm } from '@/components/ScanForm';
import { QualifyingQuestions } from '@/components/QualifyingQuestions';
import { ScanProgress } from '@/components/ScanProgress';

/** Ключ, под которым отчёт передаётся на страницу /report. */
const STORAGE_KEY = 'violation-scanner:last-report';

export default function Home() {
  const router = useRouter();

  const [url, setUrl] = useState('');
  const [companySizeTier, setCompanySizeTier] = useState<CompanySizeTier | null>(null);
  const [repeatOffender, setRepeatOffender] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = url.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);

    // Отправляем только то, что пользователь реально указал. Пропущенные поля
    // оркестратор заполнит консервативными значениями по умолчанию.
    const body: { url: string; companySizeTier?: CompanySizeTier; repeatOffender?: boolean } = {
      url: trimmed,
    };
    if (companySizeTier) body.companySizeTier = companySizeTier;
    if (repeatOffender) body.repeatOffender = true;

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      let data: { ok?: boolean; report?: Report; shareId?: string | null; error?: string } | null =
        null;
      try {
        data = await res.json();
      } catch {
        // Ответ оказался не JSON — обработаем как общую ошибку ниже.
      }

      if (!res.ok || !data?.ok || !data.report) {
        throw new Error(data?.error || 'Не удалось проверить сайт. Попробуйте ещё раз.');
      }

      if (data.shareId) {
        // Отчёт сохранён на сервере — уходим на общий адрес, ссылкой можно делиться.
        router.push(`/report/${data.shareId}`);
      } else {
        // Шаринг не подключён — открываем отчёт из памяти браузера, как раньше.
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data.report));
        router.push('/report');
      }
      // Спиннер намеренно не снимаем — идёт переход на страницу отчёта.
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Что-то пошло не так. Попробуйте ещё раз.',
      );
      setLoading(false);
    }
  }

  // Экран сканирования: живой список этапов (чтобы ожидание не выглядело зависшим).
  if (loading) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <ScanProgress />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            Проверка сайта на риски приватности
          </h1>
          <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">
            Вставьте ссылку — покажем, что не так, где именно и во сколько это может обойтись.
          </p>
        </header>

        <ScanForm value={url} onChange={setUrl} onSubmit={handleSubmit} loading={loading} />

        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Проверим куки, согласие на отслеживание, политику конфиденциальности и HTTPS.
          Бесплатно, без регистрации.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </p>
        )}

        <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setShowQuestions((v) => !v)}
            aria-expanded={showQuestions}
            aria-controls="qualifying-questions"
            className="flex w-full items-center justify-between text-left text-sm font-medium text-zinc-700 transition hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            <span>Уточнить для более точной оценки</span>
            <svg
              className={`h-4 w-4 shrink-0 transition-transform ${showQuestions ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              aria-hidden="true"
            >
              <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {showQuestions && (
            <div id="qualifying-questions" className="mt-4">
              <QualifyingQuestions
                companySizeTier={companySizeTier}
                onCompanySizeTierChange={setCompanySizeTier}
                repeatOffender={repeatOffender}
                onRepeatOffenderChange={setRepeatOffender}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
