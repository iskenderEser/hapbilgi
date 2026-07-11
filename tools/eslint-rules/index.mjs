import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const semaYolu = join(__dirname, "..", "..", "scripts", "denetim", "sema.json");

let rpcSet = new Set();
try {
  const sema = JSON.parse(readFileSync(semaYolu, "utf8"));
  rpcSet = new Set(Object.keys(sema.rpc ?? {}));
} catch {
  rpcSet = null;
}

// KURAL 1: ölü RPC yasağı
const oluRpc = {
  meta: {
    type: "problem",
    docs: { description: "Kodda cagirilan RPC DB semasinda yoksa uyarir." },
    schema: [],
    messages: {
      yok: "RPC DB'de yok: '{{ad}}' (sema.json guncel mi? npm run denetim:sema).",
    },
  },
  create(context) {
    if (rpcSet === null) return {};
    return {
      CallExpression(node) {
        const c = node.callee;
        if (c.type !== "MemberExpression") return;
        if (c.property?.name !== "rpc") return;
        const arg = node.arguments?.[0];
        if (!arg || arg.type !== "Literal" || typeof arg.value !== "string") return;
        if (!rpcSet.has(arg.value)) {
          context.report({ node: arg, messageId: "yok", data: { ad: arg.value } });
        }
      },
    };
  },
};

// KURAL 2: FIRMA_KOLONLARI tek-kaynak
const FIRMA_KOLON_ESIK = 5;
const firmaKolonlari = {
  meta: {
    type: "problem",
    docs: { description: "firmalar tam-kolon SELECT'i FIRMA_KOLONLARI sabitini kullanmali." },
    schema: [],
    messages: {
      elle: "firmalar SELECT'inde {{sayi}} kolon elle yazilmis; FIRMA_KOLONLARI sabitini kullan.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const c = node.callee;
        if (c.type !== "MemberExpression") return;
        if (c.property?.name !== "select") return;
        let obj = c.object;
        let firmalarMi = false;
        while (obj && obj.type === "CallExpression") {
          const oc = obj.callee;
          if (oc?.type === "MemberExpression" && oc.property?.name === "from") {
            const a = obj.arguments?.[0];
            if (a?.type === "Literal" && a.value === "firmalar") firmalarMi = true;
            break;
          }
          obj = oc?.object;
        }
        if (!firmalarMi) return;
        const arg = node.arguments?.[0];
        if (arg?.type === "Literal" && typeof arg.value === "string") {
          const kolonSayisi = arg.value.split(",").filter((s) => s.trim()).length;
          if (kolonSayisi >= FIRMA_KOLON_ESIK) {
            context.report({ node: arg, messageId: "elle", data: { sayi: kolonSayisi } });
          }
        }
      },
    };
  },
};

// KURAL 3: kayıt tek-kaynak
const KORUMALI_TABLOLAR = new Set([
  "yayin_tekrar_kayitlari",
  "kazanilan_puanlar",
  "yanlis_cevap_kayitlari",
  "ileri_sarma_kayitlari",
  "oneri_kayip_kayitlari",
  "eclub_kazanilan_puanlar",
  "eclub_yanlis_cevap_kayitlari",
  "eclub_dogru_cevap_kayitlari",
  "eclub_utt_puanlari",
  "eczanem_puan_kayitlari",
  "eczanem_harcama_kayitlari",
  "eczanem_siparisler",
  "eczanem_urun_tarifeleri",
]);
const kayitTekKaynak = {
  meta: {
    type: "problem",
    docs: { description: "Puan/kayip/tur tablolarina INSERT yalniz lib/puan/, lib/tur/ veya lib/eczanem/ icinden yapilmali." },
    schema: [],
    messages: {
      disari: "'{{tablo}}' tablosuna INSERT yalniz lib/puan/, lib/tur/ veya lib/eczanem/ icinden yapilmali (tek-kaynak).",
    },
  },
  create(context) {
    const dosya = context.filename ?? context.getFilename?.() ?? "";
    const yol = dosya.replace(/\\/g, "/");
    if (yol.includes("/lib/puan/") || yol.includes("/lib/tur/") || yol.includes("/lib/eczanem/")) return {};

    return {
      CallExpression(node) {
        const c = node.callee;
        if (c.type !== "MemberExpression") return;
        if (c.property?.name !== "insert") return;
        let obj = c.object;
        while (obj && obj.type === "CallExpression") {
          const oc = obj.callee;
          if (oc?.type === "MemberExpression" && oc.property?.name === "from") {
            const a = obj.arguments?.[0];
            if (a?.type === "Literal" && KORUMALI_TABLOLAR.has(a.value)) {
              context.report({ node: a, messageId: "disari", data: { tablo: a.value } });
            }
            break;
          }
          obj = oc?.object;
        }
      },
    };
  },
};

// KURAL 4: doğru client — "use client" dosyasında createAdminClient yasak.
const dogruClient = {
  meta: {
    type: "problem",
    docs: { description: "createAdminClient (service_role) client bilesenlerinde kullanilamaz." },
    schema: [],
    messages: {
      sizinti: "createAdminClient 'use client' dosyasinda kullanilamaz; service_role tarayiciya sizabilir.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode?.();
    let useClient = false;
    const body = sourceCode?.ast?.body ?? [];
    for (const st of body) {
      if (
        st.type === "ExpressionStatement" &&
        st.expression?.type === "Literal" &&
        st.expression.value === "use client"
      ) {
        useClient = true;
        break;
      }
      // ilk non-directive ifadeye kadar bak
      if (st.type !== "ExpressionStatement" || typeof st.expression?.value !== "string") break;
    }
    if (!useClient) return {};
    return {
      CallExpression(node) {
        if (node.callee?.type === "Identifier" && node.callee.name === "createAdminClient") {
          context.report({ node, messageId: "sizinti" });
        }
      },
    };
  },
};

const plugin = {
  meta: { name: "hapbilgi-mimari", version: "0.0.1" },
  rules: {
    "olu-rpc": oluRpc,
    "firma-kolonlari": firmaKolonlari,
    "kayit-tek-kaynak": kayitTekKaynak,
    "dogru-client": dogruClient,
  },
};

export default plugin;