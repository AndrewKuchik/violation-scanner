// ============================================================================
// Единый контракт данных сканера. ЭТОТ ФАЙЛ — источник правды для всех модулей.
// Правила, scoring, AI-слой, UI и сборщик отчёта читают типы отсюда.
// Менять его — только осознанно: от него зависит весь пайплайн.
//
// Поток: capture.ts (драйвит браузер, собирает сырьё) → evidence/* (превращают
// сырьё в структурированные улики) → ScanEvidence → rules → Finding[] →
// scoring (severity + fineRange) → (опц.) AI-обогащение → buildReport → Report.
// ============================================================================

// ---------------------------------------------------------------------------
// Входные данные скана
// ---------------------------------------------------------------------------

/** Примерный размер компании — сужает диапазон штрафа (нельзя вывести из URL). */
export type CompanySizeTier = 'solo' | 'small' | 'sme' | 'large';

export interface ScanInput {
  url: string;
  /** Если не задан — консервативно берём 'small'. */
  companySizeTier?: CompanySizeTier;
  /** Повторное нарушение? Если не задано — false (впервые). */
  repeatOffender?: boolean;
}

// ---------------------------------------------------------------------------
// Сырой захват (производит capture.ts, потребляют коллекторы evidence/*)
// ---------------------------------------------------------------------------

/** Один сетевой запрос, пойманный ДО любого взаимодействия пользователя. */
export interface CapturedRequest {
  url: string;
  method: string;
  /** Playwright resourceType: 'script' | 'image' | 'xhr' | 'fetch' | 'document' | ... */
  resourceType: string;
  hostname: string;
  /** мс от старта навигации */
  timestamp: number;
}

export interface CapturedResponse {
  url: string;
  status: number;
  hostname: string;
  /** Протокол безопасности соединения, если доступен (например 'TLS 1.3'). */
  securityProtocol?: string | null;
}

// ---------------------------------------------------------------------------
// Улики (каждое поле производит отдельный коллектор evidence/*)
// ---------------------------------------------------------------------------

/** Снимок cookie ДО согласия. Коллектор: evidence/cookies.ts */
export interface CookieRecord {
  name: string;
  domain: string;
  /** Значение может быть усечено/опущено ради приватности отчёта. */
  value?: string;
  path?: string;
  /** unix-время истечения; -1 = сессионная. */
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  /** true, если домен совпадает со сканируемым сайтом. */
  firstParty: boolean;
  /** Грубая категория по известным именам/доменам. */
  category?: 'analytics' | 'marketing' | 'functional' | 'necessary' | 'unknown';
}

/** localStorage / sessionStorage ключи. Коллектор: evidence/storage.ts */
export interface StorageRecord {
  key: string;
  scope: 'local' | 'session';
}

/** Совпадение с известным трекером. Коллектор: evidence/trackers.ts */
export interface TrackerHit {
  /** Человеческое имя: 'Google Analytics', 'Meta Pixel', 'Google Tag Manager'. */
  name: string;
  category: 'analytics' | 'advertising' | 'social' | 'tag-manager' | 'other';
  hostname: string;
  exampleUrl: string;
  requestCount: number;
}

/** Сводка по сети. Коллектор: evidence/network.ts */
export interface NetworkEvidence {
  totalRequests: number;
  thirdPartyRequests: number;
  thirdPartyHostnames: string[];
}

/** Насколько уверенно детектор понял ситуацию с баннером. */
export type ConsentBannerConfidence = 'detected' | 'not-found' | 'inconclusive';

