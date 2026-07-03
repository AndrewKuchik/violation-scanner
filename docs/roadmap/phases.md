# Фазы разработки + СТАТУС (читай ПЕРВЫМ, вместе с `../INDEX.md`)

Легенда: ⬜ не начато · 🟡 в работе · ✅ готово

| Фаза | Что делаем | Статус | Детали в |
|---|---|---|---|
| **Ф.0 Фундамент** | docs-структура, каркас Next.js, git | ✅ | этот файл |
| **Ф.1 Скелет** | Playwright открывает URL → `{title, cookies}` | ✅ | `../modules/scanner.md` |
| **Ф.2 Сбор улик** | cookies/storage/network/trackers/consentBanner/links/tls | ✅ | `../modules/scanner.md` |
| **Ф.3 Движок правил** | 8 базовых правил (куки/согласие) | ✅ | `../modules/rules.md` |
| **Ф.4 Оценка штрафа** | диапазон € + уточняющие вопросы | ✅ | `../modules/scoring.md` |
| **Ф.5 AI-объяснения** | опц. батч-вызов Claude (по умолчанию ВЫКЛ) | ✅ | `../modules/ai-layer.md` |
| **Ф.6 UI отчёта** | вёрстка отчёта + скриншот баннера | ✅ | `../modules/report-ui.md` |
| **Ф.7 Расширенные проверки** | реквизиты/ODR/EAA/язык/e-comm + axe + качество политики (итого 16 правил) | ✅ | `../modules/rules.md`, `../product/legal-requirements.md` |
| **Ф.8 Обход нескольких страниц** | ← СЛЕДУЮЩАЯ ЗАДАЧА (Батч 2), см. ниже | ⬜ | этот файл |

## Текущее состояние (факт на 2026-07-03)
Рабочий MVP **+ расширения**. Полный пайплайн `/api/scan`: capture (Playwright) → 16 правил → severity + диапазон штрафа → (опц.) AI → сборка отчёта → JSON → рендер на клиенте.
- `npx tsc --noEmit` — чисто. `npx next build` — чисто.
- Прогоны на реальных сайтах корректны: delfi.lv (куки/трекеры/галочки + реквизиты + доступность), 220.lv (магазин), florasoundrecords.tilda.ws (реквизиты/доступность/язык/возврат/цена), stuora.lv (0 нарушений — честный результат).
- **Бэкап на GitHub:** приватный репозиторий `AndrewKuchik/violation-scanner`, ветка `master`. Пушить после значимых изменений (`git push origin master`).
- AI-слой выключен по умолчанию (работает без ключа). Включение: `AI_EXPLANATIONS_ENABLED=true` + `ANTHROPIC_API_KEY` в `.env.local`.

## Как запустить и проверить локально
1. `npm run dev` → открыть http://localhost:3000 → вставить URL → «Проверить сайт». Остановить — Ctrl+C.
2. Проверка кода: `npx tsc --noEmit`, затем `npx next build`.
3. Скан из терминала: `curl -s -X POST http://localhost:3000/api/scan -H 'Content-Type: application/json' -d '{"url":"example.com"}'`.

### ⚠️ ВАЖНО про процессы на Windows (иначе можно перегрузить машину)
Фоновый `next dev`, запущенный агентом, на Windows может **пережить** остановку обёртки и остаться «зомби» на порту 3000. Тогда новый сервер падает (`exit 1`), а накопившиеся Chromium перегружают память (однажды это потребовало жёсткой перезагрузки). Правило гигиены:
- Держи запущенным **только один** dev-сервер.
- Перед/после серии сканов убей процессы проекта и проверь порт (PowerShell):
```powershell
Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'node' -and $_.CommandLine -match 'violation-scanner' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force } catch {} }
Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue
```
- В `route.ts` стоит предохранитель `SCAN_TIMEOUT_MS = 75000` — один скан не зависнет навечно.

## Каталог из 16 правил
**8 базовых (сфера GDPR/DVI — денежные, есть диапазон €):** cookies-before-consent, tracker-before-consent, no-consent-banner, friction-asymmetry, no-reject-button, pre-ticked-boxes, missing-privacy-policy, insecure-transport, **+ privacy-policy-quality** (углублённая: содержание политики).

**8 бизнес/потребительских (`lib/rules/business/`, вне GDPR — НЕмонетарные: `monetary:false` + `riskNote` + `authority`):** imprint-missing (High, PTAC), stale-odr-link (Low, PTAC), accessibility-statement-missing (Med, EAA), accessibility-issues (axe, EAA), latvian-language-missing (Med, VVC), return-policy-missing (Med, PTAC), price-transparency (Med, PTAC).

Ключевое: бизнес-правила **гейтятся по типу сайта** (`evidence.siteType.commercial/ecommerce`), чтобы не пугать личные сайты, и формулируются условно («Похоже, вы ведёте коммерческую деятельность…»). Полный юр-разбор с законами — в `../product/legal-requirements.md`.

## ← СЛЕДУЮЩАЯ ЗАДАЧА: Ф.8 / Батч 2 — обход нескольких страниц
**Проблема:** сейчас `capture.ts` сканирует только главную. У больших сайтов реквизиты/возврат/условия лежат на отдельных страницах («Контакты», «Оферта», «Возврат», «Политика») → ложные «не нашли».
**Что сделать:**
1. После главной собрать ссылки на 2–3 ключевые внутренние страницы (эвристика по тексту/href: privacy/contacts/about/terms/return/atteikuma tiesības/sīkdatnes).
2. Зайти на них (в пределах того же домена, лимит 3–4 страницы, таймаут на каждую).
3. Перезапустить на них **текстовые** коллекторы (imprint, consumer, accessibility-statement, language) и объединить по OR («найдено, если найдено хоть на одной странице»).
4. Куки/трекеры/баннер/tls/network/axe — оставить ТОЛЬКО с главной (это про состояние до согласия / стартовую страницу).
5. Показать в отчёте, какие страницы просканированы (честность охвата).
Не забыть: рост времени скана (уложиться в `SCAN_TIMEOUT_MS`), бот-детекция на каждой странице.

## Дальнейшие идеи (после Батча 2)
Ужесточить `siteType` (услуги ≠ магазин), axe-подмножество расширить, точный ADR-орган Латвии, персонализация оценки, PDF-экспорт (см. `../product/vision.md`).

## Известные ограничения (соблюдать «не вводить в заблуждение»)
- **Наличие ≠ корректность.** Сканер видит, есть блок/ссылка или нет; не проверяет верность номера НДС, полноту политики, реальную цену. Формулировать «не нашли X», не «X неверно».
- **Одна страница** (Батч 2 частично решает).
- **axe** ловит ~30–40% проблем доступности — не полное соответствие WCAG.
- **siteType** — эвристика, иногда считает сайт-услуг «магазином».
- **ODR** отменён с 20.07.2025 → ссылка на ODR теперь СИГНАЛ устаревания, не требование.
