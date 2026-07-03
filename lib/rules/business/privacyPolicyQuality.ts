// ============================================================================
// Правило: Политика конфиденциальности есть, но неполная по GDPR ст.13 — Medium.
// Открываем саму страницу политики (evidence.privacyPolicy) и проверяем наличие
// обязательных элементов: контролёр данных, правовое основание, права субъекта.
// Срабатывает ТОЛЬКО если политику удалось открыть (analyzed) и чего-то из этого
// не хватает. Если открыть не смогли — не срабатываем (честно, а не гадаем).
// Находка в сфере GDPR/DVI → ДЕНЕЖНАЯ: monetary не ставим (scoring посчитает €),
// authority = DVI, fineRange и aiEnriched не трогаем.
// ============================================================================
import {
  AUTHORITY_DVI,
  type EvidencePointer,
  type Finding,
  type Rule,
  type ScanEvidence,
} from '@/lib/scanner/types';

const RULE_ID = 'privacy-policy-quality';
const TITLE = 'Политика конфиденциальности неполная';

// Статичные ссылки на закон. Вписаны вручную, AI их не придумывает.
const LEGAL_REFS = ['GDPR ст.13', 'GDPR ст.6'];

export const privacyPolicyQualityRule: Rule = {
  id: RULE_ID,
  title: TITLE,
  legalRefs: LEGAL_REFS,
  severityBase: 'medium',

  evaluate(evidence: ScanEvidence): Finding | null {
    // Ссылки на политику нет — этим занимается правило «missing-privacy-policy».
    if (evidence.links.privacyPolicy.found !== true) return null;

    const pp = evidence.privacyPolicy;
    // Политику не удалось открыть/прочитать — не гадаем, честно молчим.
    if (pp.analyzed !== true) return null;

    // Не хватает хотя бы одного обязательного по ст.13 элемента?
    const missingController = pp.controllerIdentity === false;
    const missingLegalBasis = pp.legalBasis === false;
    const missingRights = pp.dataSubjectRights === false;
    if (!(missingController || missingLegalBasis || missingRights)) return null;

    // Соберём человеческий список того, чего не хватает (простыми словами).
    const missingLabels: string[] = [];
    if (missingController) missingLabels.push('кто именно обрабатывает данные (контролёр/оператор)');
    if (missingLegalBasis) missingLabels.push('на каком основании их обрабатывают (согласие, договор, законный интерес)');
    if (missingRights) missingLabels.push('какие у человека права на свои данные (доступ, удаление, возражение)');

    const explanation =
      'Политика конфиденциальности на сайте есть, но в ней не хватает обязательных по ' +
      'закону (GDPR ст.13) сведений. Мы не нашли в тексте: ' +
      missingLabels.join('; ') +
      '. Без этих сведений посетитель не понимает, кто и зачем работает с его данными и ' +
      'как он может ими распоряжаться.';

    // Что нашли, а что нет — по-русски, простыми словами.
    const has = (v: boolean) => (v ? 'нашли' : 'не нашли');
    const pointers: EvidencePointer[] = [
      {
        kind: 'link',
        label: 'Страница Политики конфиденциальности, которую проверяли',
        details: {
          url: pp.url ?? evidence.links.privacyPolicy.href ?? null,
        },
      },
      {
        kind: 'generic',
        label: 'Что проверяли в тексте политики (GDPR ст.13)',
        details: {
          controllerIdentity: `Кто обрабатывает данные (контролёр) — ${has(pp.controllerIdentity)}`,
          legalBasis: `Правовое основание обработки — ${has(pp.legalBasis)}`,
          dataSubjectRights: `Права субъекта данных — ${has(pp.dataSubjectRights)}`,
          contactInfo: `Контакт по вопросам данных — ${has(pp.contactInfo)}`,
        },
      },
    ];

    const remediation: string[] = [];
    if (missingController) {
      remediation.push(
        'Укажите, кто именно обрабатывает данные: название компании (например, SIA «…»), ' +
          'её реквизиты и контактную почту.',
      );
    }
    if (missingLegalBasis) {
      remediation.push(
        'Опишите правовое основание обработки для каждой цели: согласие, исполнение ' +
          'договора или законный интерес (GDPR ст.6).',
      );
    }
    if (missingRights) {
      remediation.push(
        'Перечислите права посетителя на его данные: доступ, исправление, удаление и ' +
          'возражение против обработки, и как ими воспользоваться.',
      );
    }
    if (pp.contactInfo === false) {
      remediation.push(
        'Добавьте контакт для вопросов о данных: электронную почту или данные ' +
          'ответственного за защиту данных (DPO).',
      );
    }

    return {
      ruleId: RULE_ID,
      title: TITLE,
      severity: 'medium',
      explanation,
      legalRefs: [...LEGAL_REFS],
      evidence: pointers,
      remediation,
      authority: AUTHORITY_DVI,
    };
  },
};
