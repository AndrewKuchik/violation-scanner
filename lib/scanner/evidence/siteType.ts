// ============================================================================
// Коллектор улик: классификация типа сайта (SiteTypeEvidence).
//
// Зачем: «коммерческие» требования (реквизиты поставщика, потреб-право, возврат)
// НЕЛЬЗЯ показывать личным сайтам-визиткам — это ввело бы в заблуждение. Здесь мы
// по бесплатным эвристикам решаем: сайт коммерческий (продажа товаров/услуг,
// бронирование, цены) и/или это интернет-магазин (корзина/checkout/платформа).
//
// ПРИНЦИП: детектим по НАЛИЧИЮ сигналов (не корректность). Многоязычно LV/EN/RU.
// Функция НИКОГДА не кидает — любой сбой => безопасный дефолт «ничего не нашли».
// ============================================================================
import type { Page } from 'playwright';
import type { SiteTypeEvidence } from '@/lib/scanner/types';

/** Пустой безопасный результат (когда страница недоступна/сбой). */
const EMPTY: SiteTypeEvidence = {
  commercial: false,
  ecommerce: false,
  confidence: 'none',
  signals: [],
};

/** Сырьё, снятое со страницы одним заходом. */
interface RawSite {
  /** Видимый текст (innerText), усечён. Оригинальный регистр (нужен для SIA/AS/IK). */
  text: string;
  /** Исходный HTML (outerHTML), усечён. Нужен для script-урлов платформ/платёжек. */
  html: string;
  /** window.Shopify присутствует. */
  hasShopify: boolean;
}

/** Читает нужное со страницы одним page.evaluate; при сбое — пустые строки. */
async function readRaw(page: Page): Promise<RawSite> {
  try {
    return await page.evaluate((): RawSite => {
      const cut = (s: string | null | undefined, n: number): string => (s || '').slice(0, n);
      const text = document.body ? document.body.innerText || '' : '';
      const html = document.documentElement ? document.documentElement.outerHTML || '' : '';
      const w = window as unknown as Record<string, unknown>;
      return {
        text: cut(text, 200_000),
        html: cut(html, 200_000),
        hasShopify: typeof w['Shopify'] !== 'undefined' && w['Shopify'] !== null,
      };
    });
  } catch {
    return { text: '', html: '', hasShopify: false };
  }
}

/** Пара «паттерн → человекочитаемая (RU) подпись сигнала». */
interface Pat {
  re: RegExp;
  label: string;
}

// Слова покупки/брони (LV/EN/RU). Ищем в видимом тексте и в HTML (классы кнопок).
const PURCHASE_PATS: Pat[] = [
  { re: /\badd to cart\b|add-to-cart|\bbuy now\b|\bbuy\b/i, label: 'слово покупки (buy / add to cart)' },
  { re: /\bcheckout\b|\border\b/i, label: 'оформление заказа (checkout / order)' },
  { re: /\bbook a session\b|\bbook now\b|\bbooking\b|\bbook\b/i, label: 'бронирование (book a session)' },
  { re: /\bpirkt\b|\bgrozs\b|\bpasūtīt\b|\bpasutit\b/i, label: 'слово покупки (pirkt / grozs)' },
  { re: /\brezervēt\b|\brezervet\b/i, label: 'бронирование (rezervēt)' },
  { re: /куп(ить|и)|заказать|бронир|в корзин/i, label: 'слово покупки (купить / заказать)' },
  { re: /услуги и цены|services and prices|pakalpojumi un cenas/i, label: 'раздел «услуги и цены»' },
  { re: /\bshop\b|\bveikals\b|магазин/i, label: 'магазин (shop / veikals)' },
];

// Цены: символ €, EUR, «cena», число рядом с € (LV/EN/RU).
const PRICE_RE = /€\s?\d|\d[\d\s.,]*\s?€|\beur\b|\bcena\b|\bcenas\b/i;

// Платёжные системы — по script-урлам/маркерам в HTML.
const PAYMENT_PATS: Pat[] = [
  { re: /js\.stripe\.com|\bstripe\b/i, label: 'платёжная система Stripe' },
  { re: /paypal\.com|paypalobjects|\bpaypal\b/i, label: 'платёжная система PayPal' },
];

