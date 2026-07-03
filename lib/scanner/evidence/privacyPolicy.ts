// ============================================================================
// Коллектор улик: качество страницы Политики конфиденциальности (питает правило
// «privacy-policy-quality»). Открывает саму страницу политики (по ссылке из
// links.ts) в НОВОЙ вкладке того же контекста, снимает текст и ищет обязательные
// по GDPR ст.13 элементы: контролёр данных, правовое основание, права субъекта,
// контакт. Многоязычно (LV/EN/RU), регистронезависимо. Всё в try/catch — сбой
// анализа НИКОГДА не роняет скан (при ошибке analyzed:false, все флаги false).
// ============================================================================
import type { BrowserContext } from 'playwright';
import type { PrivacyPolicyEvidence } from '@/lib/scanner/types';

/** Ограничение на размер снимаемого текста (~300 КБ) — защита от гигантских страниц. */
const MAX_TEXT_LENGTH = 300_000;

/**
 * Паттерны «контролёр/оператор данных» (нижний регистр).
 * LV: pārzinis; EN: controller / data controller; RU: контролёр / оператор данных.
 */
const CONTROLLER_PATTERNS: readonly string[] = [
  'pārzinis',
  'parzinis',
  'controller',
  'data controller',
  'контролёр',
  'контролер',
  'оператор персональных данных',
  'оператор данных',
];

/**
 * Паттерны правового основания обработки (GDPR ст.6).
 * LV: tiesiskais pamats, piekrišana, līgum, leģitīm; EN: legal basis, consent,
 * contract, legitimate interest, article 6; RU: согласие, договор, законный интерес, ст. 6.
 */
const LEGAL_BASIS_PATTERNS: readonly string[] = [
  'tiesiskais pamats',
  'legal basis',
  'consent',
  'piekrišana',
  'piekrisana',
  'līgum',
  'ligum',
  'contract',
  'legitimate interest',
  'leģitīm',
  'legitim',
  'согласие',
  'договор',
  'законный интерес',
  'article 6',
  'ст. 6',
  'ст.6',
];

/**
 * Паттерны прав субъекта данных (GDPR ст.15–21).
 * LV: tiesības, VDAR; EN: right to access, erasure, delete, rectification,
 * objection, GDPR; RU: права субъекта, право на доступ/удаление/возражение.
 */
const RIGHTS_PATTERNS: readonly string[] = [
  'tiesības',
  'tiesibas',
  'right to access',
  'erasure',
  'delete',
  'rectification',
  'objection',
  'права субъекта',
  'право на доступ',
  'право на удаление',
  'право на возражение',
  'gdpr',
  'vdar',
];

/**
 * Паттерны контакта по вопросам данных (кроме e-mail, который ищем отдельно).
 * LV: datu aizsardzības speciālists; EN: DPO, data protection officer;
 * RU: контакт по вопросам.
 */
const CONTACT_PATTERNS: readonly string[] = [
  'dpo',
  'data protection officer',
  'datu aizsardzības speciālists',
  'datu aizsardzibas specialists',
  'контакт по вопросам',
];

/** Юридические формы латвийских компаний (для эвристики контролёра). */
const LEGAL_FORM_PATTERNS: readonly string[] = ['sia', 'as'];

/** Грубый детектор e-mail на странице. */
const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

/** Встречается ли хоть один паттерн в строке-стоге. */
function matchesAny(haystack: string, patterns: readonly string[]): boolean {
  return patterns.some((p) => haystack.includes(p));
}

/**
 * Открывает страницу политики и проверяет наличие обязательных элементов GDPR ст.13.
 * Если policyUrl пустой — возвращает «не анализировано» без открытия браузера.
 * Любая ошибка → analyzed:false и все флаги false (честно: не смогли проверить).
 */
export async function analyzePrivacyPolicy(
  context: BrowserContext,
  policyUrl: string | null,
): Promise<PrivacyPolicyEvidence> {
  // Пустой URL — политику не открываем, честно отдаём «не анализировано».
  if (!policyUrl) {
    return {
      analyzed: false,
      url: policyUrl ?? null,
      controllerIdentity: false,
      legalBasis: false,
      dataSubjectRights: false,
      contactInfo: false,
    };
  }

  // Результат по умолчанию — на случай любого сбоя ниже.
  const fallback: PrivacyPolicyEvidence = {
    analyzed: false,
    url: policyUrl,
    controllerIdentity: false,
    legalBasis: false,
    dataSubjectRights: false,
    contactInfo: false,
  };

  const page = await context.newPage().catch(() => null);
  if (!page) return fallback;

  try {
    await page.goto(policyUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });

    // Снимаем видимый текст страницы (не HTML) и ограничиваем размер.
    const rawText = await page.evaluate(() => document.body.innerText || '');
    const text = rawText.slice(0, MAX_TEXT_LENGTH);

    // Пустой текст — считаем, что прочитать не удалось.
    if (!text.trim()) return fallback;

    const haystack = text.toLowerCase();

    // Контролёр: явное упоминание ИЛИ юрформа (SIA/AS) рядом с e-mail на странице.
    const hasEmail = EMAIL_REGEX.test(text);
    const controllerIdentity =
      matchesAny(haystack, CONTROLLER_PATTERNS) ||
      (matchesAny(haystack, LEGAL_FORM_PATTERNS) && hasEmail);

    const legalBasis = matchesAny(haystack, LEGAL_BASIS_PATTERNS);
    const dataSubjectRights = matchesAny(haystack, RIGHTS_PATTERNS);
    // Контакт: e-mail на странице ИЛИ упоминание DPO/специалиста по защите данных.
    const contactInfo = hasEmail || matchesAny(haystack, CONTACT_PATTERNS);

    return {
      analyzed: true,
      url: policyUrl,
      controllerIdentity,
      legalBasis,
      dataSubjectRights,
      contactInfo,
    };
  } catch {
    // Страница не открылась / упала навигация / DOM недоступен — честно «не смогли».
    return fallback;
  } finally {
    // Всегда закрываем вкладку, чтобы не копить страницы в контексте.
    await page.close().catch(() => {});
  }
}
