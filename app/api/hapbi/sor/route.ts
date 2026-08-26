import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getHapbiKullaniciBaglami, hapbiKapsamAnahtari } from "@/lib/hapbi/hapbiKullaniciBaglami";
import { hapbiAraclariniOlustur } from "@/lib/hapbi/araclar";
import { hapbiHizliYanitUret, hapbiYanitUret } from "@/lib/hapbi/gemini";
import { HapbiHata, nesne, alanlariDogrula } from "@/lib/hapbi/sozlesme";
import { sohbetiAc, sohbetiPaketle, istekSinirlayiciOlustur } from "@/lib/hapbi/sohbet";
import { hizliSorguPlani } from "@/lib/hapbi/hizliSorgu";

export const maxDuration = 60;
const sinirla = istekSinirlayiciOlustur();
const headers = { "Cache-Control": "no-store" };

async function govdeyiOku(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw new HapbiHata("GOVDE", 400, "Soru gereklidir.");
  let boyut = 0;
  const parcalar: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    boyut += value.byteLength;
    if (boyut > 70000) {
      await reader.cancel();
      throw new HapbiHata("BOYUT", 413, "Sohbet isteği çok uzun.");
    }
    parcalar.push(value);
  }
  try { return nesne(JSON.parse(Buffer.concat(parcalar).toString("utf8"))); }
  catch { throw new HapbiHata("JSON", 400, "Geçersiz istek."); }
}

export async function POST(req: Request) {
  const baslangic = Date.now();
  const istekId = crypto.randomUUID();
  let serbestBirak: (() => void) | undefined;
  try {
    // Tarayıcıdan gelen çapraz kaynaklı sohbet çağrılarını kabul etme.
    const origin = req.headers.get("origin");
    if (origin && origin !== new URL(req.url).origin) throw new HapbiHata("ORIGIN", 403, "İstek kaynağı doğrulanamadı.");
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new HapbiHata("OTURUM", 401, "hapbi'yi kullanmak için oturum açın.");
    serbestBirak = sinirla(user.id);
    const body = await govdeyiOku(req);
    alanlariDogrula(body, ["soru", "pathname", "sohbet", "hizli"]);
    if (typeof body.soru !== "string" || !body.soru.trim() || body.soru.length > 2000) {
      throw new HapbiHata("SORU", 400, "Lütfen 1–2000 karakter arasında bir soru yazın.");
    }
    if (body.hizli !== undefined && typeof body.hizli !== "boolean") {
      throw new HapbiHata("HIZLI_SORGU", 400, "Hazır sorgu bilgisi geçersiz.");
    }
    const pathname = typeof body.pathname === "string" && /^\/[a-zA-Z0-9/_-]*$/.test(body.pathname) && body.pathname.length <= 200 ? body.pathname : "/";
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(50000)]);
    const db = createAdminClient(signal);
    const baglam = await getHapbiKullaniciBaglami(db, user.id);
    const kapsam = hapbiKapsamAnahtari(baglam);
    const imzaAnahtari = process.env.HAPBI_SOHBET_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const gecmis = sohbetiAc(body.sohbet, kapsam, imzaAnahtari);
    const araclar = hapbiAraclariniOlustur(db, baglam);
    const soru = body.soru.trim();
    const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
    const model = (process.env.GEMINI_MODEL || "gemini-flash-latest").trim();
    const plan = body.hizli === true ? hizliSorguPlani(baglam.rol, soru, araclar.takvim) : null;
    let hizliKullanildi = false;
    let sonuc;
    if (plan) {
      const aracSonucu = await araclar.calistir(plan.arac, plan.parametre);
      try {
        sonuc = await hapbiHizliYanitUret({
          soru, pathname, rol: baglam.rol, aracAdi: plan.arac, aracSonucu, apiKey, model, signal,
        });
        hizliKullanildi = true;
      } catch (hizliHata) {
        if (!(hizliHata instanceof HapbiHata) || hizliHata.kod.startsWith("MODEL_HTTP_") || ["MODEL_BAGLANTISI", "ZAMAN_ASIMI"].includes(hizliHata.kod)) throw hizliHata;
      }
    }
    sonuc ??= await hapbiYanitUret({
      soru, pathname, rol: baglam.rol, takvim: araclar.takvim, gecmis,
      arac: araclar.calistir, apiKey, model, signal,
    });
    const sohbet = sohbetiPaketle([...gecmis,
      { rol: "user", metin: body.soru.trim() }, { rol: "model", metin: sonuc.cevap },
    ], kapsam, imzaAnahtari);
    console.info("[hapbi]", { istekId, durum: "ok", hizli: hizliKullanildi, model: sonuc.model, araclar: sonuc.araclar, tokenSayisi: sonuc.tokenSayisi, sureMs: Date.now() - baslangic });
    return NextResponse.json({ cevap: sonuc.cevap, kaynaklar: sonuc.kaynaklar, egitimler: sonuc.egitimler, aksiyon: sonuc.aksiyon, model: sonuc.model, sohbet, istekId }, { headers });
  } catch (error) {
    const hata = error instanceof HapbiHata ? error : new HapbiHata("SUNUCU", 503, "hapbi şu anda yanıt veremiyor. Lütfen tekrar deneyin.");
    console.warn("[hapbi]", { istekId, durum: "hata", kod: hata.kod, sureMs: Date.now() - baslangic });
    return NextResponse.json({ error: hata.message, kod: hata.kod, istekId }, { status: hata.durum, headers });
  } finally { serbestBirak?.(); }
}
