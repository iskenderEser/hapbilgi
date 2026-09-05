import dotenv from "dotenv";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hapbiAraclariniOlustur } from "@/lib/hapbi/araclar";
import { HAPBI_SISTEM_ISTEMI } from "@/lib/hapbi/gemini";
import { HAPBI_DAR_SISTEM_ISTEMI, hapbiMotorunuCalistir } from "@/lib/hapbi/motor";
import { getHapbiKullaniciBaglami, type HapbiKullaniciBaglami } from "@/lib/hapbi/hapbiKullaniciBaglami";
import { HapbiHata, type HapbiGecmisMesaji } from "@/lib/hapbi/sozlesme";
import { kritikIhlalVar, pilotAdimiGecti, pilotAdiminiDegerlendir, type PilotAracCagrisi } from "@/scripts/hapbi-pilot/degerlendir";
import { AI_PILOT_VAKALARI } from "@/scripts/hapbi-pilot/ai-vakalar";
import { ANALITIK_PILOT_VAKALARI } from "@/scripts/hapbi-pilot/analitik-vakalar";
import { PILOT_REFERANS_ZAMANI, PILOT_VAKALARI, pilotVakalariniDogrula, type PilotKullanici, type PilotVakasi } from "@/scripts/hapbi-pilot/vakalar";

dotenv.config({ path: ".env.local", quiet: true });

const PILOT_OKUMA_RPCLERI = new Set([
  "get_hb_ligi_haftalik_v2", "get_hb_ligi_aylik_v2", "get_hb_ligi_donemlik_v2", "get_hb_ligi_yillik_v2",
  "get_cc_ligi_haftalik", "get_cc_ligi_aylik", "get_cc_ligi_donemlik", "get_cc_ligi_yillik",
  "_cc_ligi_aralik", "get_kullanici_ozet", "get_kullanici_kategori_dagilimi", "get_uretici_rapor_ozet_v3",
  "get_yonetici_rapor_ana_ozet_v2", "get_yonetici_egitim_turu_etkisi_v3",
  "get_hapbi_tclub_analitik_v1", "get_hapbi_cclub_analitik_v1",
  "get_hapbi_eclub_analitik_v1", "get_hapbi_uretim_analitik_v1",
]);

export function saltOkunurSupabaseFetcher(supabaseUrl: string, asilFetcher: typeof fetch = fetch): typeof fetch {
  const izinliKok = new URL(supabaseUrl);
  return (async (girdi: RequestInfo | URL, baslatma?: RequestInit) => {
    const istek = girdi instanceof Request ? girdi : null;
    const url = new URL(istek?.url ?? String(girdi));
    const yontem = String(baslatma?.method ?? istek?.method ?? "GET").toUpperCase();
    if (url.origin !== izinliKok.origin) throw new Error(`Pilot yalnız yapılandırılmış Supabase sunucusuna erişebilir: ${url.origin}`);
    if (["GET", "HEAD"].includes(yontem)) return asilFetcher(girdi, baslatma);
    const rpc = url.pathname.match(/\/rest\/v1\/rpc\/([^/?]+)/u)?.[1];
    if (yontem === "POST" && rpc && PILOT_OKUMA_RPCLERI.has(decodeURIComponent(rpc))) {
      return asilFetcher(girdi, baslatma);
    }
    throw new Error(`Pilot salt okunur erişim kapısı isteği reddetti: ${yontem} ${url.pathname}`);
  }) as typeof fetch;
}

interface Secenekler {
  kontrol: boolean;
  paket: "kesin" | "ai" | "analitik";
  tekrar: number;
  vakaIdleri: Set<string> | null;
  cikti: string | null;
  kati: boolean;
  simdi: Date;
}

