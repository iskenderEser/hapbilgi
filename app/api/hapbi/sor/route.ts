import { NextResponse } from "next/server";

import { biKullanabilirMi } from "@/lib/bi/erisim";
import { uttPuaniniOku } from "@/lib/bi/uttPuan";
import { tmKapsaminiCoz, tmKapsamPuaniniOku } from "@/lib/bi/tmPuan";
import { bmPuaniniOku } from "@/lib/bi/bmPuan";
import { puanBasliklari, puanBaglaminiOku } from "@/lib/bi/puanSozlesmesi";
import { geminiIleKacSorusunuCoz } from "@/lib/bi/gemini";
import { nedirSorusunuCoz } from "@/lib/bi/nedir";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const YANIT_BASLIKLARI = { "Cache-Control": "no-store" };
const EN_FAZLA_GOVDE_BOYUTU = 70_000;
const EN_FAZLA_SORU_UZUNLUGU = 2_000;

type KimlikKaydi = Readonly<{
  kimlik_id: string | null;
  kimlik_turu: string | null;
  rol: string | null;
  aktif_mi: boolean | null;
}>;

function json(icerik: unknown, durum = 200): NextResponse {
  return NextResponse.json(icerik, { status: durum, headers: YANIT_BASLIKLARI });
}

async function soruyuOku(istek: Request): Promise<{ soru: string; baglam?: unknown }> {
  const uzunluk = Number(istek.headers.get("content-length") ?? "0");
  if (Number.isFinite(uzunluk) && uzunluk > EN_FAZLA_GOVDE_BOYUTU) {
    throw new Error("ISTEK_COK_UZUN");
  }

  let ham: unknown;
  try {
    ham = await istek.json();
  } catch {
    throw new Error("GECERSIZ_JSON");
  }
  if (!ham || typeof ham !== "object" || Array.isArray(ham)) {
    throw new Error("GECERSIZ_JSON");
  }

  const soruDegeri = (ham as Record<string, unknown>).soru;
  const soru = typeof soruDegeri === "string" ? soruDegeri.trim() : "";
  if (!soru || soru.length > EN_FAZLA_SORU_UZUNLUGU) {
    throw new Error("GECERSIZ_SORU");
  }
  return { soru, baglam: (ham as Record<string, unknown>).baglam };
}

function hataYaniti(hata: unknown, istekId: string): NextResponse {
  const kod = hata instanceof Error ? hata.message : "SUNUCU";
  if (kod === "ISTEK_COK_UZUN") {
    return json({ error: "Sohbet isteği çok uzun.", kod, istekId }, 413);
  }
  if (kod === "GECERSIZ_JSON") {
    return json({ error: "Geçersiz istek.", kod, istekId }, 400);
  }
  if (kod === "GECERSIZ_SORU") {
    return json({ error: "Lütfen 1–2000 karakter arasında bir soru yazın.", kod, istekId }, 400);
  }
  console.warn("[bi]", { istekId, durum: "hata", kod });
  return json({ error: "bi şu anda yanıt veremiyor. Lütfen tekrar deneyin.", kod: "SUNUCU", istekId }, 503);
}

