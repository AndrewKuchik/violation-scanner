// ============================================================================
// Коллектор улик: потребительские сигналы — ConsumerEvidence.
//
// Покрывает несколько областей отчёта (см. docs/product/legal-requirements.md):
//   • B — устаревшая ссылка на ODR-платформу ЕС (отменена с 20.07.2025) => ФЛАГ;
//   • D — право отказа/возврата (14 дней, atteikuma tiesības);
//   • E — прозрачность цены (видны ли цены, есть ли указание налога PVN/VAT).
//
// ПРИНЦИП: детектим по НАЛИЧИЮ (НЕ корректность). Многоязычно LV/EN/RU.
// Функция НИКОГДА не кидает — при сбое отдаёт безопасный дефолт.
// ============================================================================
import type { Page } from 'playwright';
import type { ConsumerEvidence } from '@/lib/scanner/types';

const EMPTY: ConsumerEvidence = {
  staleOdrLink: false,
  staleOdrHref: null,
  returnPolicy: false,
  mentions14Days: false,
  pricesVisible: false,
  priceTaxWording: false,
};

interface RawConsumer {
  anchors: { href: string; text: string }[];
  text: string;
}

async function readRaw(page: Page): Promise<RawConsumer> {
  try {
    return await page.evaluate((): RawConsumer => {
      const anchors: { href: string; text: string }[] = [];
      const links = document.querySelectorAll('a[href]');
      links.forEach((a) => {
        if (anchors.length >= 600) return;
        const anchor = a as HTMLAnchorElement;
        anchors.push({
          href: anchor.href || anchor.getAttribute('href') || '',
          text: (anchor.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
        });
      });
      const text = document.body ? (document.body.innerText || '').slice(0, 200_000) : '';
      return { anchors, text };
    });
  } catch {
    return { anchors: [], text: '' };
  }
}

// Устаревшая ODR-платформа ЕС.
const ODR_RE = /ec\.europa\.eu\/consumers\/odr|webgate\.ec\.europa\.eu\/odr/i;

// Возврат / право отказа (LV/EN/RU).
const RETURN_RE =
  /atteikuma\s+ties[īi]b|\batteikum|atgriešan|atgriesan|preču\s+atgriešana|\breturn\b|\brefund\b|возврат|отказ\s+от\s+товара|право\s+на\s+отказ/i;

// «14 дней» в трёх языках.
const DAYS14_RE = /14\s*dien|14\s*day|14\s*дн/i;

// Ценовые паттерны (наличие цен на странице).
const PRICE_RE = /€\s?\d|\d[\d\s.,]*\s?€|\d+[.,]\d{2}\b|\bEUR\b/i;

// Указание налога рядом с ценой / в тексте.
const TAX_RE = /\bar\s+PVN\b|\bbez\s+PVN\b|incl\.?\s*VAT|including\s+VAT|\bс\s+НДС\b|\bбез\s+НДС\b|\bPVN\b|\bVAT\b|\bНДС\b/i;

export async function collectConsumer(page: Page): Promise<ConsumerEvidence> {
  try {
    const raw = await readRaw(page);
    const result: ConsumerEvidence = { ...EMPTY };

    // Устаревшая ODR-ссылка (по href всех ссылок).
    for (const a of raw.anchors) {
      if (a.href && ODR_RE.test(a.href)) {
        result.staleOdrLink = true;
        result.staleOdrHref = a.href;
        break;
      }
    }
    // На случай, если ODR-URL присутствует только текстом.
    if (!result.staleOdrLink && ODR_RE.test(raw.text)) {
      result.staleOdrLink = true;
      const m = raw.text.match(ODR_RE);
      result.staleOdrHref = m ? m[0] : null;
    }

    // Возврат / право отказа — по ссылкам и по тексту.
    let returnFound = RETURN_RE.test(raw.text);
    if (!returnFound) {
      for (const a of raw.anchors) {
        const hay = `${a.href} ${a.text}`;
        if (RETURN_RE.test(hay)) {
          returnFound = true;
          break;
        }
      }
    }
    result.returnPolicy = returnFound;

    // 14 дней.
    result.mentions14Days = DAYS14_RE.test(raw.text);

    // Цены и указание налога.
    result.pricesVisible = PRICE_RE.test(raw.text);
    result.priceTaxWording = TAX_RE.test(raw.text);

    return result;
  } catch {
    return { ...EMPTY };
  }
}
