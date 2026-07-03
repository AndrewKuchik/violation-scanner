// ============================================================================
// Коллектор улик: доступность латышской версии — LanguageEvidence.
//
// Закон: Valsts valodas likums §2,21 — информация для потребителя должна быть на
// латышском. Здесь по НАЛИЧИЮ (не достаточность):
//   • htmlLang — <html lang="…"> || null;
//   • latvianAvailable — lang начинается с 'lv' ИЛИ есть переключатель на LV ИЛИ
//     в тексте есть латышский (диакритики ā/č/ē/… и/или частые слова);
//   • hasLanguageSwitcher — есть набор языковых ссылок, среди которых латышский.
//
// Функция НИКОГДА не кидает — при сбое отдаёт безопасный дефолт.
// ============================================================================
import type { Page } from 'playwright';
import type { LanguageEvidence } from '@/lib/scanner/types';

const EMPTY: LanguageEvidence = {
  htmlLang: null,
  latvianAvailable: false,
  hasLanguageSwitcher: false,
};

interface RawLang {
  lang: string;
  anchors: { href: string; text: string }[];
  text: string;
}

async function readRaw(page: Page): Promise<RawLang> {
  try {
    return await page.evaluate((): RawLang => {
      const de = document.documentElement;
      const lang = de ? (de.getAttribute('lang') || '').trim() : '';
      const anchors: { href: string; text: string }[] = [];
      const links = document.querySelectorAll('a[href],button');
      links.forEach((a) => {
        if (anchors.length >= 600) return;
        const el = a as HTMLElement;
        const href = (el as HTMLAnchorElement).href || el.getAttribute('href') || '';
        anchors.push({
          href,
          text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
        });
      });
      const text = document.body ? (document.body.innerText || '').slice(0, 200_000) : '';
      return { lang, anchors, text };
    });
  } catch {
    return { lang: '', anchors: [], text: '' };
  }
}

// Латышские диакритики и частые слова — сигнал латышского контента.
const LV_DIACRITICS_RE = /[āčēģīķļņšūž]/i;
const LV_WORDS_RE = /\b(un|ir|vai|sīkdatnes|sikdatnes|piekrītu|piekritu)\b/i;

/** Ссылка/кнопка похожа на выбор языка? Возвращает код языка или null. */
function languageCode(href: string, text: string): string | null {
  const t = text.toLowerCase().trim();
  const h = href.toLowerCase();

  // По тексту: короткий код (lv/en/ru/lt/et/de) или название языка.
  if (/^(lv|latviešu|latviesu|latvian)$/i.test(t) || /latviešu|latviesu/i.test(t)) return 'lv';
  if (/^(en|eng|english)$/i.test(t)) return 'en';
  if (/^(ru|рус|русский|russian)$/i.test(t)) return 'ru';
  if (/^(lt|lietuvi|lithuanian)$/i.test(t)) return 'lt';
  if (/^(et|eesti|estonian)$/i.test(t)) return 'et';
  if (/^(de|deutsch|german)$/i.test(t)) return 'de';

  // По href: /lv/ , ?lang=lv , /en/ , hl=ru и т.п.
  const m = h.match(/[?&](?:lang|language|hl|locale|l)=([a-z]{2})\b|\/([a-z]{2})(?:\/|$|\?)/i);
  if (m) {
    const code = (m[1] || m[2] || '').toLowerCase();
    if (['lv', 'en', 'ru', 'lt', 'et', 'de'].indexOf(code) !== -1) return code;
  }
  return null;
}

export async function collectLanguage(page: Page): Promise<LanguageEvidence> {
  try {
    const raw = await readRaw(page);
    const htmlLang = raw.lang.length > 0 ? raw.lang : null;

    // Собираем языковые ссылки/кнопки.
    const codes = new Set<string>();
    let latvianLink = false;
    for (const a of raw.anchors) {
      if (!a.text && !a.href) continue;
      const code = languageCode(a.href, a.text);
      if (code) {
        codes.add(code);
        if (code === 'lv') latvianLink = true;
      }
    }

    // Переключатель = набор (≥2) языковых ссылок, среди которых латышский.
    const hasLanguageSwitcher = latvianLink && codes.size >= 2;

    // Латышский контент по тексту.
    const latvianContent = LV_DIACRITICS_RE.test(raw.text) || LV_WORDS_RE.test(raw.text);

    const latvianAvailable =
      (htmlLang !== null && /^lv/i.test(htmlLang)) || latvianLink || latvianContent;

    return { htmlLang, latvianAvailable, hasLanguageSwitcher };
  } catch {
    return { ...EMPTY };
  }
}
