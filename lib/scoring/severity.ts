// ============================================================================
// Ф.4 — Уточнение серьёзности находки.
//
// Принцип (docs/modules/scoring.md): severity = ВОЗДЕЙСТВИЕ на пользователя
// × РАСПРОСТРАНЁННОСТЬ по сайту. НЕ сложность исправления.
//
// База (finding.severity) приходит из правила и кодирует воздействие. Здесь мы
// лишь МОДУЛИРУЕМ её охватом, измеримым по уликам скана (сколько трекеров,
// сторонних куки, сторонних запросов). Направление — только ВВЕРХ и
// консервативно: регуляторный контекст требует не занижать системные проблемы,
// но и не раздувать «критичность» из единичной мелочи. Понижать базу нельзя.
// ============================================================================
import type { Finding, Severity, ScanEvidence } from '@/lib/scanner/types';

// Серьёзность по возрастанию — чтобы поднять ровно на один уровень.
// (Зеркалит SEVERITY_ORDER из types.ts, только в порядке «по возрастанию».)
const ASCENDING: Severity[] = ['low', 'medium', 'high', 'critical'];

function bumpUp(severity: Severity): Severity {
  const i = ASCENDING.indexOf(severity);
  // Math.min не даёт выйти за 'critical' (верхний уровень остаётся собой).
  return ASCENDING[Math.min(i + 1, ASCENDING.length - 1)];
}

/**
 * Итоговая серьёзность находки с поправкой на распространённость проблемы по сайту.
 * По умолчанию — базовая серьёзность правила; поднимаем ровно на один уровень
 * только при явно высоком охвате и НИКОГДА не понижаем.
 */
export function refineSeverity(finding: Finding, evidence: ScanEvidence): Severity {
  const base = finding.severity;

  // Низкую серьёзность не трогаем: это символические/предупредительные находки,
  // раздувать их «критичность» из фонового шума нельзя.
  if (base === 'low') return base;

  // Высокий охват + база high/medium → поднимаем на уровень (medium→high,
  // high→critical). Критическая уже на потолке и остаётся критической —
  // именно так «очень много трекеров/куки» удерживает critical, а не роняет его.
  if (isHighlyPrevalent(finding, evidence)) {
    return bumpUp(base);
  }

  // Иначе доверяем правилу: воздействие уже оценено, охват не критичен.
  return base;
}

/**
 * Широко ли распространена проблема ДАННОЙ находки по сайту?
 * Считаем только там, где охват реально измерим уликами (трекеры/куки/сеть).
 * Тип находки определяем по kind её EvidencePointer'ов — то есть «о чём» она.
 * Для бинарных находок (нет ссылки на политику, нет HTTPS) охват неинформативен
 * → всегда false (серьёзность остаётся базовой).
 */
function isHighlyPrevalent(finding: Finding, evidence: ScanEvidence): boolean {
  const kinds = new Set(finding.evidence.map((e) => e.kind));

  // Пороги «системной, а не единичной» проблемы. Откалиброваны грубо и
  // консервативно: несколько независимых трекеров либо десяток+ сторонних куки —
  // это уже поставленный на поток сбор данных, а не случайный одиночный скрипт.
  const TRACKER_COUNT_HI = 3; //   ≥3 разных трекеров
  const TRACKER_REQ_HI = 10; //    ≥10 запросов к трекерам суммарно
  const THIRD_PARTY_COOKIE_HI = 8; // ≥8 сторонних куки
  const THIRD_PARTY_REQ_HI = 20; //  ≥20 сторонних сетевых запросов

  const thirdPartyCookies = evidence.cookies.filter((c) => !c.firstParty).length;
  const trackerCount = evidence.trackers.length;
  const trackerRequests = evidence.trackers.reduce((sum, t) => sum + t.requestCount, 0);

  if (kinds.has('tracker') && (trackerCount >= TRACKER_COUNT_HI || trackerRequests >= TRACKER_REQ_HI)) {
    return true;
  }
  if (kinds.has('cookie') && thirdPartyCookies >= THIRD_PARTY_COOKIE_HI) {
    return true;
  }
  if (kinds.has('network') && evidence.network.thirdPartyRequests >= THIRD_PARTY_REQ_HI) {
    return true;
  }
  return false;
}
