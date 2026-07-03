// ============================================================================
// Правило: Реальные проблемы доступности (EAA) — по результатам axe-core.
//
// В отличие от accessibilityStatementMissing (проверяет лишь наличие ссылки),
// это правило смотрит на настоящие нарушения, найденные движком axe-core:
// низкий контраст, картинки без описания, поля форм без меток и т.п.
//
// Гейтинг: только коммерческие сайты и интернет-магазины (commercial || ecommerce).
// Немонетарная находка (вне сферы GDPR/DVI): monetary:false — считаем не €,
// а регуляторный риск по EAA. Формулировка условная (EAA применяется не ко всем).
// ============================================================================
import type {
  AxeViolation,
  EvidencePointer,
  Finding,
  Rule,
  ScanEvidence,
} from '@/lib/scanner/types';

const RULE_ID = 'accessibility-issues';
const TITLE = 'Нашли реальные проблемы доступности';

const LEGAL_REFS = [
  'Directive (EU) 2019/882 (EAA)',
  'EN 301 549 / WCAG 2.1',
];

// Уровни серьёзности axe, которые считаем «настоящей» проблемой (для срабатывания).
// 'minor' игнорируем — мелочь не должна поднимать находку.
const TRIGGERING_IMPACTS = ['serious', 'critical', 'moderate'];

/** Человеческий перевод уровня серьёзности axe. */
function impactLabel(impact: string): string {
  switch (impact) {
    case 'critical':
      return 'критично';
    case 'serious':
      return 'серьёзно';
    case 'moderate':
      return 'умеренно';
    default:
      return 'незначительно';
  }
}

export const accessibilityIssuesRule: Rule = {
  id: RULE_ID,
  title: TITLE,
  legalRefs: LEGAL_REFS,
  severityBase: 'medium',

  evaluate(evidence: ScanEvidence): Finding | null {
    const st = evidence.siteType;
    // Применяем только к коммерческим сайтам и интернет-магазинам.
    if (!(st.commercial || st.ecommerce)) return null;

    const axeResult = evidence.accessibility.axe;
    // Правило работает только если axe реально отработал.
    if (!axeResult || axeResult.checked !== true) return null;

    // Оставляем только значимые нарушения (без 'minor').
    const significant: AxeViolation[] = axeResult.violations.filter((v) =>
      TRIGGERING_IMPACTS.includes(v.impact),
    );
    if (significant.length === 0) return null;

    const hasCriticalOrSerious = significant.some(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    const severity = hasCriticalOrSerious ? 'high' : 'medium';

    const explanation =
      'На сайте есть реальные проблемы доступности — людям с ограниченными ' +
      'возможностями трудно им пользоваться. Мы проверили страницу автоматическим ' +
      'движком (axe-core) и нашли конкретные барьеры: например низкий контраст текста, ' +
      'картинки без текстового описания, поля форм без подписей. Если ваша услуга ' +
      'подпадает под European Accessibility Act (интернет-магазин, банк, транспорт, ' +
      'э-книги и т.п.), такие барьеры нужно устранить. (Небольшие компании могут иметь ' +
      'послабления — проверьте, распространяется ли требование на вас.)';

    // Каждое нарушение — отдельная улика: что не так + сколько элементов + серьёзность.
    const pointers: EvidencePointer[] = significant.map((v) => ({
      kind: 'generic',
      label: `${v.help} — затронуто элементов: ${v.nodes} (${impactLabel(v.impact)})`,
      details: {
        rule: v.id,
        impact: v.impact,
        elements: v.nodes,
      },
    }));

    const remediation = [
      'Обеспечьте достаточный контраст текста и фона (обычно не ниже 4.5:1).',
      'Добавьте осмысленный alt ко всем содержательным картинкам.',
      'Свяжите каждое поле формы с подписью (<label> или aria-label).',
      'Задайте язык страницы в <html lang="…"> и осмысленный заголовок <title>.',
      'Проверьте порядок заголовков и понятные названия ссылок и кнопок.',
      'После правок перепроверьте сайт инструментом доступности (например axe DevTools).',
    ];

    return {
      ruleId: RULE_ID,
      title: TITLE,
      severity,
      explanation,
      legalRefs: [...LEGAL_REFS],
      evidence: pointers,
      remediation,
      monetary: false,
      riskNote:
        'Если услуга подпадает под EAA — риск проверки и предписания устранить барьеры доступности. ' +
        'Это регуляторный риск (надзор по доступности), а не денежный штраф GDPR.',
      authority: 'Надзор по доступности (EAA)',
    };
  },
};
