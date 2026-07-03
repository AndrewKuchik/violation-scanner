// ============================================================================
// Правило 5: Нет видимой кнопки отказа (High).
// Срабатывает, если баннер есть, но кнопка «Отказаться» явно отсутствует
// (hasRejectButton === false). Если поле не заполнено — не срабатываем.
// ============================================================================
import type { EvidencePointer, Finding, Rule, ScanEvidence } from '@/lib/scanner/types';

const TITLE = 'Нет видимой кнопки отказа';

// Статичные ссылки на закон. Вписаны вручную, AI их не придумывает.
const LEGAL_REFS = ['GDPR ст. 4(11)'];

export const noRejectButtonRule: Rule = {
  id: 'no-reject-button',
  title: TITLE,
  legalRefs: LEGAL_REFS,
  severityBase: 'high',

  evaluate(evidence: ScanEvidence): Finding | null {
    const b = evidence.consentBanner;
    if (!(b.present && b.hasRejectButton === false)) return null;

    const pointers: EvidencePointer[] = [
      {
        kind: 'dom',
        label: 'Баннер согласия без кнопки «Отказаться»',
        details: {
          hasAcceptButton: b.hasAcceptButton ?? null,
          hasRejectButton: false,
          cmpVendor: b.cmpVendor ?? null,
        },
        screenshotBase64: b.screenshotBase64 ?? null,
        boundingBox: b.boundingBox ?? null,
      },
    ];

    return {
      ruleId: 'no-reject-button',
      title: TITLE,
      severity: 'high',
      explanation:
        'В баннере согласия нет заметной кнопки «Отказаться». Человек должен иметь ' +
        'возможность отказаться так же легко, как согласиться. Когда кнопки отказа нет, ' +
        'выбор становится навязанным, и согласие уже не считается свободным.',
      legalRefs: [...LEGAL_REFS],
      evidence: pointers,
      remediation: [
        'Добавьте в баннер видимую кнопку «Отказаться» рядом с кнопкой «Согласен».',
        'Кнопка отказа должна быть доступна сразу, а не спрятана в настройках.',
        'Оформите обе кнопки одинаково заметно — одинаковый размер, цвет и расположение.',
      ],
      aiEnriched: false,
    };
  },
};