function secenekleriOku(argv: string[]): Secenekler {
  const deger = (ad: string) => argv.find(arguman => arguman.startsWith(`${ad}=`))?.slice(ad.length + 1);
  const tekrar = Number(deger("--tekrar") ?? "1");
  const simdi = new Date(deger("--simdi") ?? PILOT_REFERANS_ZAMANI);
  if (!Number.isInteger(tekrar) || tekrar < 1 || tekrar > 10) throw new Error("--tekrar 1–10 arasında tam sayı olmalıdır.");
  if (Number.isNaN(simdi.getTime())) throw new Error("--simdi geçerli bir ISO tarih olmalıdır.");
  const vaka = deger("--vaka");
  return {
    kontrol: argv.includes("--kontrol"),
    paket: deger("--paket") === "analitik" ? "analitik" : deger("--paket") === "ai" ? "ai" : "kesin",
    tekrar,
    vakaIdleri: vaka ? new Set(vaka.split(",").map(id => id.trim()).filter(Boolean)) : null,
    cikti: deger("--cikti") ?? null,
    kati: argv.includes("--kati"), simdi,
  };
}

function hassasAlanlariTemizle(deger: unknown): unknown {
  if (Array.isArray(deger)) return deger.map(hassasAlanlariTemizle);
  if (!deger || typeof deger !== "object") return deger;
  const sonuc: Record<string, unknown> = {};
  for (const [anahtar, icerik] of Object.entries(deger)) {
    if (/(?:token|secret|anahtar|telefon|eposta|email|gln|adres)/iu.test(anahtar)) continue;
    if (/^(?:kullanici|auth|firma|takim|bolge|kisi|musteri|eczane|oneri)_id$/iu.test(anahtar)) continue;
    sonuc[anahtar] = hassasAlanlariTemizle(icerik);
  }
  return sonuc;
}

function commitKimligi(): string {
  try { return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); }
  catch { return "bilinmiyor"; }
}

function calismaAgaciDurumu(): "temiz" | "degisik" | "bilinmiyor" {
  try { return execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() ? "degisik" : "temiz"; }
  catch { return "bilinmiyor"; }
}

async function kullaniciyiBul(db: SupabaseClient, hedef: PilotKullanici): Promise<HapbiKullaniciBaglami> {
  let sorgu = db.from("kullanicilar")
    .select("kullanici_id, ad, soyad, rol, aktif_mi")
    .ilike("ad", hedef.ad).ilike("soyad", hedef.soyad).eq("rol", hedef.rol).eq("aktif_mi", true);
  if (hedef.eposta) sorgu = sorgu.ilike("eposta", hedef.eposta);
  const { data, error } = await sorgu.limit(2);
  if (error) throw new Error(`${hedef.rol} test kullanıcısı okunamadı: ${error.message}`);
  if (data?.length !== 1) throw new Error(`${hedef.ad} ${hedef.soyad} için tek aktif ${hedef.rol} hesabı bulunmalı; bulunan: ${data?.length ?? 0}.`);
  const baglam = await getHapbiKullaniciBaglami(db, String(data[0].kullanici_id));
  if (baglam.rol !== hedef.rol) throw new Error(`${hedef.rol} rol doğrulaması başarısız.`);
  if (hedef.beklenenTakim && baglam.takim_adi !== hedef.beklenenTakim) throw new Error(`${hedef.rol} takım kapsamı ${hedef.beklenenTakim} değil.`);
  if (hedef.beklenenBolge && baglam.bolge_adi !== hedef.beklenenBolge) throw new Error(`${hedef.rol} bölge kapsamı ${hedef.beklenenBolge} değil.`);
  return baglam;
}

function baglamiKaydet(hedef: PilotKullanici, baglam: HapbiKullaniciBaglami) {
  return {
    test_kullanicisi: `${hedef.ad} ${hedef.soyad}`,
    rol: baglam.rol,
    kimlik_turu: baglam.kimlik_turu,
    firma: baglam.firma_adi,
    takim: baglam.takim_adi,
    bolge: baglam.bolge_adi,
    cc_aktif: baglam.cc_aktif,
    eclub_aktif: baglam.eclub_aktif,
  };
}