export async function POST(istek: Request): Promise<NextResponse> {
  const istekId = crypto.randomUUID();

  try {
    const origin = istek.headers.get("origin");
    if (origin && origin !== new URL(istek.url).origin) {
      return json({ error: "İstek kaynağı doğrulanamadı.", kod: "ORIGIN", istekId }, 403);
    }

    const supabase = await createClient();
    const { data: { user }, error: oturumHatasi } = await supabase.auth.getUser();
    if (oturumHatasi || !user) {
      return json({ error: "bi'yi kullanmak için oturum açın.", kod: "OTURUM", istekId }, 401);
    }

    const { soru, baglam } = await soruyuOku(istek);

    const db = createAdminClient(AbortSignal.any([istek.signal, AbortSignal.timeout(30_000)]));
    const { data, error } = await db
      .from("v_auth_kimlik_admin")
      .select("kimlik_id, kimlik_turu, rol, aktif_mi")
      .eq("auth_id", user.id)
      .maybeSingle();
    if (error || !data) {
      return json({ error: "bi kullanıcı kapsamı doğrulanamadı.", kod: "KIMLIK", istekId }, 503);
    }

    const kimlik = data as KimlikKaydi;
    if (!kimlik.aktif_mi || !biKullanabilirMi(kimlik.kimlik_turu, kimlik.rol)) {
      return json({ error: "bi bu kullanıcı rolünde kullanılamaz.", kod: "BI_KAPALI", istekId }, 403);
    }

    const nedir = nedirSorusunuCoz(soru);
    if (nedir.durum === "bulundu") {
      return json({
        cevap: nedir.konu.cevap,
        aksiyon: nedir.konu.aksiyon,
        kaynaklar: [],
        kullanim: { yol: "nedir", konu: nedir.konu.id },
        istekId,
      });
    }
    // Tanım paketinde bulunmayan kavrama ilgisiz rapor önerilmez.
    if (nedir.durum === "tanim_yok") {
      return json({ cevap: "Puanlarınızı hafta, ay, dönem veya yıl için sorabilirsiniz.", kaynaklar: [], kullanim: { yol: "destek" }, istekId });
    }


    const kac = await geminiIleKacSorusunuCoz(soru, istek.signal, puanBaglaminiOku(baglam, kimlik.rol ?? ""), kimlik.rol ?? "");
    if (kac.durum !== "bulundu") {
      return json({ cevap: "Puanlarınızı hafta, ay, dönem veya yıl için sorabilirsiniz.", kaynaklar: [], kullanim: { yol: "destek" }, istekId });
    }
    if (!kimlik.kimlik_id || !kimlik.rol) {
      return json({ error: "bi kullanıcı kapsamı doğrulanamadı.", kod: "KIMLIK", istekId }, 503);
    }

    const basliklar = puanBasliklari(kimlik.rol);
    const puanOku = kimlik.rol.toLowerCase() === "bm" ? bmPuaniniOku : uttPuaniniOku;
    const simdi = new Date();
    try {
      const kapsam = kimlik.rol.toLowerCase() === "tm" ? await tmKapsaminiCoz(db, kimlik.kimlik_id, kac.sorgu) : undefined;
      const oku = (sorgu: typeof kac.sorgu) => kapsam
        ? tmKapsamPuaniniOku(db, kapsam, sorgu, simdi)
        : puanOku(db, kimlik.kimlik_id!, kimlik.rol!, sorgu, simdi);
      const sonuc = await oku(kac.sorgu);
      const tarih = (v: string) => new Date(v).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
      const satir = (v: typeof sonuc) => `${v.donem.etiket} — ${basliklar[kac.sorgu.olcut]}: **${v.puan.toLocaleString("tr-TR")} puan**.\n${tarih(v.donem.baslangic)} – ${tarih(v.donem.bitis)}`;
      let cevap = (kapsam ? kapsam.etiket + "\n\n" : "") + satir(sonuc);
      if (kac.sorgu.karsilastir) {
        const onceki = await oku({ ...kac.sorgu, geriye: kac.sorgu.geriye + 1 });
        const fark = sonuc.puan - onceki.puan;
        cevap += `\n\n${satir(onceki)}\n\nFark: **${fark > 0 ? "+" : ""}${fark.toLocaleString("tr-TR")} puan**.`;
      }
      return json({ cevap, baglam: { ...kac.sorgu, karsilastir: false },
        kaynaklar: [{ id: kapsam ? "tm_puan" : kimlik.rol.toLowerCase() === "bm" ? "bm_puan" : "utt_puan", baslik: basliklar[kac.sorgu.olcut],
          zaman: simdi.toISOString(), donem: sonuc.donem.etiket }],
        kullanim: { yol: "kac", olcut: kac.sorgu.olcut }, istekId });
    } catch (hata) {
      const kod = hata instanceof Error ? hata.message : "VERI_OKUNAMADI";
      return json({ cevap: "Puan verisi şu anda okunamadı. Lütfen tekrar deneyin.", kaynaklar: [], kullanim: { yol: kod.toLowerCase() }, istekId });
    }
  } catch (hata) {
    return hataYaniti(hata, istekId);
  }
}
