// ============================================================================
// Правило 8: Нет HTTPS / смешанное содержимое (Medium–High).
// Нет HTTPS (https === false) → поднимаем severity до 'high'.
// Иначе есть смешанное содержимое (mixedContent === true) → 'medium'.
// Иначе — null.
// ============================================================================
import type { EvidencePointer, Finding, Rule, ScanEvidence, Severity } from '@/lib/scanner/types';

const TITLE = 'Небезопасное соединение';

// Статичные ссылки на закон. Вписаны вручную, AI их не придумывает.
const LEGAL_REFS = ['GDPR ст. 32 — безопасность обработки'];

export const insecureTransportRule: Rule = {
  id: 'insecure-transport',
  title: TITLE,
  legalRefs: LEGAL_REFS,
  severityBase: 'medium',

  evaluate(evidence: ScanEvidence): Finding | null {
    const tls = evidence.tls;

    let severity: Severity;
    let explanation: string;
    let remediation: string[];

    if (tls.https === false) {
      // Нет HTTPS — самое серьёзное: поднимаем severity.
      severity = 'high';
      explanation =
        'Сайт открывается по незащищённому протоколу http:// вместо https://. Это значит, ' +
        'что данные между посетителем и сайтом передаются в открытом виде и их можно ' +
        'перехватить. Защищённое соединение сегодня обязательно для любого сайта, который ' +
        'собирает данные.';
      remediation = [
        'Получите SSL-сертификат (у многих хостингов и через Let’s Encrypt он бесплатный).',
        'Настройте автоматический переход с http:// на https://.',
        'Проверьте, что все страницы открываются по https://.',
      ];
    } else if (tls.mixedContent === true) {
      // HTTPS есть, но часть ресурсов грузится по http://.
      severity = 'medium';
      explanation =
        'Сайт работает по защищённому https://, но часть содержимого (картинки, скрипты, ' +
        'стили) загружается по незащищённому http://. Такие «смешанные» ресурсы ослабляют ' +
        'защиту всей страницы, и их можно перехватить.';
      remediation = [
        'Замените ссылки на подресурсы с http:// на https://.',
        'Проверьте картинки, скрипты и стили, которые всё ещё грузятся по http://.',
        'После правок убедитесь, что браузер не показывает предупреждение о смешанном содержимом.',
      ];
    } else {
      return null;
    }

    const examples = tls.insecureRequests.slice(0, 5);
    const pointers: EvidencePointer[] = [
      {
        kind: 'tls',
        label: tls.https === false
          ? 'Соединение без HTTPS'
          : 'Смешанное содержимое (http:// на https-странице)',
        details: {
          finalUrl: tls.finalUrl,
          https: tls.https,
          mixedContent: tls.mixedContent,
          insecureExamples: examples.length > 0 ? examples.join(', ') : null,
        },
      },
    ];

    return {
      ruleId: 'insecure-transport',
      title: TITLE,
      severity,
      explanation,
      legalRefs: [...LEGAL_REFS],
      evidence: pointers,
      remediation,
      aiEnriched: false,
    };
  },
};