async function vakayiCalistir(
  db: SupabaseClient,
  vaka: PilotVakasi,
  tekrar: number,
  simdi: Date,
  apiKey: string,
  model: string,
) {
  const baglam = await kullaniciyiBul(db, vaka.kullanici);
  const araclar = hapbiAraclariniOlustur(db, baglam, simdi);
  const gecmis: HapbiGecmisMesaji[] = [];
  const adimKayitlari = [];

  for (const [adimIndisi, adim] of vaka.adimlar.entries()) {
    const aracCagrilari: PilotAracCagrisi[] = [];
    const modelYanitlari: unknown[] = [];
    let modelCagrisi = 0;
    const baslangic = performance.now();
    try {
      const sonuc = await hapbiMotorunuCalistir({
        soru: adim.soru, pathname: adim.pathname, rol: baglam.rol, takvim: araclar.takvim, gecmis,
        arac: async (ad, parametre) => {
          const aracBaslangici = performance.now();
          try {
            const aracSonucu = await araclar.calistir(ad, parametre);
            aracCagrilari.push({ ad, parametre: hassasAlanlariTemizle(parametre), sonuc: hassasAlanlariTemizle(aracSonucu), sureMs: Math.round(performance.now() - aracBaslangici) });
            return aracSonucu;
          } catch (hata) {
            aracCagrilari.push({ ad, parametre: hassasAlanlariTemizle(parametre), sureMs: Math.round(performance.now() - aracBaslangici), hata: hata instanceof Error ? hata.message : "Bilinmeyen araç hatası" });
            throw hata;
          }
        },
        apiKey, model,
        fetcher: async (girdi, baslatma) => {
          modelCagrisi += 1;
          const yanit = await fetch(girdi, baslatma);
          try {
            const govde = await yanit.clone().json();
            const cagrilar = govde?.candidates?.flatMap((aday: { content?: { parts?: { functionCall?: unknown }[] } }) =>
              aday.content?.parts?.flatMap(parca => parca.functionCall ? [parca.functionCall] : []) ?? []) ?? [];
            modelYanitlari.push(hassasAlanlariTemizle(cagrilar));
          } catch { modelYanitlari.push([]); }
          return yanit;
        },
      });
      const kontroller = pilotAdiminiDegerlendir(adim, sonuc.cevap, sonuc.kaynaklar, aracCagrilari, sonuc.yol);
      adimKayitlari.push({
        adim: adimIndisi + 1, soru: adim.soru, beklenen_davranis: adim.davranis,
        cevap: sonuc.cevap, kaynaklar: sonuc.kaynaklar, egitimler: hassasAlanlariTemizle(sonuc.egitimler),
        arac_cagrilari: aracCagrilari, model_cagrisi: modelCagrisi, model_yanitlari: modelYanitlari,
        token_sayisi: sonuc.tokenSayisi, yol: sonuc.yol,
        sure_ms: Math.round(performance.now() - baslangic), kontroller,
        otomatik_sonuc: pilotAdimiGecti(kontroller) ? "gecti" : "kaldi",
        kritik_ihlal: kritikIhlalVar(kontroller), hata: null,
      });
      gecmis.push({ rol: "user", metin: adim.soru }, { rol: "model", metin: sonuc.cevap });
    } catch (hata) {
      adimKayitlari.push({
        adim: adimIndisi + 1, soru: adim.soru, beklenen_davranis: adim.davranis,
        cevap: null, kaynaklar: [], egitimler: [], arac_cagrilari: aracCagrilari,
        model_cagrisi: modelCagrisi, model_yanitlari: modelYanitlari,
        token_sayisi: null, sure_ms: Math.round(performance.now() - baslangic),
        kontroller: [], otomatik_sonuc: "hata", kritik_ihlal: true,
        hata: hata instanceof HapbiHata ? { kod: hata.kod, mesaj: hata.message } : { kod: "BEKLENMEYEN", mesaj: hata instanceof Error ? hata.message : "Bilinmeyen hata" },
      });
      break;
    }
  }
  return {
    vaka: vaka.id, baslik: vaka.baslik, tekrar,
    baglam: baglamiKaydet(vaka.kullanici, baglam), adimlar: adimKayitlari,
    otomatik_sonuc: adimKayitlari.every(kayit => kayit.otomatik_sonuc === "gecti") ? "gecti" : "kaldi",
  };
}

