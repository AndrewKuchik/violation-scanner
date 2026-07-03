// ============================================================================
// Правило: Цена без указания налога/доставки — Medium.
// Гейтинг: интернет-магазин (siteType.ecommerce), цены видны (pricesVisible),
// но рядом нет указания налога (priceTaxWording === false). Контролирует PTAC.
// ============================================================================
import {
  AUTHORITY_PTAC,
  type EvidencePointer,
  type Finding,
  type Rule,
  type ScanEvidence,
} from '@/lib/scanner/types';

const RULE_ID = 'price-transparency';
const TITLE = 'У цен не указан налог (НДС) и доставка';

const LEGAL_REFS = [
  'Consumer Rights Directive 2011/83/EU, ст.6',
  'Patērētāju tiesību aizsardzības likums',
];

export const priceTransparencyRule: Rule = {
  id: RULE_ID,
  title: TITLE,
  legalRefs: LEGAL_REFS,
  severityBase: 'medium',

  evaluate(evidence: ScanEvidence): Finding | null {
    const st = evidence.siteType;
    const consumer = evidence.consumer;
    // Только интернет-магазин, где видны цены, но нет указания налога.
    if (!st.ecommerce) return null;
    if (!consumer.pricesVisible) return null;
    if (consumer.priceTaxWording) return null;

    const explanation =
      'На сайте видны цены, но рядом с ними мы не нашли указания, что цена включает ' +
      'налог (НДС / PVN). Покупателю нужно сразу видеть полную цену — с налогом и с ' +
      'учётом стоимости доставки, чтобы не столкнуться с доплатой на кассе. Уточните ' +
      'у цен, что это цена «с НДС», и покажите стоимость доставки до оформления заказа.';

    const pointers: EvidencePointer[] = [
      {
        kind: 'generic',
        label: 'Цены видны, но указания налога рядом не нашли',
        details: {
          pricesVisible: consumer.pricesVisible,
          priceTaxWording: consumer.priceTaxWording,
        },
      },
    ];

    const remediation = [
      'Показывайте цену для покупателя сразу с налогом (например, пометка «с НДС» / «ar PVN»).',
      'Указывайте стоимость доставки до оформления заказа, а не только на последнем шаге.',
      'Если цена без налога — рядом ясно поясните это, чтобы не вводить покупателя в заблуждение.',
    ];

    return {
      ruleId: RULE_ID,
      title: TITLE,
      severity: 'medium',
      explanation,
      legalRefs: [...LEGAL_REFS],
      evidence: pointers,
      remediation,
      monetary: false,
      riskNote:
        'Контролирует PTAC — риск проверки и предписания показывать полную цену с налогом и доставкой.',
      authority: AUTHORITY_PTAC,
    };
  },
};
