// ============================================================================
// Реальная проверка доступности через axe-core (подмножество правил WCAG).
//
// Как это работает:
//   1. Берём исходник движка axe-core как строку (axe.source) и инъектируем его
//      прямо в страницу через page.addScriptTag({ content: axe.source }). После
//      этого в браузере появляется глобальный объект window.axe.
//   2. Внутри page.evaluate запускаем window.axe.run(...) с ограниченным набором
//      правил (runOnly) — так проверка быстрая и предсказуемая.
//   3. Из браузера возвращаем только «сжатые» нарушения { id, impact, help, nodes }
//      (nodes = число затронутых элементов), т.к. полный результат axe огромный.
//
// Функция НИКОГДА не роняет скан: любая ошибка → { checked:false, violations:[] }.
// ============================================================================
import type { Page } from 'playwright';
// Импортируем сам axe только ради axe.source — строки с исходником движка,
// которую и вставляем в страницу. Сам axe в Node здесь не исполняется.
import axe from 'axe-core';
import type { AxeResult, AxeViolation } from '@/lib/scanner/types';

/** Пустой безопасный результат (скан продолжается, даже если проверка не удалась). */
const EMPTY: AxeResult = { checked: false, violations: [] };

/** Максимум нарушений в отчёте — чтобы не раздувать данные. */
const MAX_VIOLATIONS = 15;

/** Подмножество правил axe (по темам, важным для нашего отчёта). */
const RULE_IDS = [
  'color-contrast',
  'image-alt',
  'label',
  'document-title',
  'html-has-lang',
  'heading-order',
  'link-name',
  'button-name',
  'list',
  'definition-list',
  'aria-required-attr',
];

export async function runAxe(page: Page): Promise<AxeResult> {
  try {
    // Вставляем исходник axe-core в страницу — появляется window.axe.
    await page.addScriptTag({ content: axe.source });

    // Запускаем проверку внутри браузера. Возвращаем уже «сжатые» нарушения.
    // ВАЖНО: внутри evaluate — только чистый браузерный JS (никаких TS-хелперов).
    const violations: AxeViolation[] = await page.evaluate(async (ruleIds) => {
      // axe.run возвращает Promise — дожидаемся его через await.
      const results = await (window as any).axe.run(document, {
        runOnly: { type: 'rule', values: ruleIds },
      });
      const list = (results && results.violations) || [];
      return list.map((v: any) => ({
        id: v.id,
        // impact у axe может быть null → приводим к 'minor'.
        impact: v.impact || 'minor',
        help: v.help || v.id,
        // Нам нужна только длина — сколько элементов затронуто.
        nodes: Array.isArray(v.nodes) ? v.nodes.length : 0,
      }));
    }, RULE_IDS);

    return {
      checked: true,
      violations: violations.slice(0, MAX_VIOLATIONS),
    };
  } catch {
    // Любой сбой (инъекция, таймаут, отсутствие DOM) — скан не должен падать.
    return { ...EMPTY };
  }
}
