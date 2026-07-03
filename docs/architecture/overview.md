# Архитектура: стек и поток данных

## Стек
- **Next.js 16 (App Router, TypeScript)** — фронт и бэк в одном проекте. ⚠️ см. `nextjs-notes.md`.
- **Playwright (chromium)** — headless-браузер, ловит куки/трекеры, грузящиеся ДО согласия.
- **Anthropic SDK, модель `claude-opus-4-8`** — объяснения находок (опциональный слой).
- **Tailwind CSS** — вёрстка отчёта.
- **Без БД и без очереди в v1.** Работает как обычный Node-процесс (`next build && next start`), НЕ serverless (у Playwright там проблемы с размером chromium и холодным стартом). Отчёт — JSON, рендерится на клиенте.

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

## Карта файлов кода (целевая, ещё не создана)
```
app/
  page.tsx                 форма ввода URL + уточняющие вопросы
  api/scan/route.ts        оркестрация пайплайна (Node runtime)
  report/page.tsx          рендер отчёта
lib/
  scanner/browser.ts capture.ts  evidence/{cookies,storage,network,trackers,consentBanner,links,tls}.ts
  scanner/types.ts         ScanEvidence, Finding, Report, Rule
  rules/index.ts  rules/consent/*.ts
  scoring/{severity,fineRange}.ts
  ai/{explain,prompts}.ts
  report/buildReport.ts
components/
  ScanForm.tsx  QualifyingQuestions.tsx
  report/{ReportSummary,FindingCard,SeverityBadge,EvidencePanel,FineRangeBox,DisclaimerBanner}.tsx
```
