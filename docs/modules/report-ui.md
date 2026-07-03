# Модуль: UI отчёта (Ф.6)

⚠️ Принципы дизайна — в `product/ux-report.md`. Здесь — компоненты.

## Файлы
- `components/ScanForm.tsx` — поле URL + кнопка.
- `components/QualifyingQuestions.tsx` — свёрнуты под «Уточнить для более точной оценки».
- `components/report/`:
  - `DisclaimerBanner.tsx` — ⚠️ закреплён ВВЕРХУ (не в подвале).
  - `ReportSummary.tsx` — число находок по severity, общий диапазон риска, допущение о размере компании со ссылкой «изменить».
  - `FindingCard.tsx` — свёрнута: badge + заголовок + одна строка. Развёрнута: полное объяснение, `EvidencePanel`, цитата закона, `FineRangeBox`, шаги по исправлению.
  - `SeverityBadge.tsx`, `EvidencePanel.tsx`, `FineRangeBox.tsx`.

## Локализация «где» — главный дифференциатор
Ни один конкурент не делает толком. Для DOM-находок (баннер): подсветка рамкой через `locator.evaluate()` + `locator.screenshot()`, обрезанный по bounding box. Для cookie/скриптов: структурированные данные (имя, домен, момент появления).
