# Архитектура: стек и поток данных

## Стек
- **Next.js 16 (App Router, TypeScript)** — фронт и бэк в одном проекте. ⚠️ см. `nextjs-notes.md`.
- **Playwright (chromium)** — headless-браузер, ловит куки/трекеры, грузящиеся ДО согласия.
- **Anthropic SDK, модель `claude-opus-4-8`** — объяснения находок (опциональный слой).
- **axe-core** — реальная проверка доступности (WCAG-подмножество), инъекция в страницу.
- **Tailwind CSS** — вёрстка отчёта.
- **Без БД и без очереди в v1.** Работает как обычный Node-процесс (`next build && next start`), НЕ serverless (у Playwright там проблемы с размером chromium и холодным стартом). Отчёт — JSON, рендерится на клиенте.

⚠️ **`next.config.ts`:** `serverExternalPackages: ['axe-core','playwright','playwright-core']` — иначе Turbopack упаковывает axe-core в бандл и теряется `axe.source` (строка движка для инъекции). Менять конфиг → перезапуск dev-сервера.

## Решённые развилки (склейка стратегии и плана)
- **Папки:** код в `app/` / `lib/` / `components/` в корне (НЕ `src/`) — так уже устроен проект.
- **AI-слой:** сделан переключаемым. По умолчанию для первой демо — **выключен** (режим «Только правила»: работает без API-ключа, мгновенно, детерминированно). Флаг `AI_EXPLANATIONS_ENABLED=true` + `ANTHROPIC_API_KEY` включает обогащение. Архитектурно оба режима — один пайплайн `Finding[]` → отчёт.

## Поток данных
```
POST /api/scan {url, companySizeTier?, repeatOffender?}
  → lib/scanner/browser.ts   запуск chromium
  → lib/scanner/capture.ts   подписка на request/response + снимок cookies ДО goto()
  → lib/scanner/evidence/*   сбор улик (ScanEvidence)
  → lib/rules/index.ts       runRules(evidence) → Finding[]
  → lib/scoring/*            severity + диапазон штрафа на каждую находку
  → lib/ai/explain.ts        (опц.) один батч-вызов Claude обогащает объяснения
  → lib/report/buildReport.ts  сборка Report
  → JSON-ответ → рендер на клиенте
```

## Карта файлов кода (актуальная, реализовано)
```
app/
  page.tsx                 форма ввода URL + уточняющие вопросы ('use client')
  api/scan/route.ts        оркестрация пайплайна (Node runtime) + SCAN_TIMEOUT_MS + гейтинг € (monetary)
  report/page.tsx          рендер отчёта (читает sessionStorage 'violation-scanner:last-report')
lib/
  scanner/
    browser.ts             запуск chromium (UA, ignoreHTTPSErrors)
    capture.ts             ⚙️ ИНТЕГРАЦИЯ: драйвит браузер, зовёт все evidence/*, собирает ScanEvidence
    types.ts               ⭐ КОНТРАКТ: ScanEvidence, Finding, Report, Rule + все под-типы + константы
    evidence/
      cookies, storage, network, trackers, tls, links, consentBanner   (базовые улики)
      siteType             умное определение коммерческого сайта (гейтинг бизнес-правил)
      imprint              реквизиты компании (SIA/рег.№/НДС/адрес/email)
      accessibility        заявление о доступности + базовые сигналы
      axeCheck             runAxe(page) — реальные нарушения WCAG через axe-core
      language             латышская версия / переключатель
      consumer             ODR-ссылка, возврат, цена+налог
      privacyPolicy        analyzePrivacyPolicy(context,url) — открывает политику, проверяет содержание
  rules/
    index.ts               реестр всех 16 правил + runRules(evidence): Finding[]
    consent/*.ts           8 базовых (GDPR/DVI, денежные)
    business/*.ts          8 бизнес/потреб. (НЕмонетарные: monetary:false + riskNote + authority)
  scoring/{severity,fineRange}.ts   severity + диапазон € (только для monetary!==false)
  ai/{explain,prompts}.ts  опц. батч Claude (по умолчанию выкл)
  report/buildReport.ts    сборка Report (сортировка, счётчики, overallRange, дисклеймер)
components/
  ScanForm.tsx  QualifyingQuestions.tsx
  report/{ReportView,ReportSummary,FindingCard,SeverityBadge,EvidencePanel,FineRangeBox,DisclaimerBanner}.tsx
```
Файлы, которые правит ТОЛЬКО интеграция (осторожно при параллельной работе): `types.ts` (контракт), `capture.ts`, `route.ts`, `rules/index.ts`.
