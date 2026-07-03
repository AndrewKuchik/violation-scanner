'use client';

// Верхний компонент отчёта — его импортирует страница отчёта.
// Композиция: дисклеймер (ВВЕРХУ) → шапка → плашка неполноты → сводка → находки.
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

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      {/* Дисклеймер закреплён ВВЕРХУ (юридическое требование). */}
      <DisclaimerBanner text={disclaimer} />

      {/* Шапка: что и когда сканировали. */}
      <header className="space-y-1">
        <h1 className="break-all text-xl font-bold text-zinc-900 dark:text-zinc-100">
          {meta.title || meta.url}
        </h1>
        <p className="break-all text-sm text-zinc-500 dark:text-zinc-400">
          {meta.finalUrl || meta.url}
        </p>
        {scannedLabel && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">Проверено: {scannedLabel}</p>
        )}
      </header>

      {/* Честность о неполноте скана (не молчаливое «нарушений нет»). */}
      {incomplete && (
        <div className="flex items-start gap-3 rounded-lg border border-orange-300 bg-orange-50 p-4 text-orange-900 dark:border-orange-800/60 dark:bg-orange-950/50 dark:text-orange-100">
          <span aria-hidden="true" className="mt-0.5 shrink-0 text-lg leading-none">
            ⚠
          </span>
          <p className="text-sm leading-relaxed">
            Скан мог быть неполным
            {incompleteReason ? `: ${incompleteReason}` : ' — часть проверок могла не выполниться'}.
            Поэтому отсутствие находок не означает, что нарушений нет.
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
