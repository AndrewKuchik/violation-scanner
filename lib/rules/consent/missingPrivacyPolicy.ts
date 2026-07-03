// ============================================================================
// Правило 7: Нет/недоступна ссылка на Политику конфиденциальности (Medium).
// Срабатывает, если ссылка не найдена (found === false) ИЛИ найдена, но
// страница не открывается (reachable === false).
// ============================================================================
import type { EvidencePointer, Finding, Rule, ScanEvidence } from '@/lib/scanner/types';

const TITLE = 'Нет доступной Политики конфиденциальности';

// Статичные ссылки на закон. Вписаны вручную, AI их не придумывает.
const LEGAL_REFS = ['GDPR ст. 13'];

export const missingPrivacyPolicyRule: Rule = {
  id: 'missing-privacy-policy',
  title: TITLE,
  legalRefs: LEGAL_REFS,
  severityBase: 'medium',

  evaluate(evidence: ScanEvidence): Finding | null {
    const pp = evidence.links.privacyPolicy;
    const notFound = pp.found === false;
    const unreachable = pp.reachable === false;
    if (!(notFound || unreachable)) return null;

    // Текст подбираем под ситуацию: совсем нет ссылки vs. ссылка есть, но не открывается.
    const explanation = notFound
      ? 'На сайте не удалось найти ссылку на Политику конфиденциальности. Этот документ ' +
        'обязателен: он объясняет посетителям, какие данные вы собираете и зачем. Без него ' +
        'человек не знает, что происходит с его данными.'
      : 'Ссылка на Политику конфиденциальности есть, но страница по ней не открывается. ' +
        'Для посетителя это то же самое, что политики нет — он не может узнать, как вы ' +
        'обращаетесь с его данными.';

    const remediation = notFound
      ? [
          'Опубликуйте страницу с Политикой конфиденциальности.',
          'Добавьте ссылку на неё в подвал сайта, чтобы она была на каждой странице.',
          'Опишите в политике, какие данные и зачем вы собираете и как с вами связаться.',
        ]
      : [
          'Проверьте ссылку на Политику конфиденциальности — сейчас страница не открывается.',
          'Исправьте адрес или восстановите страницу, чтобы она стала доступной.',
          'Убедитесь, что ссылка ведёт на рабочую страницу с актуальным текстом.',
        ];

    const pointers: EvidencePointer[] = [
      {
        kind: 'link',
        label: notFound
          ? 'Ссылка на Политику конфиденциальности не найдена'
          : 'Ссылка на Политику конфиденциальности недоступна',
        details: {
          found: pp.found,
          href: pp.href ?? null,
          reachable: pp.reachable ?? null,
        },
      },
    ];

    return {
      ruleId: 'missing-privacy-policy',
      title: TITLE,
      severity: 'medium',
      explanation,
      legalRefs: [...LEGAL_REFS],
      evidence: pointers,
      remediation,
      aiEnriched: false,
    };
  },
};
