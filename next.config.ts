import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Не упаковывать эти пакеты в серверный бандл — грузить нативным require.
  // axe-core: иначе теряется axe.source (строка с движком для инъекции в страницу).
  // playwright: тяжёлый бинарник chromium (по умолчанию и так внешний, дублируем явно).
  // @sparticuz/chromium: облачный chromium для Vercel — распаковывается из своего
  //   пакета в рантайме, бандлить нельзя.
  serverExternalPackages: ['axe-core', 'playwright', 'playwright-core', '@sparticuz/chromium'],

  // Vercel режет serverless-функцию до реально «нужных» файлов (output file tracing).
  // Но playwright-core читает browsers.json, а @sparticuz/chromium — свой bin/*.br
  // через fs в рантайме (трейсер этого статически не видит) → на Vercel были ошибки
  // «Cannot find module .../browsers.json». Заставляем включить эти пакеты целиком
  // именно в функцию /api/scan (где запускается браузер).
  outputFileTracingIncludes: {
    '/api/scan': [
      './node_modules/playwright-core/**',
      './node_modules/@sparticuz/chromium/**',
    ],
  },
};

export default nextConfig;
