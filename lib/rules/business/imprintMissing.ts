// ============================================================================
// Правило: Нет полных реквизитов компании (imprint) — High.
// Область: обязательная информация о поставщике услуг (e-Commerce Dir. ст.5).
// Гейтинг: только для коммерческих сайтов (siteType.commercial) — личные сайты
// и визитки не пугаем. Вне сферы GDPR/DVI → monetary:false, контролирует PTAC.
// ============================================================================
import {
  AUTHORITY_PTAC,
  type EvidencePointer,
  type Finding,
  type Rule,
  type ScanEvidence,
} from '@/lib/scanner/types';

const RULE_ID = 'imprint-missing';
const TITLE = 'Не нашли полных реквизитов компании';

const LEGAL_REFS = [
  'e-Commerce Directive 2000/31/EC, ст.5',
  'Informācijas sabiedrības pakalpojumu likums, §4',
];

export const imprintMissingRule: Rule = {
  id: RULE_ID,
  title: TITLE,
  legalRefs: LEGAL_REFS,
  severityBase: 'high',

  evaluate(evidence: ScanEvidence): Finding | null {
    // Только для коммерческих сайтов — иначе это требование не применяется.
    if (!evidence.siteType.commercial) return null;

    const imp = evidence.imprint;
    // Реквизиты считаем полными, если есть название, рег.номер и хотя бы
    // один способ связи (адрес или email).
    const complete =
      imp.companyName &&
      imp.registrationNumber &&
      (imp.address || imp.email);
    if (complete) return null;

    const explanation =
      'Похоже, вы ведёте коммерческую деятельность через сайт. В таком случае закон ' +
      'требует показывать посетителям реквизиты компании: название, регистрационный ' +
      'номер и способ связи (адрес или электронную почту). Мы не смогли найти на сайте ' +
      'полный набор этих данных. Без них клиенту трудно понять, с кем он имеет дело, ' +
      'и куда обращаться в спорной ситуации.';

    // Перечислим, что нашли, а что нет — по-русски, простыми словами.
    const has = (v: boolean) => (v ? 'нашли' : 'не нашли');
    const pointers: EvidencePointer[] = [
      {
        kind: 'generic',
        label: 'Что удалось найти в реквизитах',
        details: {
          companyName: `Название компании — ${has(imp.companyName)}`,
          registrationNumber: `Регистрационный номер — ${has(imp.registrationNumber)}`,
          vatNumber: `Номер НДС (PVN) — ${has(imp.vatNumber)}`,
          address: `Адрес — ${has(imp.address)}`,
          email: `Электронная почта — ${has(imp.email)}`,
        },
      },
    ];

    // Добавим примеры того, что реально нашли на странице (если есть).
    if (imp.found.length > 0) {
      const samples: Record<string, string> = {};
      for (const f of imp.found.slice(0, 5)) {
        samples[f.kind] = f.sample;
      }
      pointers.push({
        kind: 'generic',
        label: 'Примеры найденного на сайте',
        details: samples,
      });
    }

    const remediation = [
      'Добавьте на сайт блок с реквизитами компании (обычно в подвал или на страницу «Контакты»).',
      'Укажите полное название компании и её регистрационный номер (reģ. Nr).',
      'Добавьте способ связи: почтовый адрес и/или электронную почту.',
      'Если вы плательщик НДС — укажите и номер НДС (PVN).',
    ];

    return {
      ruleId: RULE_ID,
      title: TITLE,
      severity: 'high',
      explanation,
      legalRefs: [...LEGAL_REFS],
      evidence: pointers,
      remediation,
      monetary: false,
      riskNote:
        'Контролирует PTAC — риск проверки и предписания добавить недостающие реквизиты.',
      authority: AUTHORITY_PTAC,
    };
  },
};
