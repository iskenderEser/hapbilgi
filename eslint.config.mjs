import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import hapbilgiMimari from "./tools/eslint-rules/index.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // HapBilgi yerel mimari plugin — ölü RPC + FIRMA_KOLONLARI + kayıt tek-kaynak
  // + doğru client + talep künyesi tek kaynak + toast metni tek kaynak.
  {
    files: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    plugins: { "hapbilgi-mimari": hapbilgiMimari },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "hapbilgi-mimari/olu-rpc": "warn",
      "hapbilgi-mimari/firma-kolonlari": "warn",
      "hapbilgi-mimari/kayit-tek-kaynak": "warn",
      "hapbilgi-mimari/dogru-client": "error",
      "hapbilgi-mimari/talep-kunye-tek-kaynak": "warn",
      "hapbilgi-mimari/toast-tek-kaynak": "warn",
      "hapbilgi-mimari/rol-tek-kaynak": "warn",
      "hapbilgi-mimari/zaman-tek-kaynak": "error",
    },
  },
]);

export default eslintConfig;