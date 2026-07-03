// ============================================================================
// Промпты и JSON-схема для AI-слоя (Ф.5, опциональное обогащение объяснений).
// Модель ТОЛЬКО перефразирует находки простым русским + даёт шаги по исправлению.
// Юридические ссылки (legalRefs) статичны и приходят из правил — модель их не
// трогает и не придумывает. Guardrails — см. docs/product/legal-guardrails.md.
// ============================================================================

import type { Finding, ScanEvidence } from '@/lib/scanner/types';

/**
 * Системный промпт. Задаёт роль, тон и ЖЁСТКИЕ юридические ограничители.
 * Структурированный вывод дополнительно гарантируется JSON-схемой (RESPONSE_SCHEMA),
 * но правила о содержании должны жить именно в промпте.
 */
export const SYSTEM_PROMPT: string = [
  'Ты помогаешь владельцу небольшого сайта понять результаты проверки на соответствие',
  'требованиям к приватности (куки, согласие, GDPR и т.п.). У владельца НЕТ юридического',
  'образования — пиши так, чтобы понял обычный человек.',
  '',
  'Для КАЖДОЙ переданной находки сделай две вещи:',
  '1) Перепиши объяснение (поле explanation) простым, дружелюбным русским языком: коротко',
  '   (1–3 предложения), спокойно, без жаргона и запугивания, по существу проблемы.',
  '2) Дай конкретные, выполнимые шаги по исправлению (remediation) — по пунктам, что именно',
  '   сделать. Опирайся на переданные улики (evidence).',
  '',
  'СТРОГИЕ ПРАВИЛА (нарушать нельзя):',
  '- Ссылки на закон (legalRefs) уже заданы и статичны. НИКОГДА не придумывай и не упоминай',
  '  номера статей, названия законов или регламентов, которых нет во входных данных. Ничего',
  '  не добавляй, не меняй и не «уточняй» в юридических ссылках. В самом объяснении номера',
  '  статей цитировать не нужно — их подставит отчёт отдельно.',
  '- НИКОГДА не обещай соответствие закону. Запрещены любые формулировки вроде «вы соответствуете',
  '  закону», «теперь вы в порядке с законом», «100% соответствие», «полное соответствие»,',
  '  «сертифицировано», «гарантирует соответствие». Разрешено говорить только про конкретную',
  '  проблему: «эта проблема будет устранена», «риск снизится».',
  '- Не выдумывай новые находки и не выбрасывай существующие: обработай ровно те, что переданы.',
  '- ruleId каждой находки сохраняй БЕЗ ИЗМЕНЕНИЙ — по нему идёт сопоставление.',
  '- Пиши только на русском.',
  '',
  'Ответ верни СТРОГО как валидный JSON по заданной схеме (объект с полем findings). Никакого',
  'текста вне JSON, без пояснений и без обрамления в markdown.',
].join('\n');

/**
 * JSON Schema ожидаемого ответа модели.
 * Форма: { findings: [{ ruleId: string, explanation: string, remediation: string[] }] }.
 * additionalProperties:false + required — для строгого структурированного вывода
 * (output_config.format {type:'json_schema'}) и надёжного маппинга обратно по ruleId.
 */
export const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      description: 'По одному элементу на каждую переданную находку.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['ruleId', 'explanation', 'remediation'],
        properties: {
          ruleId: {
            type: 'string',
            description: 'Идентификатор находки. Скопируй БЕЗ изменений из входных данных.',
          },
          explanation: {
            type: 'string',
            description:
              'Короткое дружелюбное объяснение проблемы простым русским. Без обещаний соответствия закону.',
          },
          remediation: {
            type: 'array',
            items: { type: 'string' },
            description: 'Конкретные шаги по исправлению, по пунктам.',
          },
        },
      },
    },
  },
};

/**
 * Компактный JSON-текст для модели: находки (ruleId, title, текущее explanation,
 * legalRefs, ключевые улики) + краткая сводка по сайту для контекста.
 * Без отступов — экономим токены. Скриншоты/боксы в улики не кладём (модели не нужны).
 */
export function buildUserPayload(findings: Finding[], evidence: ScanEvidence): string {
  const payload = {
    // Краткий контекст сканирования — помогает писать точные шаги исправления.
    site: {
      url: evidence.meta.url,
      finalUrl: evidence.meta.finalUrl,
      title: evidence.meta.title,
      https: evidence.tls.https,
      incompleteReason: evidence.meta.incompleteReason ?? null,
      consentBanner: {
        present: evidence.consentBanner.present,
        confidence: evidence.consentBanner.confidence,
        hasRejectButton: evidence.consentBanner.hasRejectButton ?? null,
      },
      counts: {
        cookiesBeforeConsent: evidence.cookies.length,
        trackers: evidence.trackers.length,
        thirdPartyRequests: evidence.network.thirdPartyRequests,
      },
    },
    findings: findings.map((f) => ({
      ruleId: f.ruleId,
      title: f.title,
      severity: f.severity,
      currentExplanation: f.explanation,
      legalRefs: f.legalRefs,
      // Ключевые улики находки: только текстовая суть (kind/label/details).
      evidence: f.evidence.map((e) => ({
        kind: e.kind,
        label: e.label,
        details: e.details ?? undefined,
      })),
    })),
  };

  return JSON.stringify(payload);
}
