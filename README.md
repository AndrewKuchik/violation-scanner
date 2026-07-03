# Violation Scanner

Сканер сайта на нарушения GDPR / ePrivacy и требований Латвии/ЕС. Вставляешь URL →
сервис открывает сайт в реальном браузере (Playwright), ловит что происходит
*на самом деле* (куки/трекеры до согласия, баннер, политика, реквизиты компании,
доступность, HTTPS) и выдаёт понятный отчёт: **что не так, где именно, во сколько может обойтись.**

## Быстрый старт
```bash
npm install
npx playwright install chromium   # если браузер ещё не скачан
npm run dev                        # → http://localhost:3000
```
Открой http://localhost:3000, вставь адрес сайта, нажми «Проверить сайт».
Остановить сервер — Ctrl+C.

AI-объяснения (Claude) по умолчанию **выключены** — сервис работает без ключа.
Включить: скопируй `.env.example` → `.env.local`, поставь `AI_EXPLANATIONS_ENABLED=true`
и `ANTHROPIC_API_KEY`.

## Документация
Не читай всё подряд. Начни с **`docs/INDEX.md`** (карта) и **`docs/roadmap/phases.md`**
(текущий статус + что делать дальше). Правила проекта для ИИ-агентов — в `AGENTS.md`.

## Стек
Next.js 16 (App Router, TS) · Playwright (chromium) · axe-core · Tailwind CSS ·
Anthropic SDK (опц.). Без БД, запускается как обычный Node-процесс.
