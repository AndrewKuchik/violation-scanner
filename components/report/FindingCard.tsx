'use client';

// Карточка находки. Свёрнута по умолчанию (простой язык), детали — по клику
// (UX-принцип №4). Развёрнута: чёткие секции с подзаголовками — что это значит,
// почему чекер так решил (улики), какой закон, возможный штраф и как исправить.
import { useState } from 'react';
import type { Finding, Severity } from '@/lib/scanner/types';
import { SeverityBadge } from './SeverityBadge';
import { EvidencePanel } from './EvidencePanel';
import { FineRangeBox } from './FineRangeBox';

// Цветная полоса-акцент слева по уровню серьёзности.
const ACCENT_BAR: Record<Severity, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-zinc-400',
};

// Первое предложение объяснения — короткая понятная строка для свёрнутого вида.
function firstSentence(text: string): string {
  if (!text) return '';
  const match = text.match(/^.*?[.!?](\s|$)/);
  return (match ? match[0] : text).trim();
}

// Русское склонение слова «подтверждение» по числу.
function confirmationsLabel(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  let word = 'подтверждений';
  if (mod10 === 1 && mod100 !== 11) word = 'подтверждение';
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) word = 'подтверждения';
  return `📍 ${n} ${word} на сайте`;
}

// Небольшой uppercase-подзаголовок секции — визуально отделяет блоки.
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
      {children}
    </h4>
  );
}

export function FindingCard({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(false);
  const contentId = `finding-${finding.ruleId}`;
  const evidenceCount = finding.evidence?.length ?? 0;
  const summaryLine = firstSentence(finding.explanation);

  return (
    <div className="flex overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Цветная полоса-акцент по severity. */}
      <div aria-hidden="true" className={`w-1.5 shrink-0 ${ACCENT_BAR[finding.severity]}`} />

      <div className="min-w-0 flex-1">
        {/* Свёрнутый вид: бейдж + заголовок + одна строка + мета. Вся шапка кликабельна. */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={contentId}
          className="flex w-full cursor-pointer items-start gap-3 p-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        >
          <span className="mt-0.5 shrink-0">
            <SeverityBadge severity={finding.severity} />
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-zinc-900 dark:text-zinc-100">{finding.title}</span>
              {finding.aiEnriched && (
                <span
                  title="Пояснение обогащено ИИ"
                  className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                >
                  ИИ
                </span>
              )}
            </span>

            {summaryLine && (
              <span className="mt-1 block text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {summaryLine}
              </span>
            )}

            {evidenceCount > 0 && (
              <span className="mt-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-500">
                {confirmationsLabel(evidenceCount)}
              </span>
            )}
          </span>

          {/* Заметный шеврон ▸ / ▾. */}
          <span
            className="mt-0.5 shrink-0 text-base text-zinc-400 dark:text-zinc-500"
            aria-hidden="true"
          >
            {expanded ? '▾' : '▸'}
          </span>
        </button>

        {/* Развёрнутый вид — чёткие секции. */}
        {expanded && (
          <div
            id={contentId}
            className="space-y-5 border-t border-zinc-200 px-4 pb-5 pt-4 dark:border-zinc-800"
          >
            {finding.explanation && (
              <section>
                <SectionTitle>Что это значит</SectionTitle>
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {finding.explanation}
                </p>
              </section>
            )}

            {/* Почему чекер так решил — вводная строка + улики. */}
            {evidenceCount > 0 && (
              <section>
                <SectionTitle>Почему мы так решили</SectionTitle>
                <p className="mb-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Вот что чекер увидел на сайте:
                </p>
                <EvidencePanel evidence={finding.evidence} />
              </section>
            )}

            {/* Статьи закона (статичные legalRefs) — моноширинными «таблетками». */}
            {finding.legalRefs && finding.legalRefs.length > 0 && (
              <section>
                <SectionTitle>Какой закон затрагивается</SectionTitle>
                <ul className="space-y-1.5">
                  {finding.legalRefs.map((ref, i) => (
                    <li
                      key={i}
                      className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300"
                    >
                      {ref}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Диапазон штрафа — если посчитан для находки. */}
            {finding.fineRange && (
              <section>
                <SectionTitle>Возможный штраф</SectionTitle>
                <FineRangeBox range={finding.fineRange} />
              </section>
            )}

            {/* Шаги по исправлению — нумерованный список. */}
            {finding.remediation && finding.remediation.length > 0 && (
              <section>
                <SectionTitle>Как исправить</SectionTitle>
                <ol className="space-y-2">
                  {finding.remediation.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                        {i + 1}
                      </span>
                      <span className="pt-0.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