async function main() {
  const secenekler = secenekleriOku(process.argv.slice(2));
  const paketVakalar = secenekler.paket === "analitik"
    ? ANALITIK_PILOT_VAKALARI
    : secenekler.paket === "ai" ? AI_PILOT_VAKALARI : PILOT_VAKALARI;
  const tanimHatalari = pilotVakalariniDogrula(paketVakalar);
  if (tanimHatalari.length) throw new Error(`Pilot tanımı geçersiz:\n${tanimHatalari.join("\n")}`);
  if (secenekler.kontrol) {
    console.log(`${secenekler.paket} pilot tanımı geçerli: ${paketVakalar.length} vaka, ${paketVakalar.reduce((toplam, vaka) => toplam + vaka.adimlar.length, 0)} soru adımı.`);
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.GEMINI_API_KEY;
  const model = (process.env.GEMINI_MODEL || "gemini-flash-latest").trim();
  if (!supabaseUrl || !serviceRoleKey || !apiKey) throw new Error("Supabase veya Gemini ortam değişkenleri eksik.");

  const vakalar = secenekler.vakaIdleri
    ? paketVakalar.filter(vaka => secenekler.vakaIdleri!.has(vaka.id))
    : paketVakalar;
  if (!vakalar.length) throw new Error("Çalıştırılacak pilot vakası bulunamadı.");
  if (secenekler.vakaIdleri) {
    const bulunan = new Set(vakalar.map(vaka => vaka.id));
    const eksik = [...secenekler.vakaIdleri].filter(id => !bulunan.has(id as PilotVakasi["id"]));
    if (eksik.length) throw new Error(`Bilinmeyen vaka kimliği: ${eksik.join(", ")}`);
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: saltOkunurSupabaseFetcher(supabaseUrl) },
  });
  const sonuclar = [];
  for (let tekrar = 1; tekrar <= secenekler.tekrar; tekrar++) {
    for (const vaka of vakalar) {
      console.log(`[${tekrar}/${secenekler.tekrar}] ${vaka.id} — ${vaka.baslik}`);
      sonuclar.push(await vakayiCalistir(db, vaka, tekrar, secenekler.simdi, apiKey, model));
    }
  }

  const zaman = new Date().toISOString();
  const rapor = {
    surum: 1,
    meta: {
      olusturulma_zamani: zaman,
      referans_zamani: secenekler.simdi.toISOString(),
      commit: commitKimligi(), calisma_agaci: calismaAgaciDurumu(), model,
      model_ayari: secenekler.paket === "ai"
        ? { kanitli_yorum: { temperature: 0.1, max_output_tokens: 1200 }, serbest_yol: { temperature: 0.2, max_output_tokens: 3000 } }
        : { temperature: 0.2, max_output_tokens: 3000 },
      sistem_istemi_sha256: createHash("sha256").update(`${HAPBI_SISTEM_ISTEMI}\n${HAPBI_DAR_SISTEM_ISTEMI}`).digest("hex"),
      motor_mimarisi: "deterministik_cekirdek_ve_dar_ai",
      paket: secenekler.paket, vaka_sayisi: vakalar.length, tekrar: secenekler.tekrar,
      veri_erisim_kurali: "Supabase üzerinde yalnız SELECT/RPC tabanlı HapBi okuma araçları; iş verisi yazımı yok.",
      otomatik_degerlendirme_notu: "Metin ve araç kontrolleri ilk taramadır; protokoldeki hata sahipliği ayrıca incelenir.",
    },
    ozet: {
      toplam_kosum: sonuclar.length,
      gecen: sonuclar.filter(sonuc => sonuc.otomatik_sonuc === "gecti").length,
      kalan: sonuclar.filter(sonuc => sonuc.otomatik_sonuc !== "gecti").length,
      kritik_ihlal: sonuclar.filter(sonuc => sonuc.adimlar.some(adim => adim.kritik_ihlal)).length,
    },
    sonuclar,
  };
  const dosya = resolve(secenekler.cikti ?? `.hapbi-pilot/${zaman.replaceAll(":", "-")}.json`);
  await mkdir(resolve(dosya, ".."), { recursive: true });
  await writeFile(dosya, `${JSON.stringify(rapor, null, 2)}\n`, "utf8");
  console.log(`Rapor: ${dosya}`);
  console.log(`Geçen: ${rapor.ozet.gecen}/${rapor.ozet.toplam_kosum}; kritik ihlal: ${rapor.ozet.kritik_ihlal}`);
  if (secenekler.kati && rapor.ozet.kalan > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
