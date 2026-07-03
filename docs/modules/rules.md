# Модуль: Движок правил (Ф.3)

⚠️ Читай вместе с `product/legal-guardrails.md` (цитаты закона — только статичные).

## Интерфейс
Правило — обычная TS-функция с метаданными (НЕ JSON DSL — при 8–15 правилах избыточен):
```ts
interface Rule {
  id: string
  legalRefs: string[]        // статичные ссылки на статьи, вручную. AI их НЕ придумывает.
  severityBase: 'critical'|'high'|'medium'|'low'
  evaluate(evidence: ScanEvidence): Finding | null
}
```
`lib/rules/index.ts` — реестр (массив) + `runRules(evidence): Finding[]`.
Регистр массивом позволяет добавить `rules/ecommerce/*` (v1.5) и `rules/accessibility/*` (v2) без переписывания движка.

## Каталог v1 — 8 правил (все проверяемы по публичному URL без логина)
| # | Правило | Источник улик | Базовая severity | Закон |
|---|---|---|---|---|
| 1 | Куки до согласия | `cookies.ts` (снимок до взаимодействия) | Critical | ePrivacy + GDPR ст.6 |
| 2 | Известный трекер до согласия (GA/GTM/Meta Pixel) | `network.ts`+`trackers.ts` | Critical | GDPR ст.6, ePrivacy |
| 3 | Баннер согласия отсутствует | `consentBanner.ts` | Critical | ePrivacy Directive |
| 4 | Асимметрия трения (accept 1 клик, reject — много) | `consentBanner.ts` | High | GDPR ст.4(11) |
| 5 | Нет видимой кнопки отказа | `consentBanner.ts` | High | GDPR ст.4(11) |
| 6 | Предустановленные чекбоксы согласия | `consentBanner.ts` | High | GDPR ст.4(11), дело Planet49 |
| 7 | Нет/недоступна ссылка на Политику конфиденциальности | `links.ts` | Medium | GDPR ст.13 |
| 8 | Нет HTTPS / mixed content | `tls.ts` | Medium–High | GDPR ст.32 |
| 8a | **Политика есть, но неполная** (контролёр/основание/права) | `privacyPolicy.ts` | Medium | GDPR ст.13, ст.6 |

Правила 1–8a — сфера **GDPR/DVI**, ДЕНЕЖНЫЕ: scoring считает диапазон € (см. `scoring.md`).

## Каталог Ф.7 — 8 бизнес/потребительских правил (`rules/business/`)
Вне сферы GDPR/DVI → **НЕмонетарные**: правило ставит `monetary:false`, `riskNote` (качественная оценка) и `authority` (кто контролирует). `route.ts` НЕ считает € для них; UI показывает нейтральный блок «Возможные последствия» вместо штрафа. Полный юр-разбор с законами и автоматизируемостью — в `../product/legal-requirements.md`.

| Правило (id) | Улика | Severity | Кто контролирует | Гейтинг |
|---|---|---|---|---|
| imprint-missing | `imprint.ts` | High | PTAC | `siteType.commercial` |
| stale-odr-link | `consumer.ts` | Low | PTAC | ссылка на ODR найдена |
| accessibility-statement-missing | `accessibility.ts` | Medium | EAA | commercial/ecommerce |
| accessibility-issues (axe) | `axeCheck.ts` | Med–High | EAA | commercial/ecommerce |
| latvian-language-missing | `language.ts` | Medium | VVC | `siteType.commercial` |
| return-policy-missing | `consumer.ts` | Medium | PTAC | `siteType.ecommerce` |
| price-transparency | `consumer.ts` | Medium | PTAC | `siteType.ecommerce` + цены видны |

⚠️ **Честность (см. `../product/legal-guardrails.md`):** формулировки условные («Похоже, вы ведёте коммерческую деятельность…»), потому что: (1) наличие ≠ корректность; (2) требования зависят от типа сайта/сектора; (3) скан одной страницы (Батч 2 это улучшит). Гейтинг по `siteType` — чтобы не пугать личные сайты.
