// ============================================================================
// Правило 6: Предустановленные («заранее отмеченные») чекбоксы согласия (High).
// Срабатывает, если баннер есть и в нём есть заранее проставленные галочки
// (preTickedBoxes === true).
// ============================================================================
import type { EvidencePointer, Finding, Rule, ScanEvidence } from '@/lib/scanner/types';

const TITLE = 'Заранее отмеченные галочки согласия';

// Статичные ссылки на закон. Вписаны вручную, AI их не придумывает.
const LEGAL_REFS = ['GDPR ст. 4(11)', 'Planet49, CJEU C-673/17'];

export const preTickedBoxesRule: Rule = {
  id: 'pre-ticked-boxes',
  title: TITLE,
  legalRefs: LEGAL_REFS,
  severityBase: 'high',

  evaluate(evidence: ScanEvidence): Finding | null {
    const b = evidence.consentBanner;
    if (!(b.present && b.preTickedBoxes === true)) return null;

    const pointers: EvidencePointer[] = [
      {
        kind: 'dom',
        label: 'Баннер с заранее отмеченными галочками согласия',
        details: {
          preTickedBoxes: true,
          cmpVendor: b.cmpVendor ?? null,
        },
        screenshotBase64: b.screenshotBase64 ?? null,
        boundingBox: b.boundingBox ?? null,
      },
    ];

    return {
      ruleId: 'pre-ticked-boxes',
      title: TITLE,
      severity: 'high',
      explanation:
        'В баннере есть заранее отмеченные («предустановленные») галочки согласия. ' +
        'По решению суда ЕС (дело Planet49) заранее проставленная галочка согласием не ' +
        'считается — человек должен отметить её сам. По умолчанию такие галочки должны ' +
        'быть пустыми.',
      legalRefs: [...LEGAL_REFS],
      evidence: pointers,
      remediation: [
        'Снимите все галочки согласия по умолчанию — пусть пользователь ставит их сам.',
        'Необязательные категории (аналитика, реклама) должны быть выключены, пока человек их не включил.',
        'Оставляйте включёнными только строго необходимые функции сайта.',
      ],
      aiEnriched: false,
    };
  },
};
