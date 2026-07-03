// ============================================================================
// Ф.3: Реестр правил + движок прогона.
// Правила хранятся массивом — так в v1.5 можно добавить rules/ecommerce/* и в
// v2 rules/accessibility/* без переписывания движка.
// Порядок в массиве не важен: сборщик отчёта сам сортирует находки по severity.
// ============================================================================
import type { Finding, Rule, ScanEvidence } from '@/lib/scanner/types';
import { cookiesBeforeConsentRule } from './consent/cookiesBeforeConsent';
import { trackerBeforeConsentRule } from './consent/trackerBeforeConsent';
import { noConsentBannerRule } from './consent/noConsentBanner';
import { frictionAsymmetryRule } from './consent/frictionAsymmetry';
import { noRejectButtonRule } from './consent/noRejectButton';
import { preTickedBoxesRule } from './consent/preTickedBoxes';
import { missingPrivacyPolicyRule } from './consent/missingPrivacyPolicy';
import { insecureTransportRule } from './consent/insecureTransport';
// Бизнес/потребительские правила (вне сферы GDPR/DVI — monetary:false).
import { imprintMissingRule } from './business/imprintMissing';
import { staleOdrLinkRule } from './business/staleOdrLink';
import { accessibilityStatementMissingRule } from './business/accessibilityStatementMissing';
import { latvianLanguageMissingRule } from './business/latvianLanguageMissing';
import { returnPolicyMissingRule } from './business/returnPolicyMissing';
import { priceTransparencyRule } from './business/priceTransparency';
// Углублённые проверки (Батч 2): содержание политики + реальная доступность (axe).
import { privacyPolicyQualityRule } from './business/privacyPolicyQuality';
import { accessibilityIssuesRule } from './business/accessibilityIssues';

/** Все правила v1. Каждое — чистая функция evaluate() с метаданными. */
export const rules: Rule[] = [
  cookiesBeforeConsentRule,
  trackerBeforeConsentRule,
  noConsentBannerRule,
  frictionAsymmetryRule,
  noRejectButtonRule,
  preTickedBoxesRule,
  missingPrivacyPolicyRule,
  insecureTransportRule,
  // --- Бизнес/потребительские (v1.5) ---
  imprintMissingRule,
  staleOdrLinkRule,
  accessibilityStatementMissingRule,
  latvianLanguageMissingRule,
  returnPolicyMissingRule,
  priceTransparencyRule,
  // --- Углублённые ---
  privacyPolicyQualityRule,
  accessibilityIssuesRule,
];

/** Прогоняет все правила по уликам и собирает сработавшие находки (null отбрасываем). */
export function runRules(evidence: ScanEvidence): Finding[] {
  const findings: Finding[] = [];
  for (const rule of rules) {
    const finding = rule.evaluate(evidence);
    if (finding) findings.push(finding);
  }
  return findings;
}
