// ============================================================================
// Коллектор улик: реквизиты поставщика (imprint) — ImprintEvidence.
//
// Закон: e-Commerce Dir. 2000/31/EC ст.5; LV: Informācijas sabiedrības
// pakalpojumu likums §4(1). Обязательно для ВСЕХ коммерческих сайтов (не только
// магазинов): наименование/юрформа, юр. адрес, e-mail, рег.№ (Uzņēmumu reģistrs),
// № НДС (PVN).
//
// ПРИНЦИП: детектим по НАЛИЧИЮ паттернов (НЕ проверяем корректность номеров).
// Ищем по всему видимому тексту, а также по mailto-ссылкам (e-mail часто там).
// found[] — примеры найденного, чтобы отчёт мог показать «где именно».
// Функция НИКОГДА не кидает — при сбое отдаёт «ничего не нашли».
// ============================================================================
import type { Page } from 'playwright';
import type { ImprintEvidence } from '@/lib/scanner/types';

/** Пустой безопасный результат. */
function empty(): ImprintEvidence {
  return {
    companyName: false,
    address: false,
    email: false,
    registrationNumber: false,
    vatNumber: false,
    found: [],
  };
}

interface RawImprint {
  text: string;
  /** Адреса из mailto: (без префикса). */
  mailtos: string[];
}

async function readRaw(page: Page): Promise<RawImprint> {
  try {
    return await page.evaluate((): RawImprint => {
      const text = document.body ? (document.body.innerText || '').slice(0, 200_000) : '';
      const mailtos: string[] = [];
      const links = document.querySelectorAll('a[href^="mailto:"]');
      links.forEach((a) => {
        const href = a.getAttribute('href') || '';
        const addr = href.replace(/^mailto:/i, '').split('?')[0].trim();
        if (addr && mailtos.indexOf(addr) === -1) mailtos.push(addr);
      });
      return { text, mailtos: mailtos.slice(0, 20) };
    });
  } catch {
    return { text: '', mailtos: [] };
  }
}

// Юрформа / название: SIA "…", biedrība и т.п. (оригинальный регистр).
const COMPANY_RE = /\bSIA\s+["“„»«]?[A-ZĀČĒĢĪĶĻŅŠŪŽ][^\n"“„»«]{0,60}|["“„»«][^\n"“„»«]{1,60}["”“»«]\s*,?\s*SIA\b|\bSIA\b|\bAS\b|\bIK\b|\bZS\b|biedrība|nodibinājums/;

// Регистрационный номер: «reģ. Nr» / «reģistrācijas numurs» ИЛИ 11-значный (4…/5…).
const REG_LABEL_RE = /re[gģ]\.?\s*nr|re[gģ]istr[aā]cijas\s+numurs|vien[oa]t[aā]s\s+re[gģ]istr[aā]cijas/i;
const REG_NUMBER_RE = /\b[45]\d{10}\b/;

// НДС: «LV»+11 цифр ИЛИ «PVN» / «PVN reģ».
const VAT_RE = /\bLV\d{11}\b|\bPVN\b|pvn\s*re[gģ]/i;

// E-mail (в тексте).
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

// Латвийский адрес: iela / bulvāris / Rīga / индекс LV-XXXX.
const ADDRESS_RE = /\biela\b|bulv[aā]ris|prospekts|\bRīga\b|\bRiga\b|\bLV-\d{4}\b/i;

/** Первое совпадение как короткий пример (для показа «где»). */
function sample(text: string, re: RegExp, max = 80): string | null {
  const m = text.match(re);
  if (!m) return null;
  return m[0].replace(/\s+/g, ' ').trim().slice(0, max);
}

export async function collectImprint(page: Page): Promise<ImprintEvidence> {
  try {
    const raw = await readRaw(page);
    const result = empty();
    const text = raw.text;
    if (!text && raw.mailtos.length === 0) return result;

    // Наименование / юрформа.
    const companySample = sample(text, COMPANY_RE);
    if (companySample) {
      result.companyName = true;
      result.found.push({ kind: 'company', sample: companySample });
    }

    // Адрес.
    const addressSample = sample(text, ADDRESS_RE);
    if (addressSample) {
      result.address = true;
      result.found.push({ kind: 'address', sample: addressSample });
    }

    // E-mail: сначала из mailto, иначе из текста.
    if (raw.mailtos.length > 0) {
      result.email = true;
      result.found.push({ kind: 'email', sample: raw.mailtos[0].slice(0, 80) });
    } else {
      const emailSample = sample(text, EMAIL_RE);
      if (emailSample) {
        result.email = true;
        result.found.push({ kind: 'email', sample: emailSample });
      }
    }

    // Регистрационный номер: явная метка ИЛИ 11-значный номер.
    const regSample = sample(text, REG_LABEL_RE) || sample(text, REG_NUMBER_RE);
    if (regSample) {
      result.registrationNumber = true;
      result.found.push({ kind: 'reg', sample: regSample });
    }

    // Номер НДС.
    const vatSample = sample(text, VAT_RE);
    if (vatSample) {
      result.vatNumber = true;
      result.found.push({ kind: 'vat', sample: vatSample });
    }

    return result;
  } catch {
    return empty();
  }
}
