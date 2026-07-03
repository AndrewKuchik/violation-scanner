// ============================================================================
// Правило: Нет информации о возврате / праве отказа — Medium.
// Гейтинг: интернет-магазины (siteType.ecommerce) без страницы/ссылки о
// возврате. Охват честно ограничен доступными страницами. Контролирует PTAC.
// ============================================================================
import {
  AUTHORITY_PTAC,
  type EvidencePointer,
  type Finding,
  type Rule,
  type ScanEvidence,
} from '@/lib/scanner/types';

const RULE_ID = 'return-policy-missing';
const TITLE = 'Не нашли условий возврата и права отказа';

const LEGAL_REFS = [
  'Consumer Rights Directive 2011/83/EU, ст.9–11',
  'Patērētāju tiesību aizsardzības likums; MK noteikumi Nr.255',
];

export const returnPolicyMissingRule: Rule = {
  id: RULE_ID,
  title: TITLE,
  legalRefs: LEGAL_REFS,
  severityBase: 'medium',

  evaluate(evidence: ScanEvidence): Finding | null {
    // Только для интернет-магазинов.
    if (!evidence.siteType.ecommerce) return null;

    const consumer = evidence.consumer;
    if (consumer.returnPolicy) return null;

    const explanation =
      'Похоже, вы продаёте товары или услуги через сайт. При покупке в интернете у клиента ' +
      'обычно есть право отказаться от заказа в течение 14 дней без объяснения причин ' +
      '(товар — вернуть, услугу — отменить). Об этом праве нужно рассказать на сайте: ' +
      'в какой срок и как это сделать. Мы не нашли такой информации на доступных нам страницах.';

    const pointers: EvidencePointer[] = [
      {
        kind: 'generic',
        label: 'Информацию о возврате / праве отказа не нашли',
        details: {
          returnPolicy: false,
          mentions14Days: consumer.mentions14Days,
          note: 'Проверено на доступных страницах — раздел мог быть в другом месте.',
        },
      },
    ];

    const remediation = [
      'Добавьте страницу «Возврат и право отказа» и дайте на неё заметную ссылку.',
      'Опишите срок (обычно 14 дней) и порядок: как оформить отказ, вернуть товар или отменить услугу.',
      'Укажите, кто оплачивает обратную доставку (для товаров) и в какой срок возвращаются деньги.',
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
        'Контролирует PTAC — риск проверки и предписания добавить информацию о праве на возврат. Проверено на доступных страницах.',
      authority: AUTHORITY_PTAC,
    };
  },
};
