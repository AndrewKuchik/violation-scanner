'use client';

// Необязательные уточняющие вопросы: размер компании и повторность нарушения.
// Сужают диапазон штрафа. Полностью контролируемый компонент — состояние
// хранит родитель (app/page.tsx). По умолчанию ничего не выбрано: если так и
// оставить, оркестратор подставит консервативные значения по умолчанию.

import type { CompanySizeTier } from '@/lib/scanner/types';

interface QualifyingQuestionsProps {
  /** Выбранный размер компании (или null, если не выбран). */
  companySizeTier: CompanySizeTier | null;
  /** Меняет размер компании. */
  onCompanySizeTierChange: (tier: CompanySizeTier) => void;
  /** Было ли нарушение раньше. */
  repeatOffender: boolean;
  /** Меняет флаг повторности. */
  onRepeatOffenderChange: (value: boolean) => void;
}

/** Варианты размера компании. Подписи-подсказки — ориентир, не строгий критерий. */
const SIZE_OPTIONS: { value: CompanySizeTier; label: string; hint: string }[] = [
  { value: 'solo', label: 'Соло / самозанятый', hint: '1 человек' },
  { value: 'small', label: 'Малый бизнес', hint: 'примерно до 50 сотрудников' },
  { value: 'sme', label: 'Средняя компания (SME)', hint: 'примерно до 250 сотрудников' },
  { value: 'large', label: 'Крупная компания', hint: '250+ сотрудников' },
];

export function QualifyingQuestions({
  companySizeTier,
  onCompanySizeTierChange,
  repeatOffender,
  onRepeatOffenderChange,
}: QualifyingQuestionsProps) {
  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Размер компании
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SIZE_OPTIONS.map((opt) => {
            const checked = companySizeTier === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition ${
                  checked
                    ? 'border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800'
                    : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
                }`}
              >
                <input
                  type="radio"
                  name="companySize"
                  value={opt.value}
                  checked={checked}
                  onChange={() => onCompanySizeTierChange(opt.value)}
                  className="mt-0.5 h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
                />
                <span className="flex flex-col">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{opt.label}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{opt.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="flex cursor-pointer items-center gap-3 text-sm text-zinc-800 dark:text-zinc-200">
        <input
          type="checkbox"
          checked={repeatOffender}
          onChange={(e) => onRepeatOffenderChange(e.target.checked)}
          className="h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
        />
        <span>Нарушение уже было раньше</span>
      </label>
    </div>
  );
}
