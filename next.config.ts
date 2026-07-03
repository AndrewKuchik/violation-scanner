import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Не упаковывать эти пакеты в серверный бандл — грузить нативным require.
  // axe-core: иначе теряется axe.source (строка с движком для инъекции в страницу).
  // playwright: тяжёлый бинарник chromium (по умолчанию и так внешний, дублируем явно).
  // @sparticuz/chromium: облачный chromium для Vercel — распаковывается из своего
  //   пакета в рантайме, бандлить нельзя.
  serverExternalPackages: ['axe-core', 'playwright', 'playwright-core', '@sparticuz/chromium'],
};

export default nextConfig;
