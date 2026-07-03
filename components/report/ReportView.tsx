'use client';

// Верхний компонент отчёта — его импортирует страница отчёта.
// Композиция: ссылка «Новая проверка» → дисклеймер (ВВЕРХУ) → шапка →
// плашка неполноты → сводка → находки.
import { useEffect, useState } from 'react';
import type { Report } from '@/lib/scanner/types';
import { DisclaimerBanner } from './DisclaimerBanner';
import { ReportSummary } from './ReportSummary';
import { FindingCard } from './FindingCard';

export function ReportView({ report }: { report: Report }) {
  const { meta, input, summary, findings, disclaimer, incomplete, incompleteReason } = report;

  // Дата скана: на сервере и при первом рендере — детерминированный UTC-формат
  // (иначе разница часовых поясов сервера/браузера даёт hydration-рассинхрон).
  // После монтирования показываем время в локальной зоне пользователя.
  const [scannedLabel, setScannedLabel] = useState(() => formatDateUtc(meta.scannedAt));
  useEffect(() => {
    setScannedLabel(formatDateLocal(meta.scannedAt));
  }, [meta.scannedAt]);

  const targetUrl = meta.finalUrl || meta.url;
  const pagesScanned = meta.pagesScanned ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      {/* Возврат к форме живёт в обёртке страницы (app/report/page.tsx) — здесь не дублируем. */}

      {/* Дисклеймер закреплён ВВЕРХУ (юридическое требование). */}
      <DisclaimerBanner text={disclaimer} />

      {/* Шапка: что и когда сканировали. */}
      <header className="space-y-1">
        <h1 className="break-words text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {meta.title || meta.url}
        </h1>
        {targetUrl && (
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-block break-all text-sm text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            {targetUrl}
          </a>
        )}
        {scannedLabel && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">Проверено: {scannedLabel}</p>
        )}
      </header>

      {/* Честность о неполноте скана (не молчаливое «нарушений нет»). */}
      {incomplete && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-300 bg-orange-50 p-4 shadow-sm dark:border-orange-800/60 dark:bg-orange-950/50">
          <span aria-hidden="true" className="mt-0.5 shrink-0 text-lg leading-none">
            ⚠️
          </span>
          <div className="min-w-0">
            <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-400">
              Скан мог быть неполным
            </div>
            <p className="text-sm leading-relaxed text-orange-900 dark:text-orange-100">
              {incompleteReason
                ? incompleteReason
                : 'Часть проверок могла не выполниться.'}{' '}
              Поэтому отсутствие находок не означает, что нарушений нет.
            </p>
          </div>
        </div>
      )}

      {/* Честность охвата: какие страницы реально просканированы (Батч 2). */}
      {pagesScanned.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Просканированные страницы ({pagesScanned.length})
          </div>
          <ul className="space-y-1">
            {pagesScanned.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 shrink-0 ${p.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500'}`}
                >
                  {p.ok ? '✓' : '×'}
                </span>
                <span className="min-w-0">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{p.label}</span>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="ml-2 break-all text-xs text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                  >
                    {p.url}
                  </a>
                  {!p.ok && (
                    <span className="ml-1 text-xs text-zinc-400 dark:text-zinc-500">(не открылась)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Реквизиты, возврат, доступность и язык ищутся на всех этих страницах (найдено, если есть
            хоть на одной). Куки, трекеры и баннер согласия проверяются только на главной — они про
            состояние до согласия на входе.
          </p>
        </div>
      )}

      {/* Сводка — «взгляд с высоты» перед деталями. */}
      <ReportSummary summary={summary} input={input} />

      {/* Список находок (уже отсортирован critical-first в buildReport). */}
      {findings.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Находки</h2>
          {findings.map((finding, i) => (
            <FindingCard key={finding.ruleId || i} finding={finding} />
          ))}
        </div>
      )}
    </div>
  );
}

// Детерминированный UTC-формат DD.MM.YYYY HH:MM — одинаков на сервере и клиенте.
function formatDateUtc(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())} UTC`;
}

// Локальная зона пользователя — показываем после монтирования (дружелюбнее).
function formatDateLocal(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}
