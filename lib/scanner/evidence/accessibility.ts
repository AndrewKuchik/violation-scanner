// ============================================================================
// Коллектор улик: доступность (EAA) — AccessibilityEvidence.
//
// Закон: Dir. 2019/882; LV: Preču un pakalpojumu piekļūstamības likums (в силе
// с 28.06.2025). Здесь — только базовые авто-сигналы (НЕ полное соответствие WCAG):
//   • есть ли ссылка/текст «заявление о доступности» (LV/EN/RU);
//   • задан ли <html lang="…">;
//   • сколько <img> без атрибута alt (alt="" = декоративное, НЕ считаем нарушением).
//
// Функция НИКОГДА не кидает — при сбое отдаёт безопасный «ничего не нашли».
// ============================================================================
import type { Page } from 'playwright';
import type { AccessibilityEvidence } from '@/lib/scanner/types';

/** Пустой безопасный результат. */
const EMPTY: AccessibilityEvidence = {
  statementLink: false,
  statementHref: null,
  htmlLangSet: false,
  imagesMissingAlt: 0,
  imagesTotal: 0,
};

interface RawA11y {
  lang: string;
  imagesTotal: number;
  imagesMissingAlt: number;
  /** Ссылки страницы: {href, text}. */
  anchors: { href: string; text: string }[];
  /** Видимый текст (для случая, когда заявление — просто текст, а не ссылка). */
  text: string;
}

async function readRaw(page: Page): Promise<RawA11y> {
  try {
    return await page.evaluate((): RawA11y => {
      const de = document.documentElement;
      const lang = de ? (de.getAttribute('lang') || '').trim() : '';

      let imagesTotal = 0;
      let imagesMissingAlt = 0;
      const imgs = document.querySelectorAll('img');
      imgs.forEach((img) => {
        imagesTotal++;
        // Нет атрибута alt = потенциальная проблема. alt="" (пустой) = декоративное,
        // это допустимо и в missing НЕ попадает.
        if (!img.hasAttribute('alt')) imagesMissingAlt++;
      });

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
      return { lang, imagesTotal, imagesMissingAlt, anchors, text };
    });
  } catch {
    return { lang: '', imagesTotal: 0, imagesMissingAlt: 0, anchors: [], text: '' };
  }
}

// Паттерны «заявление о доступности» (LV/EN/RU).
const STATEMENT_RE =
  /accessibility\s+statement|accessibility|piek[ļl]ūstamīb|piekluustamiib|pieejamīb|pieejamib|заявлени\w*\s+о\s+доступн|доступност/i;

export async function collectAccessibility(page: Page): Promise<AccessibilityEvidence> {
  try {
    const raw = await readRaw(page);

    let statementLink = false;
    let statementHref: string | null = null;

    // 1. Ищем среди ссылок (по тексту и href).
    for (const a of raw.anchors) {
      const hay = `${a.href} ${a.text}`.toLowerCase();
      if (STATEMENT_RE.test(hay)) {
        statementLink = true;
        statementHref = a.href || null;
        break;
      }
    }

    // 2. Если ссылки нет — засчитываем упоминание в тексте (без href).
    if (!statementLink && STATEMENT_RE.test(raw.text)) {
      statementLink = true;
      statementHref = null;
    }

    return {
      statementLink,
      statementHref,
      htmlLangSet: raw.lang.length > 0,
      imagesMissingAlt: raw.imagesMissingAlt,
      imagesTotal: raw.imagesTotal,
    };
  } catch {
    return { ...EMPTY };
  }
}
