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
  "push_abonelikleri",
  "push_gonderim_kayitlari",
]);
const YAZMA_ISLEMLERI = new Set(["insert", "update", "delete", "upsert"]);
const kayitTekKaynak = {
  meta: {
    type: "problem",
    docs: { description: "Puan/kayip/tur/push tablolarina INSERT/UPDATE/DELETE/UPSERT yalniz lib/puan/, lib/tur/, lib/eczanem/ veya lib/push/ icinden yapilmali." },
    schema: [],
    messages: {
      disari: "'{{tablo}}' tablosuna {{islem}} yalniz lib/puan/, lib/tur/, lib/eczanem/ veya lib/push/ icinden yapilmali (tek-kaynak).",
    },
  },
  create(context) {
    const dosya = context.filename ?? context.getFilename?.() ?? "";
    const yol = dosya.replace(/\\/g, "/");
    if (yol.includes("/lib/puan/") || yol.includes("/lib/tur/") || yol.includes("/lib/eczanem/") || yol.includes("/lib/push/")) return {};

    return {
      CallExpression(node) {
        const c = node.callee;
        if (c.type !== "MemberExpression") return;
        const islem = c.property?.name;
        if (!YAZMA_ISLEMLERI.has(islem)) return;
        let obj = c.object;
        while (obj && obj.type === "CallExpression") {
          const oc = obj.callee;
          if (oc?.type === "MemberExpression" && oc.property?.name === "from") {
            const a = obj.arguments?.[0];
            if (a?.type === "Literal" && KORUMALI_TABLOLAR.has(a.value)) {
              context.report({ node: a, messageId: "disari", data: { tablo: a.value, islem: islem.toUpperCase() } });
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

// KURAL 5: talep künyesi tek kaynaktan (25.07, Aşama 3)
//
// İçeriğin adı iki kaynaktan gelebilir: ürünlü türlerde urunler join'i, ürünsüz
// türlerde (ik_egitimi, kurumsal...) talepler'in serbest alanı. Bu kural 13 ekranda
// ayrı ayrı kopyalanmıştı; dördünde yanlış kopyalandı ve ürünsüz eğitimlerde
// ekranlara, bildirimlere, Bunny video başlığına "-" yazıldı.
//
// Bekçi: talepler tablosundan urunler/teknikler join'i ELLE seçilirse uyarır.
// Doğrusu — istemci: /talepler/api/kunye ucu; sunucu: TALEP_ALANLARI + haritalaTalep
// (lib/utils/talepZinciri.ts). Tek kaynağın kendisi bu kuralın dışındadır.
const talepKunyeTekKaynak = {
  meta: {
    type: "problem",
    docs: { description: "Talep kunyesini elle sorgulamayi engeller; tek kaynak lib/utils/talepZinciri.ts." },
    schema: [],
    messages: {
      elle: "Talep kunyesi elle sorgulanmis (urunler/teknikler join'i). Istemci: /talepler/api/kunye ucunu, sunucu: TALEP_ALANLARI + haritalaTalep kullanin — ad kurali tek yerde durmali.",
    },
  },
  create(context) {
    const dosya = context.filename ?? context.getFilename?.() ?? "";
    // Tek kaynağın kendisi ve şema aracı muaf.
    if (dosya.includes("talepZinciri")) return {};

    return {
      // .select("... urunler(urun_adi) ...") — düz metin ya da şablon dizgi
      "CallExpression > MemberExpression[property.name='select']"(node) {
        const cagri = node.parent;
        const arg = cagri.arguments?.[0];
        if (!arg) return;

        let metin = null;
        if (arg.type === "Literal" && typeof arg.value === "string") metin = arg.value;
        else if (arg.type === "TemplateLiteral") metin = arg.quasis.map(q => q.value.raw).join(" ");
        if (!metin) return;

        // Künye join'i: ürün ya da teknik adı talepler üzerinden çekiliyor mu?
        const kunyeJoin = /urunler\s*\(\s*urun_adi|teknikler\s*\(\s*teknik_adi/.test(metin);
        if (!kunyeJoin) return;

        // Ortak listeyi kullanan sorgular muaf (şablonda ${TALEP_ALANLARI} geçer).
        if (/TALEP_ALANLARI/.test(context.sourceCode.getText(cagri))) return;

        context.report({ node: arg, messageId: "elle" });
      },
    };
  },
};

// KURAL 6: üretim hattı toast metni tek kaynaktan (26.07)
//
// Akış cümleleri ("Senaryo onaylandı.", "Revizyon talebi gönderildi.") beş
// dosyada satır içi string olarak yazılıydı. Sonuç: aynı olay her sayfada başka
// dille anlatılıyor, hiçbiri talebin varyantını bilmiyordu.
//
// Bekçi: üretim hattı dosyalarında basari() çağrısına DÜZ METİN geçilirse uyarır.
// Doğrusu uretimToast(...) — lib/uretim/toastMesaj.ts.
// hata() ve uyari() kapsam dışı: onlar teknik hata ve biçim uyarısı taşır,
// merkezde durmazlar.
const toastTekKaynak = {
  meta: {
    type: "problem",
    docs: { description: "Uretim hatti toast metnini sayfaya gomulmesini engeller; tek kaynak lib/uretim/toastMesaj.ts." },
    schema: [],
    messages: {
      gomulu: "Toast metni sayfaya gomulmus. Akis cumleleri lib/uretim/toastMesaj icindeki uretimToast(...) ile cozulur — metin tek yerde durmali.",
    },
  },
  create(context) {
    const dosya = (context.filename ?? context.getFilename?.() ?? "").replace(/\\/g, "/");
    // Yalnız üretim hattı: senaryo, video, soru seti ve talep ekranları.
    const hatta =
      dosya.includes("/app/senaryolar/") ||
      dosya.includes("/app/videolar/") ||
      dosya.includes("/app/soru-setleri/") ||
      dosya.includes("/app/talepler/");
    if (!hatta) return {};

    return {
      "CallExpression[callee.name='basari']"(node) {
        const arg = node.arguments?.[0];
        if (!arg) return;
        if (arg.type === "Literal" && typeof arg.value === "string") {
          context.report({ node: arg, messageId: "gomulu" });
        } else if (arg.type === "TemplateLiteral") {
          context.report({ node: arg, messageId: "gomulu" });
        }
      },
    };
  },
};

// KURAL 7: rol tek-kaynak — hard-code rol dizisi yasağı (B-09, ratchet)
//
// "Bu rolü kim görebilir" kararı lib/utils/roller.ts'teki adlandırılmış
// gruplardan (TUKETICI_ROLLER, ECLUB_TUKETICI_ROLLERI...) okunmalı; dosyalara
// elle yazılmamalı. Bekçi, İÇİNDE ≥2 hard-code rol string'i olan dizi
// literallerini (grup yeniden-tanımı) reddeder.
//
// KAPSAM DIŞI (bilinçli): tekil karşılaştırma (rol === "bm"), tip-union
// ("eczaci" | "eczane_teknisyeni" — ArrayExpression değil), tekil elemanlı
// dizi. Spread karışımı ([...URETICI_ROLLER, "iu"]) v1'de yakalanmaz; modül
// adımında elle temizlenir.
//
// RATCHET: bugün ihlal içeren dosyalar ROL_BASELINE'da tanınır (geçer). Her
// modül temizlendikçe o dosyalar baseline'dan düşer; baseline boşalınca kural
// tam sıkı olur. roller.ts'in kendisi her zaman muaf.
const ROL_LITERALLERI = new Set([
  "pm", "jr_pm", "kd_pm", "med_md", "egt_md", "egt_yrd_md", "egt_yon", "egt_uz",
  "ik_drk", "ik_md", "ik_yrd_md", "ik_uz", "ik_per", "gm", "gm_yrd", "drk",
  "paz_md", "blm_md", "grp_pm", "sm", "admin", "tm", "bm", "utt", "kd_utt", "iu",
  "eczaci", "eczane_teknisyeni",
]);
// "musteri"/"eczanem" bilinçli dışarıda: kimlik_turu/hedef_rol değerleri,
// rol-dizisi bağlamında nadir; eklemek gereksiz false-positive üretir.
const ROL_BASELINE = new Set([
  // 30.07 — mevcut ihlaller (50 dosya). Bir dosya tamamen temizlenince
  // buradan silinir (kural o dosyada sıkılaşır). Kompleks modül dosyaları
  // (kullanicilar/profil/raporlar/oneriler/takimlar) sıraları gelene kadar burada bekler.
  // T2+T7 (30.07): izle/api'nin tamamı temizlendi ve baseline'dan düşürüldü
  // (tüketim uçları → TUKETICI_ROLLER, IZLEME_ROLLERI → spread grupları).
]);
const rolTekKaynak = {
  meta: {
    type: "problem",
    docs: { description: "Hard-code rol dizisini engeller; tek kaynak lib/utils/roller.ts adlandirilmis gruplari." },
    schema: [],
    messages: {
      elle: "Hard-code rol dizisi: [{{roller}}]. roller.ts'teki adlandirilmis grubu kullan (or. TUKETICI_ROLLER) — rol karari tek yerde durmali.",
    },
  },
  create(context) {
    const yol = (context.filename ?? context.getFilename?.() ?? "").replace(/\\/g, "/");
    if (yol.endsWith("/lib/utils/roller.ts")) return {};
    for (const b of ROL_BASELINE) {
      if (yol.endsWith("/" + b)) return {};
    }
    return {
      ArrayExpression(node) {
        const roller = node.elements.filter(
          (el) =>
            el &&
            el.type === "Literal" &&
            typeof el.value === "string" &&
            ROL_LITERALLERI.has(el.value),
        );
        if (roller.length >= 2) {
          context.report({
            node,
            messageId: "elle",
            data: { roller: roller.map((r) => r.value).join(", ") },
          });
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
    "talep-kunye-tek-kaynak": talepKunyeTekKaynak,
    "toast-tek-kaynak": toastTekKaynak,
    "rol-tek-kaynak": rolTekKaynak,
  },
};

export default plugin;