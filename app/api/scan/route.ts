// POST /api/scan — оркестратор всего пайплайна. Node.js runtime (Playwright требует Node).
//
// Поток: capture (улики) → runRules (находки) → scoring (severity + диапазон штрафа)
//        → (опц.) AI-обогащение → buildReport → { ok: true, report }.
import { NextResponse } from 'next/server';
import { launchBrowser } from '@/lib/scanner/browser';
import { captureEvidence } from '@/lib/scanner/capture';
import { runRules } from '@/lib/rules';
import { refineSeverity } from '@/lib/scoring/severity';
import { computeFineRange } from '@/lib/scoring/fineRange';
import { isAiEnabled, enrichFindings } from '@/lib/ai/explain';
import { buildReport } from '@/lib/report/buildReport';
import { saveReportDebug } from '@/lib/report/store';
import {
  DEFAULT_COMPANY_TIER,
  DEFAULT_REPEAT_OFFENDER,
  type CompanySizeTier,
  type ScanInput,
} from '@/lib/scanner/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/**
 * Максимум времени серверной функции на Vercel (Hobby-план — до 60 с).
 * Локально/на своём сервере игнорируется. Наш скан должен успеть внутри.
 */
export const maxDuration = 60;

const VALID_TIERS: CompanySizeTier[] = ['solo', 'small', 'sme', 'large'];

/**
 * Верхний предел на один скан — предохранитель от зависаний. На Vercel держим
 * ниже maxDuration (60 с), чтобы отдать честную ошибку РАНЬШЕ, чем платформа
 * убьёт функцию без ответа. Локально — прежние 75 с.
 */
const SCAN_TIMEOUT_MS = process.env.VERCEL ? 52_000 : 75_000;

/** Ограничивает промис по времени, гарантированно очищая таймер. */
function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([p.finally(() => clearTimeout(timer)), timeout]);
}

export async function POST(request: Request) {
  let body: Partial<ScanInput>;
  try {
    body = (await request.json()) as Partial<ScanInput>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Тело запроса — не JSON.' }, { status: 400 });
  }

  const url = normalizeUrl(body.url);
  if (!url) {
    return NextResponse.json(
      { ok: false, error: 'Укажите корректный url (например example.com).' },
      { status: 400 },
    );
  }

  // Уточняющие ответы нельзя вывести из скана — если не заданы, берём
  // консервативные значения по умолчанию и помечаем это в отчёте.
  const tierProvided = typeof body.companySizeTier === 'string' && VALID_TIERS.includes(body.companySizeTier);
  const repeatProvided = typeof body.repeatOffender === 'boolean';
  const tier: CompanySizeTier = tierProvided ? (body.companySizeTier as CompanySizeTier) : DEFAULT_COMPANY_TIER;
  const repeat = repeatProvided ? (body.repeatOffender as boolean) : DEFAULT_REPEAT_OFFENDER;
  const assumedDefaults = !tierProvided || !repeatProvided;

  const startedAt = Date.now();
  const browser = await launchBrowser();
  try {
    // 1) Улики (с жёстким лимитом времени — чтобы скан не завис и не копил процессы)
    const evidence = await withTimeout(
      captureEvidence(browser, url),
      SCAN_TIMEOUT_MS,
      'Скан превысил лимит времени — сайт слишком медленный или блокирует автоматический доступ.',
    );

    // 2) Правила → находки
    let findings = runRules(evidence);

    // 3) Scoring: уточняем severity; € считаем ТОЛЬКО для денежных находок (GDPR/DVI).
    //    Немонетарные (monetary===false, напр. реквизиты/доступность — сфера PTAC)
    //    остаются с riskNote вместо суммы.
    findings = findings.map((f) => {
      const severity = refineSeverity(f, evidence);
      const scored = { ...f, severity };
      if (scored.monetary === false) return scored;
      return { ...scored, fineRange: computeFineRange(scored, tier, repeat) };
    });

    // 4) (опц.) AI-обогащение — по умолчанию выключено, режим «Только правила»
    const aiMode = isAiEnabled();
    if (aiMode) {
      findings = await enrichFindings(findings, evidence);
    }

    // 5) Сборка отчёта
    evidence.meta.durationMs = Date.now() - startedAt;
    const report = buildReport({
      meta: evidence.meta,
      input: { companySizeTier: tier, repeatOffender: repeat, assumedDefaults },
      findings,
      aiMode,
    });

    // Сохраняем отчёт для публичной ссылки (если подключён Blob). При выключенном
    // шаринге / сбое — shareId = null, клиент откроет отчёт по-старому (sessionStorage).
    const saved = await saveReportDebug(report);
    const shareId = saved.id;

    // ВРЕМЕННО: диагностика шаринга на боевом (убрать после проверки).
    return NextResponse.json({
      ok: true,
      report,
      shareId,
      shareDebug: { enabled: saved.enabled, error: saved.error },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Скан не удался.' },
      { status: 500 },
    );
  } finally {
    await browser.close().catch(() => {});
  }
}

/** Нормализует ввод: добавляет https://, отсекает не-http(s). */
function normalizeUrl(raw?: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}
