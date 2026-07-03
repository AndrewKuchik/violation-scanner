// ============================================================================
// Правило: Устаревшая ссылка на ODR-платформу ЕС — Low.
// Обязанность указывать ODR-платформу отменена с 20.07.2025. Если ссылка ещё
// висит на сайте — это устаревшая информация, стоит обновить. Контролирует PTAC.
// ============================================================================
import {
  AUTHORITY_PTAC,
  type EvidencePointer,
  type Finding,
  type Rule,
  type ScanEvidence,
} from '@/lib/scanner/types';

const RULE_ID = 'stale-odr-link';
const TITLE = 'Устаревшая ссылка на платформу ODR';

const LEGAL_REFS = ['Regulation (EU) 2024/3228 (отмена ODR Reg. 524/2013)'];

export const staleOdrLinkRule: Rule = {
  id: RULE_ID,
  title: TITLE,
  legalRefs: LEGAL_REFS,
  severityBase: 'low',

  evaluate(evidence: ScanEvidence): Finding | null {
    if (!evidence.consumer.staleOdrLink) return null;

    const href = evidence.consumer.staleOdrHref ?? null;

    const explanation =
      'На сайте есть ссылка на европейскую платформу разрешения споров онлайн (ODR). ' +
      'Раньше её нужно было указывать, но с 20 июля 2025 года эта обязанность отменена, ' +
      'а сама платформа больше не работает. Такая ссылка теперь просто вводит клиентов ' +
      'в заблуждение — её стоит убрать или заменить актуальной информацией.';

    const remediation = [
      'Удалите ссылку на платформу ODR (ec.europa.eu/consumers/odr) — она больше не действует.',
      'При необходимости укажите, куда клиент может обратиться со спором — например, в ' +
        'латвийский надзорный орган PTAC.',
      'Проверьте, не осталось ли упоминаний ODR в других разделах (условия, оферта, подвал).',
    ];

    const pointers: EvidencePointer[] = [
      {
        kind: 'link',
        label: 'Найдена устаревшая ссылка на ODR-платформу',
        details: { staleOdrHref: href },
      },
    ];

    return {
      ruleId: RULE_ID,
      title: TITLE,
      severity: 'low',
      explanation,
      legalRefs: [...LEGAL_REFS],
      evidence: pointers,
      remediation,
      monetary: false,
      riskNote:
        'Не штраф, но устаревшая информация для клиентов. PTAC может указать на необходимость обновить текст.',
      authority: AUTHORITY_PTAC,
    };
  },
};
