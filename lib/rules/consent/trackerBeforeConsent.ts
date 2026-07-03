// ============================================================================
// Правило 2: Известный трекер до согласия (Critical).
// Срабатывает, если обнаружен хотя бы один известный трекер (GA/GTM/Meta Pixel
// и т.п.), запущенный до согласия. Улики: по одной на каждый трекер.
// ============================================================================
import type { EvidencePointer, Finding, Rule, ScanEvidence } from '@/lib/scanner/types';

const TITLE = 'Трекеры запущены до согласия';

// Статичные ссылки на закон. Вписаны вручную, AI их не придумывает.
const LEGAL_REFS = ['GDPR ст. 6', 'ePrivacy Directive 2002/58/EC'];

export const trackerBeforeConsentRule: Rule = {
  id: 'tracker-before-consent',
  title: TITLE,
  legalRefs: LEGAL_REFS,
  severityBase: 'critical',

  evaluate(evidence: ScanEvidence): Finding | null {
    if (evidence.trackers.length === 0) return null;

    const pointers: EvidencePointer[] = evidence.trackers.map((t): EvidencePointer => ({
      kind: 'tracker',
      label: `${t.name} (${t.hostname})`,
      details: {
        name: t.name,
        hostname: t.hostname,
        requestCount: t.requestCount,
      },
    }));

    return {
      ruleId: 'tracker-before-consent',
      title: TITLE,
      severity: 'critical',
      explanation:
        'На странице сработали известные трекеры (например, Google Analytics, Google Tag ' +
        'Manager, Meta Pixel) ещё до того, как посетитель дал согласие. Трекеры собирают ' +
        'данные о человеке, а запускать их без предварительного согласия в ЕС нельзя.',
      legalRefs: [...LEGAL_REFS],
      evidence: pointers,
      remediation: [
        'Отложите загрузку трекеров до момента, когда пользователь нажмёт «Согласен».',
        'Если используете Google Tag Manager — настройте срабатывание тегов по сигналу согласия (Consent Mode).',
        'Убедитесь, что до согласия ни один аналитический или рекламный скрипт не выполняется.',
      ],
      aiEnriched: false,
    };
  },
};
