import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  typescript: {
    // npm run build önce bağımsız ve zorunlu typecheck:build çalıştırır.
    // Doğrudan next build çağrıları bu bayrak olmadan tip kontrolünü korur.
    ignoreBuildErrors: process.env.HAPBILGI_TYPES_CHECKED === "1",
  },
};

export default nextConfig;
