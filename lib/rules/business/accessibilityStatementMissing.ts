// ============================================================================
// Правило: Нет заявления о доступности (EAA) — Medium.
// Гейтинг: коммерческие сайты и интернет-магазины (siteType.commercial ||
// siteType.ecommerce) без ссылки на заявление о доступности. Формулировка
// условная — EAA применяется не ко всем. Надзор — орган по доступности (EAA).
// ============================================================================
import type {
  EvidencePointer,
  Finding,
  Rule,
  ScanEvidence,
} from '@/lib/scanner/types';

const RULE_ID = 'accessibility-statement-missing';
const TITLE = 'Не нашли заявления о доступности';

const LEGAL_REFS = [
  'Directive (EU) 2019/882 (European Accessibility Act)',
  'Preču un pakalpojumu piekļūstamības likums',
];

export const accessibilityStatementMissingRule: Rule = {
  id: RULE_ID,
  title: TITLE,
  legalRefs: LEGAL_REFS,
  severityBase: 'medium',

  evaluate(evidence: ScanEvidence): Finding | null {
    const st = evidence.siteType;
    // Применяем только к коммерческим сайтам и интернет-магазинам.
    if (!(st.commercial || st.ecommerce)) return null;

    const acc = evidence.accessibility;
    if (acc.statementLink) return null;

    const explanation =
      'С июня 2025 года действует European Accessibility Act (EAA): многие цифровые ' +
      'услуги должны быть доступны людям с ограниченными возможностями, а на сайте — ' +
      'публиковаться «заявление о доступности». Под требование попадают, например, ' +
      'интернет-магазины, банковские и транспортные услуги, электронные книги. ' +
      'Если ваша услуга относится к таким, заявление о доступности обязательно — мы ' +
      'его на сайте не нашли. (Небольшие компании могут иметь послабления — проверьте, ' +
      'распространяется ли требование на вас.)';

    // Доп-сигналы доступности показываем мягко, как частичные.
    const pointers: EvidencePointer[] = [
      {
        kind: 'dom',
        label: 'Ссылку на заявление о доступности не нашли',
        details: { statementLink: false },
      },
      {
        kind: 'dom',
        label: 'Дополнительные (частичные) сигналы доступности',
        details: {
          imagesMissingAlt: acc.imagesMissingAlt,
          imagesTotal: acc.imagesTotal,
          htmlLangSet: acc.htmlLangSet,
          note: 'Это лишь частичные признаки, не полная проверка на соответствие WCAG.',
        },
      },
    ];

    const remediation = [
      'Проверьте, подпадает ли ваша услуга под EAA (интернет-магазин, банк, транспорт, э-книги и т.п.).',
      'Если да — опубликуйте страницу «Заявление о доступности» и дайте на неё ссылку в подвале.',
      'Опишите в заявлении, насколько сайт доступен и как сообщить о проблеме с доступностью.',
      'Устраните базовые барьеры: добавьте alt к картинкам, задайте язык страницы в <html lang>.',
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
        'Если услуга подпадает под EAA — риск проверки и предписания сделать сайт доступным и опубликовать заявление.',
      authority: 'Надзор по доступности (EAA)',
    };
  },
};
