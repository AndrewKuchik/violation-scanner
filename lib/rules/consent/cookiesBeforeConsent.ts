// ============================================================================
// Правило 1: Куки до согласия (Critical).
// Срабатывает, если ДО согласия уже стоят сторонние куки (firstParty=false)
// или куки категорий 'analytics'/'marketing'. Улики: по одной на каждую куку.
// ============================================================================
import type { EvidencePointer, Finding, Rule, ScanEvidence } from '@/lib/scanner/types';

const TITLE = 'Куки установлены до согласия';

// Статичные ссылки на закон. Вписаны вручную, AI их не придумывает.
const LEGAL_REFS = ['ePrivacy Directive 2002/58/EC, ст. 5(3)', 'GDPR ст. 6'];

export const cookiesBeforeConsentRule: Rule = {
  id: 'cookies-before-consent',
  title: TITLE,
  legalRefs: LEGAL_REFS,
  severityBase: 'critical',

  evaluate(evidence: ScanEvidence): Finding | null {
    // Проблемные куки: сторонние ИЛИ аналитические/рекламные.
    const offending = evidence.cookies.filter(
      (c) => c.firstParty === false || c.category === 'analytics' || c.category === 'marketing',
    );
    if (offending.length === 0) return null;

    const pointers: EvidencePointer[] = offending.map((c): EvidencePointer => ({
      kind: 'cookie',
      label: `Cookie «${c.name}» с домена ${c.domain}`,
      details: {
        name: c.name,
        domain: c.domain,
        category: c.category ?? 'unknown',
        firstParty: c.firstParty,
      },
    }));

    return {
      ruleId: 'cookies-before-consent',
      title: TITLE,
      severity: 'critical',
      explanation:
        'Ещё до того как посетитель что-либо выбрал, сайт уже поставил на его устройство ' +
        'сторонние или аналитические/рекламные куки. В ЕС такие куки разрешено ставить ' +
        'только ПОСЛЕ явного согласия человека. Пока согласия нет — этих куки быть не должно.',
      legalRefs: [...LEGAL_REFS],
      evidence: pointers,
      remediation: [
        'Настройте сайт так, чтобы аналитические и рекламные куки ставились только после клика «Согласен» в баннере.',
        'Подключите инструмент управления согласием (CMP), который блокирует эти куки до выбора пользователя.',
        'Проверьте сторонние скрипты (аналитика, виджеты, реклама) — чаще всего именно они ставят куки заранее.',
      ],
      aiEnriched: false,
    };
  },
};
