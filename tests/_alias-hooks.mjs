// tests/_alias-hooks.mjs — "@/" alias resolve hook'u (yalnız test ortamı).
//
// Kod tabanı modülleri "@/..." (proje kökü) ile import eder; bu bir tsconfig
// path'idir, tsc ve Next çözer ama çıplak `node --test` çözemez. Bu hook,
// "@/x" isteklerini proje kökündeki "x"e çevirir. _alias.mjs bunu kaydeder.

import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const kok = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: "data:text/javascript,export%20default%20undefined", shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const taban = join(kok, specifier.slice(2));
    // Node uzantısız import'u çözemez; tsc/Next gibi .ts/.tsx/index denemesi yap.
    const adaylar = [taban, `${taban}.ts`, `${taban}.tsx`, join(taban, "index.ts"), join(taban, "index.tsx")];
    for (const aday of adaylar) {
      try {
        return await nextResolve(pathToFileURL(aday).href, context);
      } catch (e) {
        if (e?.code !== "ERR_MODULE_NOT_FOUND") throw e;
      }
    }
    return nextResolve(pathToFileURL(taban).href, context);
  }
  return nextResolve(specifier, context);
}
