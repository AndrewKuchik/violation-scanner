'use client';

// Карточка находки. Свёрнута по умолчанию (простой язык), детали — по клику
// (UX-принцип №4). Развёрнута: полное объяснение, улики, статьи закона,
// диапазон штрафа и шаги по исправлению.
import { useState } from 'react';
import type { Finding } from '@/lib/scanner/types';
import { SeverityBadge } from './SeverityBadge';
import { EvidencePanel } from './EvidencePanel';
import { FineRangeBox } from './FineRangeBox';

export function FindingCard({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(false);
  const contentId = `finding-${finding.ruleId}`;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Свёрнутый вид: бейдж + заголовок + первая строка объяснения. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={contentId}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      >
        <span className="mt-0.5 shrink-0">
          <SeverityBadge severity={finding.severity} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{finding.title}</span>
            {finding.aiEnriched && (
              <span
                title="Пояснение обогащено ИИ"
                className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300"
              >
                ИИ
              </span>
            )}
          </span>
          {!expanded && finding.explanation && (
            <span className="mt-1 block truncate text-sm text-zinc-500 dark:text-zinc-400">
              {finding.explanation}
            </span>
          )}
        </span>

        <span
          className={`mt-1 shrink-0 text-zinc-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {/* Развёрнутый вид. */}
      {expanded && (
        <div
          id={contentId}
          className="space-y-5 border-t border-zinc-200 px-4 pb-5 pt-4 dark:border-zinc-800"
        >
          {finding.explanation && (
            <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {finding.explanation}
            </p>
          )}

          {/* Где именно на сайте — улики. */}
          {finding.evidence && finding.evidence.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Где это на сайте
              </h4>
              <EvidencePanel evidence={finding.evidence} />
            </div>
          )}

          {/* Статьи закона (статичные legalRefs). */}
          {finding.legalRefs && finding.legalRefs.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Статьи закона
              </h4>
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                {finding.legalRefs.map((ref, i) => (
                  <li key={i}>{ref}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Диапазон штрафа — если посчитан для находки. */}
          {finding.fineRange && <FineRangeBox range={finding.fineRange} />}

          {/* Шаги по исправлению — нумерованный список. */}
          {finding.remediation && finding.remediation.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Как исправить
              </h4>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                {finding.remediation.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
