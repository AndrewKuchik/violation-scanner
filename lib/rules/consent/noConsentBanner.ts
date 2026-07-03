// ============================================================================
// Правило 3: Баннер согласия отсутствует (Critical).
// Срабатывает ТОЛЬКО когда баннер точно не найден (confidence='not-found')
// И при этом есть что регулировать (есть куки или трекеры).
// При confidence='inconclusive' возвращаем null — не даём ложное срабатывание.
// ============================================================================
import type { EvidencePointer, Finding, Rule, ScanEvidence } from '@/lib/scanner/types';

const TITLE = 'Баннер согласия отсутствует';

// Статичные ссылки на закон. Вписаны вручную, AI их не придумывает.
const LEGAL_REFS = ['ePrivacy Directive 2002/58/EC, ст. 5(3)'];

export const noConsentBannerRule: Rule = {
  id: 'no-consent-banner',
  title: TITLE,
  legalRefs: LEGAL_REFS,
  severityBase: 'critical',

  evaluate(evidence: ScanEvidence): Finding | null {
    const banner = evidence.consentBanner;
    // Есть чем управлять только если реально собираются данные.
    const hasSomethingToManage = evidence.cookies.length > 0 || evidence.trackers.length > 0;

    // Строгие условия: баннера нет, детектор уверен, и есть куки/трекеры.
    if (!(banner.present === false && banner.confidence === 'not-found' && hasSomethingToManage)) {
      return null;
    }

    const pointers: EvidencePointer[] = [
      {
        kind: 'generic',
        label: 'Баннер согласия не обнаружен, хотя данные уже собираются',
        details: {
          cookiesFound: evidence.cookies.length,
          trackersFound: evidence.trackers.length,
          bannerConfidence: banner.confidence,
        },
      },
    ];

    return {
      ruleId: 'no-consent-banner',
      title: TITLE,
      severity: 'critical',
      explanation:
        'Сайт ставит куки или запускает трекеры, но баннера с запросом согласия найти не ' +
        'удалось. Значит, у посетителя нет возможности согласиться или отказаться — а именно ' +
        'это требуется до сбора данных.',
      legalRefs: [...LEGAL_REFS],
      evidence: pointers,
      remediation: [
        'Добавьте баннер согласия, который появляется до установки аналитических и рекламных куки.',
        'Разместите в баннере равноценные кнопки «Согласен» и «Отказаться».',
        'До выбора пользователя не запускайте трекеры и не ставьте необязательные куки.',
      ],
      aiEnriched: false,
    };
  },
};
