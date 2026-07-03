// Сборщик отчёта: превращает метаданные скана + находки в готовый Report.
// НЕ компонент — чистая функция, вызывается на сервере (route) после scoring.
// Источник правды по типам — '@/lib/scanner/types'.
import type {
  Report,
  Finding,
  ScanMeta,
  CompanySizeTier,
  SeverityCounts,
} from '@/lib/scanner/types';
import { DISCLAIMER, SEVERITY_ORDER } from '@/lib/scanner/types';
// aggregateRange создаёт сосед-агент (lib/scoring/fineRange.ts).
// Сигнатура: aggregateRange(findings: Finding[]): FineRange | null
import { aggregateRange } from '@/lib/scoring/fineRange';

/**
 * Собирает финальный Report: сортирует находки critical-first, считает сводку
 * по severity, агрегирует общий диапазон риска, закрепляет дисклеймер и
 * честно помечает неполноту скана.
 */
export function buildReport(args: {
  meta: ScanMeta;
  input: {
    companySizeTier: CompanySizeTier;
    repeatOffender: boolean;
    assumedDefaults: boolean;
  };
  findings: Finding[];
  aiMode: boolean;
}): Report {
  const { meta, input, findings, aiMode } = args;

  // Сортировка по SEVERITY_ORDER: critical (0) сверху, low (3) снизу.
  // Копируем массив, чтобы не мутировать вход вызывающего кода.
  const sorted = [...findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  // Счётчики по каждому уровню.
  const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of sorted) {
    counts[finding.severity] += 1;
  }

  // Честность о неполноте: бот-детекция или явная причина неполноты.
  const incompleteReason = meta.incompleteReason ?? null;
  const incomplete = meta.botBlocked || Boolean(incompleteReason);

  return {
    meta,
    input,
    summary: {
      counts,
      totalFindings: sorted.length,
      overallRange: aggregateRange(sorted),
    },
    findings: sorted,
    disclaimer: DISCLAIMER,
    aiMode,
    incomplete,
    incompleteReason,
  };
}
