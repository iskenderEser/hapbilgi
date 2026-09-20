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
  if (specifier === "next/headers") {
    return { url: "data:text/javascript,export%20const%20cookies=()=>({get:()=>undefined});", shortCircuit: true };
  }
  if (specifier === "next/server") {
    return {
      url: "data:text/javascript,export%20const%20after=(fn)=>fn();export%20class%20NextResponse%7Bstatic%20json(data,init)%7Breturn%7Bstatus:init%3F.status||200,json:async()=>data%7D;%7D%7D",
      shortCircuit: true,
    };
  }
  if (specifier === "next/navigation") {
    return {
      url: "data:text/javascript,export%20const%20useRouter=()=>({push:()=>{},replace:()=>{},back:()=>{},prefetch:()=>{}});export%20const%20useSearchParams=()=>new%20URLSearchParams();export%20const%20usePathname=()=>'';",
      shortCircuit: true,
    };
  }
  if (specifier === "next/link") {
    return {
      url: "data:text/javascript,export%20default%20function%20Link({children,...props}){return%20children;}",
      shortCircuit: true,
    };
  }
  if (specifier.startsWith("@/") || (specifier.startsWith(".") && context.parentURL && !specifier.endsWith(".js") && !specifier.endsWith(".mjs") && !specifier.endsWith(".json"))) {
    const taban = specifier.startsWith("@/")
      ? join(kok, specifier.slice(2))
      : join(dirname(fileURLToPath(context.parentURL)), specifier);
    // Node uzantısız import'u çözemez; tsc/Next gibi .ts/.tsx/index denemesi yap.
    const adaylar = [`${taban}.ts`, `${taban}.tsx`, join(taban, "index.ts"), join(taban, "index.tsx"), taban];
    for (const aday of adaylar) {
      try {
        return await nextResolve(pathToFileURL(aday).href, context);
      } catch (e) {
        if (e?.code !== "ERR_MODULE_NOT_FOUND" && e?.code !== "ERR_UNSUPPORTED_DIR_IMPORT") throw e;
      }
    }
    return nextResolve(pathToFileURL(taban).href, context);
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".tsx")) {
    const { readFile } = await import("node:fs/promises");
    const ts = (await import("typescript")).default;
    const raw = await readFile(fileURLToPath(url), "utf8");
    const transpiled = ts.transpileModule(raw, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
      },
    });
    return {
      format: "module",
      source: transpiled.outputText,
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}
