# Модуль: Сканер (сбор улик)

Задача: открыть чужой сайт в headless chromium и зафиксировать, что реально грузится **до согласия пользователя**. Это и есть основное нарушение.

## Файлы
- `lib/scanner/browser.ts` — запуск/остановка chromium.
- `lib/scanner/capture.ts` — навигация + подписка на события. **Критично:** подписаться на `page.on('request')` / `page.on('response')` и снять cookies ДО `page.goto()`, иначе пропустишь «до согласия».
- `lib/scanner/types.ts` — `ScanEvidence`, `Finding`, `Report`, `Rule`.
- `lib/scanner/evidence/`:
  - `cookies.ts` — снимок через `context.cookies()`.
  - `storage.ts` — localStorage / sessionStorage.
  - `network.ts` — лог запросов + сверка с базой трекеров.
  - `trackers.ts` — статический список доменов (GA, GTM, Meta Pixel, ...).
  - `consentBanner.ts` — эвристика CMP: селекторы известных (OneTrust, Cookiebot, Osano) + текстовые паттерны + generic. Поддержка iframe (`page.frameLocator()`) и shadow-DOM.
  - `links.ts` — наличие/доступность Privacy/Cookie Policy (+ реквизиты продавца в v1.5).
  - `tls.ts` — https + mixed content.

## Риски (обязательно обработать честно)
- **Бот-детекция** (Cloudflare блокирует headless) → отчёт пишет «скан может быть неполным», не ложное «нарушений нет».
- **Баннер в iframe/shadow-DOM** → если не пробили, писать «детекция неубедительна».
- **Тайминг** → v1 НЕ кликает «отклонить» автоматически (хрупко); фиксируем только состояние до любого взаимодействия — это уже покрывает самую частую категорию.

## Порядок (фазы Ф.1–Ф.2)
1. Ф.1: `browser.ts` + минимальный `capture.ts` → вернуть `{title, cookies}`. Доказать, что Playwright работает в процессе.
2. Ф.2: остальные `evidence/*`. Ручное тестирование на 3–5 реальных сайтах.