// Юридические формы латвийских лиц (оригинальный регистр, целые слова).
const LEGAL_FORM_PATS: Pat[] = [
  { re: /\bSIA\b/, label: 'юрформа SIA' },
  { re: /\bAS\b/, label: 'юрформа AS' },
  { re: /\bIK\b/, label: 'юрформа IK (individuālais komersants)' },
  { re: /\bZS\b/, label: 'юрформа ZS (zemnieku saimniecība)' },
];

// Явные признаки интернет-магазина: платформы и корзина/checkout.
const PLATFORM_PATS: Pat[] = [
  { re: /cdn\.shopify|myshopify\.com|\bshopify\b/i, label: 'платформа Shopify' },
  { re: /woocommerce|wp-content\/plugins\/woocommerce/i, label: 'платформа WooCommerce' },
  { re: /\bmagento\b|mage\/|static\/version/i, label: 'платформа Magento' },
  { re: /prestashop/i, label: 'платформа PrestaShop' },
  { re: /tilda.{0,10}store|t-store|tstore|t706__/i, label: 'магазин на Tilda' },
];

const CART_PATS: Pat[] = [
  { re: /add to cart|add-to-cart|\bcheckout\b/i, label: 'корзина / checkout' },
  { re: /pievienot grozam|\bgrozs\b|noformēt pasūtījumu/i, label: 'корзина (grozs / pievienot grozam)' },
  { re: /в корзину|оформить заказ|корзина/i, label: 'корзина (в корзину / оформить заказ)' },
];

/** Добавляет уникальную подпись сигнала. */
function pushSignal(signals: string[], label: string): void {
  if (signals.indexOf(label) === -1) signals.push(label);
}

export async function classifySiteType(page: Page, baseUrl: string): Promise<SiteTypeEvidence> {
  try {
    // baseUrl участвует только как страховка (сейчас решаем по содержимому страницы).
    void baseUrl;
    const raw = await readRaw(page);
    if (!raw.text && !raw.html) return EMPTY;

    const textLc = raw.text.toLowerCase();
    const htmlLc = raw.html.toLowerCase();
    const combinedLc = `${textLc} ${htmlLc}`;

    const signals: string[] = [];
    // Категории независимых сигналов — для расчёта уверенности.
    const categories = new Set<string>();

    // 1. Цены (по видимому тексту).
    if (PRICE_RE.test(raw.text)) {
      pushSignal(signals, 'видны цены (€ / EUR / cena)');
      categories.add('prices');
    }

    // 2. Слова покупки/брони (текст + HTML).
    for (const p of PURCHASE_PATS) {
      if (p.re.test(combinedLc)) {
        pushSignal(signals, p.label);
        categories.add('purchase');
      }
    }

    // 3. Платёжные системы (по HTML).
    for (const p of PAYMENT_PATS) {
      if (p.re.test(htmlLc)) {
        pushSignal(signals, p.label);
        categories.add('payment');
      }
    }

    // 4. Юридическая форма (оригинальный регистр текста).
    for (const p of LEGAL_FORM_PATS) {
      if (p.re.test(raw.text)) {
        pushSignal(signals, p.label);
        categories.add('legalForm');
      }
    }

    // 5. Признаки интернет-магазина: платформа или корзина/checkout.
    let ecommerce = false;
    if (raw.hasShopify) {
      pushSignal(signals, 'платформа Shopify (window.Shopify)');
      ecommerce = true;
    }
    for (const p of PLATFORM_PATS) {
      if (p.re.test(htmlLc)) {
        pushSignal(signals, p.label);
        ecommerce = true;
      }
    }
    for (const p of CART_PATS) {
      if (p.re.test(combinedLc)) {
        pushSignal(signals, p.label);
        ecommerce = true;
      }
    }

    const commercial = ecommerce || categories.size > 0;

    // Уверенность: магазин или ≥2 независимых сигналов => strong; ровно 1 => weak.
    let confidence: SiteTypeEvidence['confidence'] = 'none';
    if (ecommerce || categories.size >= 2) confidence = 'strong';
    else if (categories.size === 1) confidence = 'weak';

    return { commercial, ecommerce, confidence, signals };
  } catch {
    return EMPTY;
  }
}
