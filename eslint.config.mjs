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
  // HapBilgi yerel mimari plugin — ölü RPC + FIRMA_KOLONLARI + kayıt tek-kaynak + doğru client.
  {
    files: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    plugins: { "hapbilgi-mimari": hapbilgiMimari },
    rules: {
      "hapbilgi-mimari/olu-rpc": "warn",
      "hapbilgi-mimari/firma-kolonlari": "warn",
      "hapbilgi-mimari/kayit-tek-kaynak": "warn",
      "hapbilgi-mimari/dogru-client": "error",
    },
  },
]);

export default eslintConfig;