/** Баннер согласия. Коллектор: evidence/consentBanner.ts */
export interface ConsentBannerEvidence {
  present: boolean;
  confidence: ConsentBannerConfidence;
  /** 'OneTrust' | 'Cookiebot' | 'Osano' | 'generic' | null */
  cmpVendor?: string | null;
  hasAcceptButton?: boolean;
  hasRejectButton?: boolean;
  /** Трение принятия (обычно 1 клик). */
  acceptClicks?: number | null;
  /** Трение отказа (null = кнопка отказа не найдена / требует больше действий). */
  rejectClicks?: number | null;
  /** Предустановленные («заранее отмеченные») чекбоксы согласия. */
  preTickedBoxes?: boolean;
  /** Баннер найден внутри iframe или shadow-DOM (влияет на уверенность). */
  inIframeOrShadow?: boolean;
  /** Скриншот подсвеченного баннера (base64 PNG без префикса data:) для отчёта. */
  screenshotBase64?: string | null;
  boundingBox?: BoundingBox | null;
  /** Честная заметка, особенно при confidence = 'inconclusive'. */
  detail?: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Проверка одной обязательной ссылки. */
export interface LinkCheck {
  kind: 'privacy-policy' | 'cookie-policy' | 'terms' | 'seller-info';
  found: boolean;
  href?: string | null;
  /** HTTP-проверка доступности (null = не проверялась). */
  reachable?: boolean | null;
}

/** Ссылки на политики. Коллектор: evidence/links.ts */
export interface LinksEvidence {
  privacyPolicy: LinkCheck;
  cookiePolicy?: LinkCheck;
  /** Полный список выполненных проверок (для v1.5 сюда добавятся e-commerce). */
  checks: LinkCheck[];
}

/** HTTPS и mixed content. Коллектор: evidence/tls.ts */
export interface TlsEvidence {
  https: boolean;
  finalUrl: string;
  /** Исходный http:// сам редиректнул на https:// */
  redirectedToHttps: boolean;
  /** На https-странице есть http:// подресурсы. */
  mixedContent: boolean;
  /** Примеры небезопасных подресурсов. */
  insecureRequests: string[];
}

/** Метаданные скана. Заполняются capture.ts + route (scannedAt/duration). */
export interface ScanMeta {
  /** Запрошенный URL. */
  url: string;
  /** URL после редиректов. */
  finalUrl: string;
  title: string;
  /** ISO-время; ставит route (в браузере времени нет). */
  scannedAt: string;
  /** Похоже на блокировку headless (Cloudflare и т.п.). */
  botBlocked: boolean;
  /** Честная причина неполноты скана (или null). */
  incompleteReason?: string | null;
  durationMs?: number;
}

/**
 * Единый контракт улик, из которого читает КАЖДОЕ правило.
 * Собирается capture.ts (драйвит браузер и вызывает коллекторы evidence/*).
 */
export interface ScanEvidence {
  meta: ScanMeta;
  /** Снимок ДО любого взаимодействия. */
  cookies: CookieRecord[];
  storage: StorageRecord[];
  network: NetworkEvidence;
  /** Известные трекеры, загруженные до согласия. */
  trackers: TrackerHit[];
  consentBanner: ConsentBannerEvidence;
  links: LinksEvidence;
  tls: TlsEvidence;
}

// ---------------------------------------------------------------------------
// Правила и находки
// ---------------------------------------------------------------------------

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Правило — чистая TS-функция с метаданными (НЕ JSON DSL).
 * legalRefs — СТАТИЧНЫЕ, вписаны вручную. AI их НИКОГДА не придумывает.
 */
export interface Rule {
  id: string;
  /** Короткий человеческий заголовок (используется в режиме «Только правила»). */
  title: string;
  legalRefs: string[];
  severityBase: Severity;
  /** Чистая функция: смотрит улики, возвращает Finding или null (правило не сработало). */
  evaluate(evidence: ScanEvidence): Finding | null;
}

/** Точная локализация «где» — главный дифференциатор продукта. */
export interface EvidencePointer {
  kind: 'cookie' | 'tracker' | 'network' | 'dom' | 'link' | 'tls' | 'generic';
  label: string;
  /** Структурированные детали (имя куки, домен, момент появления и т.п.). */
  details?: Record<string, string | number | boolean | null | undefined>;
  /** Для DOM-находок: скриншот с подсветкой (base64 PNG без префикса). */
  screenshotBase64?: string | null;
  boundingBox?: BoundingBox | null;
}

/** Диапазон штрафа — НИКОГДА не точная сумма. Всегда диапазон + факторы. */
export interface FineRange {
  minEur: number;
  maxEur: number;
  /** Что повлияло на диапазон: размер компании, повторность, статутный потолок. */
  factors: string[];
  /** На каком допущении построено, напр. «малый бизнес, впервые». */
  assumption: string;
}

export interface Finding {
  ruleId: string;
  title: string;
  severity: Severity;
  /**
   * Объяснение простым языком. Режим «Только правила» — статичный текст из правила.
   * Режим AI — заменяется/обогащается Claude (всё ещё привязан к статичным legalRefs).
   */
  explanation: string;
  /** Скопировано из правила (статично). */
  legalRefs: string[];
  /** «Где именно» — улики находки. */
  evidence: EvidencePointer[];
  /** Конкретные шаги по исправлению. */
  remediation: string[];
  /** Заполняется слоем scoring. */
  fineRange?: FineRange;
  /** true, если объяснение обогащено AI. */
  aiEnriched?: boolean;
}

// ---------------------------------------------------------------------------
// Отчёт
// ---------------------------------------------------------------------------

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface Report {
  meta: ScanMeta;
  input: {
    companySizeTier: CompanySizeTier;
    repeatOffender: boolean;
    /** true, если пользователь не уточнил и взяты значения по умолчанию. */
    assumedDefaults: boolean;
  };
  summary: {
    counts: SeverityCounts;
    totalFindings: number;
    /** Агрегированный диапазон риска по всем находкам (или null, если находок нет). */
    overallRange: FineRange | null;
  };
  /** Отсортированы: critical сверху. */
  findings: Finding[];
  /** Обязательный статичный дисклеймер (закреплён ВВЕРХУ отчёта). */
  disclaimer: string;
  /** Работал ли AI-слой. */
  aiMode: boolean;
  /** Скан мог быть неполным (бот-детекция / баннер в iframe и т.п.). */
  incomplete: boolean;
  incompleteReason?: string | null;
}

// ---------------------------------------------------------------------------
// Общие константы (единый источник — чтобы формулировки не расходились)
// ---------------------------------------------------------------------------

/**
 * ОБЯЗАТЕЛЬНЫЙ дисклеймер. Закреплён ВВЕРХУ отчёта, не в подвале.
 * Дословно из docs/product/legal-guardrails.md — менять только вместе с ним.
 */
export const DISCLAIMER =
  'Это образовательная оценка возможных последствий, а не юридическая консультация. ' +
  'Реальный размер штрафа определяет Datu valsts inspekcija (Латвия) или соответствующий ' +
  'надзорный орган ЕС индивидуально, с учётом множества факторов, которые сканирование сайта не может учесть.';

/** Значения по умолчанию, когда пользователь не уточнил (консервативно). */
export const DEFAULT_COMPANY_TIER: CompanySizeTier = 'small';
export const DEFAULT_REPEAT_OFFENDER = false;
