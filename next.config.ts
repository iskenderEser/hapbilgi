import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  typescript: {
    // npm run build önce bağımsız ve zorunlu typecheck:build çalıştırır.
    // Doğrudan next build çağrıları bu bayrak olmadan tip kontrolünü korur.
    ignoreBuildErrors: process.env.HAPBILGI_TYPES_CHECKED === "1",
  },
  async redirects() {
    return [
      {
        source: "/raporlar/uretim",
        destination: "/raporlar/yayin-raporlari",
        permanent: true,
      },
      {
        source: "/raporlar/yayin-rapolari",
        destination: "/raporlar/yayin-raporlari",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
