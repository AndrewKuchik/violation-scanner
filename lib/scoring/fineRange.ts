// ============================================================================
// Ф.4 — Диапазон возможного штрафа. НИКОГДА не точная сумма
// (docs/product/legal-guardrails.md §1): всегда диапазон + факторы + допущение.
//
// Числа привязаны к реальной практике DVI (Латвия), guardrails §5:
//   • €7 000 (2019)     — малый интернет-магазин (лежит ВНУТРИ полосы small/critical);
//   • €1 200 000 (2022) — SIA «TET», крупный телеком; итог после −50% за
//                          сотрудничество (= верх полосы large/critical);
//   • потолки ст. 83 GDPR: нижний €10M / 2% оборота, верхний €20M / 4%
//     (нарушения согласия на куки → верхний уровень).
//
// Мы НЕ вычисляем точную формулу от оборота (его не видно из URL). Вместо этого —
// откалиброванные «уровни экспозиции», ключ = (severity, tier, repeat).
// ============================================================================
import type { Finding, FineRange, CompanySizeTier } from '@/lib/scanner/types';

// Абсолютный статутный потолок ст. 83(5): €20M ИЛИ 4% оборота (что выше). Оборот
// из скана неизвестен → используем абсолютную часть как страховочный предел сверху.
const STATUTORY_UPPER_EUR = 20_000_000;

// Low держим символическим независимо от размера компании: минорная процедурная
// проблема — это скорее предупреждение/реприманда (ст. 58 GDPR), чем ощутимый штраф.
const LOW_SYMBOLIC_CAP_EUR = 5_000;

// Базовая полоса для CRITICAL по размеру компании. Остальные severity — доля от неё.
// solo намеренно ниже small; верх large упирается в реальный кейс SIA «TET».
const CRITICAL_BASE_BY_TIER: Record<CompanySizeTier, { min: number; max: number }> = {
  solo: { min: 1_000, max: 5_000 },
  small: { min: 3_000, max: 15_000 }, // €7 000 (2019) — внутри полосы
  sme: { min: 15_000, max: 90_000 },
  large: { min: 100_000, max: 1_200_000 }, // верх = SIA «TET» (2022)
};

// Доля от полосы CRITICAL того же tier по уровням серьёзности:
// critical = 100%; high ≈ 40–60%; medium ≈ 15–30%; low — символический
// (снизу 0 = возможна лишь реприманда без штрафа).
const SEVERITY_SHARE: Record<Finding['severity'], { minPct: number; maxPct: number }> = {
  critical: { minPct: 1.0, maxPct: 1.0 },
  high: { minPct: 0.4, maxPct: 0.6 },
  medium: { minPct: 0.15, maxPct: 0.3 },
  low: { minPct: 0.0, maxPct: 0.08 },
};

// Человеческие ярлыки для factors/assumption (по-русски, идут в отчёт).
const TIER_LABEL: Record<CompanySizeTier, string> = {
  solo: 'соло/самозанятый',
  small: 'малый бизнес',
  sme: 'средняя компания (SME)',
  large: 'крупная компания',
};
const SEVERITY_LABEL: Record<Finding['severity'], string> = {
  critical: 'критическая',
  high: 'высокая',
  medium: 'средняя',
  low: 'низкая',
};

// Повторное нарушение — отягчающий фактор: верх поднимаем сильнее низа, полоса
// расширяется и «повтор» ощущается. Множители в диапазоне, указанном в задаче.
const REPEAT_MIN_MULT = 1.25;
const REPEAT_MAX_MULT = 1.8;

// Округление до €100 — убираем ложную точность. Низ вниз, верх вверх (чуть шире,
// консервативнее). Анкерные числа кратны 100 и потому не смещаются.
const floorTo100 = (n: number) => Math.floor(n / 100) * 100;
const ceilTo100 = (n: number) => Math.ceil(n / 100) * 100;

/**
 * Диапазон штрафа для ОДНОЙ находки по «уровню экспозиции» (severity, tier, repeat).
 * Всегда возвращает диапазон + факторы + допущение, никогда одну точную сумму.
 */
export function computeFineRange(
  finding: Finding,
  tier: CompanySizeTier,
  repeat: boolean,
): FineRange {
  const critical = CRITICAL_BASE_BY_TIER[tier];
  const share = SEVERITY_SHARE[finding.severity];

  let minEur = critical.min * share.minPct;
  let maxEur = critical.max * share.maxPct;

  // Символический потолок для low — до применения повтора.
  if (finding.severity === 'low') {
    maxEur = Math.min(maxEur, LOW_SYMBOLIC_CAP_EUR);
  }

  if (repeat) {
    minEur *= REPEAT_MIN_MULT;
    maxEur *= REPEAT_MAX_MULT;
  }

  // Никогда не выше статутного потолка (страховка; для SMB обычно не срабатывает).
  maxEur = Math.min(maxEur, STATUTORY_UPPER_EUR);

  minEur = floorTo100(minEur);
  maxEur = ceilTo100(maxEur);

  const factors: string[] = [
    `Базовая серьёзность нарушения: ${SEVERITY_LABEL[finding.severity]}`,
    `Размер компании: ${TIER_LABEL[tier]}`,
  ];
  if (repeat) {
    factors.push('Повторное нарушение — верхняя граница диапазона повышена');
  }
  if (finding.severity === 'low') {
    factors.push('Низкая серьёзность: вероятны предупреждение/реприманда (ст. 58 GDPR), а не крупный штраф');
  }
  if (tier === 'large') {
    factors.push('Теоретический статутный потолок ст. 83 GDPR: до €20 млн или 4% годового оборота');
  }

  const assumption = `${TIER_LABEL[tier]}, ${repeat ? 'повторное нарушение' : 'впервые'}`;

  return { minEur, maxEur, factors, assumption };
}

/**
 * Общий риск по всем находкам. НЕ наивная сумма — регуляторы консолидируют
 * санкции (ст. 83(3) GDPR): нижняя граница берётся по самому серьёзному нарушению
 * (максимум из min'ов, а не их сумма), верхняя — кумулятивная (сумма max'ов), но
 * ограничена статутным потолком. Возвращает null, если находок с рассчитанным
 * диапазоном нет (в т.ч. когда список пуст).
 */
export function aggregateRange(findings: Finding[]): FineRange | null {
  const ranges = findings
    .map((f) => f.fineRange)
    .filter((r): r is FineRange => r != null);

  if (ranges.length === 0) return null;

  // Низ: максимум из минимумов — «как минимум самое серьёзное нарушение».
  const minEur = Math.max(...ranges.map((r) => r.minEur));
  // Верх: сумма максимумов, но не выше статутного потолка (иначе кумулятив уходит
  // в абсурд при большом числе находок у крупной компании).
  const summedMax = ranges.reduce((sum, r) => sum + r.maxEur, 0);
  const maxEur = Math.min(summedMax, STATUTORY_UPPER_EUR);

  const factors: string[] = [
    `Учтено находок: ${ranges.length}`,
    'Нижняя граница — по самому серьёзному нарушению, а не сумма минимумов (регуляторы консолидируют санкции, ст. 83(3) GDPR)',
    'Верхняя граница — кумулятивная оценка, ограниченная статутным потолком ст. 83 GDPR (€20 млн / 4% оборота)',
  ];

  // Допущение единое для всех находок одного скана (общий tier/repeat) — берём у первой.
  const assumption = ranges[0].assumption;

  return { minEur, maxEur, factors, assumption };
}
