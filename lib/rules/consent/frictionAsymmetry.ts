// ============================================================================
// Правило 4: Асимметрия трения (High).
// Согласиться легко (1 клик), а отказаться — сложнее или невозможно.
// Срабатывает, если есть баннер с кнопкой «Согласен», а отказ требует больше
// кликов (или кнопка отказа не найдена: rejectClicks == null).
// ============================================================================
import type { EvidencePointer, Finding, Rule, ScanEvidence } from '@/lib/scanner/types';

const TITLE = 'Отказаться сложнее, чем согласиться';

// Статичные ссылки на закон. Вписаны вручную, AI их не придумывает.
const LEGAL_REFS = ['GDPR ст. 4(11) — свободно данное согласие'];

export const frictionAsymmetryRule: Rule = {
  id: 'friction-asymmetry',
  title: TITLE,
  legalRefs: LEGAL_REFS,
  severityBase: 'high',

  evaluate(evidence: ScanEvidence): Finding | null {
    const b = evidence.consentBanner;
    if (!b.present || !b.hasAcceptButton) return null;

    // Перекос: отказ либо не найден (null), либо требует больше кликов, чем согласие.
    const asymmetric =
      b.rejectClicks == null ||
      (typeof b.rejectClicks === 'number' &&
        typeof b.acceptClicks === 'number' &&
        b.rejectClicks > b.acceptClicks);
    if (!asymmetric) return null;

    const pointers: EvidencePointer[] = [
      {
        kind: 'dom',
        label: 'Баннер согласия: отказ сложнее, чем согласие',
        details: {
          acceptClicks: b.acceptClicks ?? null,
          rejectClicks: b.rejectClicks ?? null,
          cmpVendor: b.cmpVendor ?? null,
        },
        screenshotBase64: b.screenshotBase64 ?? null,
        boundingBox: b.boundingBox ?? null,
      },
    ];

    return {
      ruleId: 'friction-asymmetry',
      title: TITLE,
      severity: 'high',
      explanation:
        'Нажать «Согласен» легко — один клик, а чтобы отказаться, нужно больше действий ' +
        '(или кнопки отказа не видно вовсе). Согласие считается настоящим только когда ' +
        'отказаться так же просто, как согласиться. Такой перекос подталкивает человека ' +
        'к согласию.',
      legalRefs: [...LEGAL_REFS],
      evidence: pointers,
      remediation: [
        'Сделайте кнопку «Отказаться» такой же заметной и доступной в один клик, как «Согласен».',
        'Не прячьте отказ во вложенные меню или раздел «Настройки».',
        'Разместите обе кнопки рядом, одинакового размера и контраста.',
      ],
      aiEnriched: false,
    };
  },
};
