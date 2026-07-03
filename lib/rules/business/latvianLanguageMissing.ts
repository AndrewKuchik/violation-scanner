// ============================================================================
// Правило: Нет латышской версии сайта — Medium.
// Гейтинг: коммерческие сайты (siteType.commercial) без латышской версии.
// Потребительская информация должна быть доступна на гос. языке (латышском).
// Надзор — Центр государственного языка (VVC).
// ============================================================================
import type {
  EvidencePointer,
  Finding,
  Rule,
  ScanEvidence,
} from '@/lib/scanner/types';

const RULE_ID = 'latvian-language-missing';
const TITLE = 'Не нашли версии сайта на латышском';

const LEGAL_REFS = ['Valsts valodas likums, §21'];

export const latvianLanguageMissingRule: Rule = {
  id: RULE_ID,
  title: TITLE,
  legalRefs: LEGAL_REFS,
  severityBase: 'medium',

  evaluate(evidence: ScanEvidence): Finding | null {
    // Только для коммерческих сайтов.
    if (!evidence.siteType.commercial) return null;

    const lang = evidence.language;
    if (lang.latvianAvailable) return null;

    const explanation =
      'В Латвии информация для потребителей должна быть доступна на государственном ' +
      'языке — латышском. Если вы предлагаете товары или услуги, посетитель вправе ' +
      'получить сведения о них по-латышски. Мы не нашли на сайте латышской версии. ' +
      'Другие языки можно оставить дополнительно, но латышский должен быть.';

    const pointers: EvidencePointer[] = [
      {
        kind: 'dom',
        label: 'Латышскую версию сайта не нашли',
        details: {
          htmlLang: lang.htmlLang ?? null,
          hasLanguageSwitcher: lang.hasLanguageSwitcher,
        },
      },
    ];

    const remediation = [
      'Сделайте латышскую версию сайта (хотя бы для основной информации о товарах и услугах).',
      'Добавьте переключатель языков, чтобы посетитель мог выбрать латышский.',
      'Убедитесь, что важные для клиента разделы (цены, условия, контакты) есть на латышском.',
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
        'Контролирует Центр государственного языка (VVC) — риск проверки и предписания добавить латышскую версию.',
      authority: 'Valsts valodas centrs (VVC)',
    };
  },
};
