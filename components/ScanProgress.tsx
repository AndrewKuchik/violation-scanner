'use client';

// Живой индикатор хода проверки. Показывает РЕАЛЬНЫЕ этапы пайплайна сканера
// (в том же порядке, что в lib/scanner/capture.ts), которые по очереди «загораются»
// галочками — чтобы ожидание не выглядело как зависший экран.
//
// Честность: этапы настоящие и в правильном порядке, но темп задаётся оценкой по
// времени (это не живой поток событий с сервера — для него понадобился бы стриминг).
// Поэтому мы НИКОГДА не показываем «готово» раньше времени: доходим до последнего
// этапа «Готовим отчёт» и держимся на нём со спиннером, пока не придёт настоящий
// ответ и страница не уйдёт на /report.
import { useEffect, useState } from 'react';

/** Этапы соответствуют реальным стадиям captureEvidence → rules → scoring → report. */
const STEPS: readonly string[] = [
  'Открываем сайт в браузере',
  'Собираем куки и запросы до согласия',
  'Проверяем баннер согласия и трекеры',
  'Ищем политику конфиденциальности и реквизиты',
  'Обходим внутренние страницы (контакты, возврат, условия)',
  'Проверяем доступность (WCAG) и язык сайта',
  'Считаем находки и возможный диапазон штрафа',
  'Готовим отчёт',
];

/** Через сколько мс переключаемся на следующий этап (подобрано под ~10–30 с скана). */
const STEP_MS = 2800;

export function ScanProgress() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      // Продвигаемся вперёд, но паркуемся на последнем этапе (не заявляем «готово»
      // раньше, чем реально вернётся отчёт).
      setActive((i) => (i < STEPS.length - 1 ? i + 1 : i));
    }, STEP_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-full max-w-md" role="status" aria-live="polite">
      <div className="mb-6 flex items-center gap-3">
        <span
          className="h-6 w-6 animate-spin rounded-full border-[3px] border-zinc-200 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100"
          aria-hidden="true"
        />
        <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Проверяю сайт…</p>
      </div>

      <ul className="space-y-2.5">
        {STEPS.map((label, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                {done ? (
                  <svg
                    viewBox="0 0 20 20"
                    className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.6 7.6a1 1 0 0 1-1.4 0L3.3 9.9a1 1 0 1 1 1.4-1.4l3.7 3.7 6.9-6.9a1 1 0 0 1 1.4 0Z" />
                  </svg>
                ) : current ? (
                  <span
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800 dark:border-zinc-600 dark:border-t-zinc-100"
                    aria-hidden="true"
                  />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" aria-hidden="true" />
                )}
              </span>
              <span
                className={
                  'leading-relaxed transition-colors ' +
                  (current
                    ? 'font-medium text-zinc-900 dark:text-zinc-100'
                    : done
                      ? 'text-zinc-600 dark:text-zinc-400'
                      : 'text-zinc-400 dark:text-zinc-500')
                }
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 text-xs text-zinc-400 dark:text-zinc-500">
        Обычно занимает 10–30 секунд. Экран не завис — сканер по-настоящему открывает сайт и его
        страницы в браузере.
      </p>
    </div>
  );
}
