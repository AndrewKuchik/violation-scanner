// ============================================================================
// AI-слой: батч-обогащение объяснений находок (Ф.5, опционально).
// По умолчанию ВЫКЛЮЧЕН (режим «Только правила»). Скан НИКОГДА не должен падать
// из-за AI: при любой ошибке возвращаем исходные находки без изменений.
//
// Механизм структурированного вывода: нативный output_config.format
// {type:'json_schema', schema} — он поддержан в установленном @anthropic-ai/sdk@0.109.1
// (см. OutputConfig/JSONOutputFormat в типах SDK), поэтому обходной путь не нужен.
// Модель: claude-opus-4-8.
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';
import type { Finding, ScanEvidence } from '@/lib/scanner/types';
import { SYSTEM_PROMPT, RESPONSE_SCHEMA, buildUserPayload } from './prompts';

const MODEL = 'claude-opus-4-8';
/** Таймаут одного запроса; с maxRetries худший случай ≈ таймаут × (retries+1). */
const REQUEST_TIMEOUT_MS = 45_000;
/** Потолок вывода. Non-streaming безопасен; при обрезке парсинг упадёт → вернём оригиналы. */
const MAX_TOKENS = 8192;

/**
 * AI-слой включён? Дефолт — выключен (нужны обе переменные окружения).
 */
export function isAiEnabled(): boolean {
  return process.env.AI_EXPLANATIONS_ENABLED === 'true' && !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Один батч-запрос к модели: перефразирует explanation и remediation по всем находкам.
 * legalRefs НЕ трогаем (остаются статичными из правил). aiEnriched:true ставим только
 * тем находкам, для которых модель вернула валидную запись по ruleId.
 * При !isAiEnabled() или ЛЮБОЙ ошибке — возвращаем findings без изменений.
 */
export async function enrichFindings(
  findings: Finding[],
  evidence: ScanEvidence,
): Promise<Finding[]> {
  if (!isAiEnabled()) return findings;
  if (findings.length === 0) return findings;

  try {
    // Клиент создаём лениво: ключ читается из env (ANTHROPIC_API_KEY) внутри функции.
    const client = new Anthropic({ timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      output_config: {
        // Задача — простое перефразирование; low снижает задержку и стоимость батча.
        effort: 'low',
        // Строгий структурированный вывод по нашей JSON-схеме.
        format: { type: 'json_schema', schema: RESPONSE_SCHEMA },
      },
      messages: [{ role: 'user', content: buildUserPayload(findings, evidence) }],
    });

    // Safety-классификатор мог отклонить запрос — контента нет, идём на оригиналы.
    if (response.stop_reason === 'refusal') {
      console.warn('[ai] enrichFindings: запрос отклонён моделью (refusal) — оставляю исходные находки');
      return findings;
    }

    // Собираем текст из text-блоков ответа.
    let rawText = '';
    for (const block of response.content) {
      if (block.type === 'text') rawText += block.text;
    }

    const aiFindings = parseFindingsArray(rawText);
    if (!aiFindings) {
      console.warn('[ai] enrichFindings: не удалось разобрать ответ модели — оставляю исходные находки');
      return findings;
    }

    // Индекс ответов модели по ruleId.
    const byId = new Map<string, { explanation?: unknown; remediation?: unknown }>();
    for (const raw of aiFindings) {
      if (raw && typeof raw === 'object') {
        const item = raw as { ruleId?: unknown; explanation?: unknown; remediation?: unknown };
        if (typeof item.ruleId === 'string') byId.set(item.ruleId, item);
      }
    }

    // Маппинг обратно на находки. Перезаписываем ТОЛЬКО explanation/remediation.
    return findings.map((f) => {
      const ai = byId.get(f.ruleId);
      if (!ai) return f;

      const explanation =
        typeof ai.explanation === 'string' && ai.explanation.trim().length > 0
          ? ai.explanation.trim()
          : f.explanation;

      const remediation =
        Array.isArray(ai.remediation) &&
        ai.remediation.length > 0 &&
        ai.remediation.every((s) => typeof s === 'string' && s.trim().length > 0)
          ? (ai.remediation as string[])
          : f.remediation;

      // legalRefs НЕ трогаем — статичные из правила.
      return { ...f, explanation, remediation, aiEnriched: true };
    });
  } catch (err) {
    // Сеть / таймаут / парсинг / валидация — любая ошибка не должна ронять скан.
    console.warn('[ai] enrichFindings: ошибка AI-обогащения — оставляю исходные находки:', err);
    return findings;
  }
}

/**
 * Достаёт массив findings из ответа модели.
 * Сначала пробуем распарсить весь текст; если модель обрамила JSON (markdown/текст) —
 * вырезаем объект по крайним фигурным скобкам. Возвращает массив или null.
 */
function parseFindingsArray(rawText: string): unknown[] | null {
  const text = rawText.trim();
  if (!text) return null;

  const tryParse = (s: string): unknown | undefined => {
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };

  let data = tryParse(text);
  if (data === undefined) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) data = tryParse(text.slice(start, end + 1));
  }

  if (!data || typeof data !== 'object') return null;
  const findings = (data as Record<string, unknown>).findings;
  return Array.isArray(findings) ? findings : null;
}
