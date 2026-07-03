// Публичная страница сохранённого отчёта: /report/<id>. Серверный компонент —
// читает отчёт из хранилища (Vercel Blob) по id и рендерит его. Этой ссылкой можно
// делиться: она открывается у любого, не только в браузере автора.
// Если отчёт не найден (неверный id / удалён) — дружелюбная заглушка.
import Link from 'next/link';
import { loadReport } from '@/lib/report/store';
import { ReportView } from '@/components/report/ReportView';
import { ShareButton } from '@/components/report/ShareButton';

// Отчёты создаются в рантайме — страницу не пререндерим статически.
export const dynamic = 'force-dynamic';

export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await loadReport(id);

  if (!report) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Отчёт не найден
          </h1>
          <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">
            Возможно, ссылка неверная или отчёт был удалён. Вы можете проверить сайт заново.
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
        <div className="mb-6 flex items-center justify-between gap-4">
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
          <ShareButton />
        </div>
        <ReportView report={report} />
      </div>
    </main>
  );
}
