import { NextResponse } from "next/server";

import { biKullanabilirMi } from "@/lib/bi/erisim";
import { NEDIR_KATALOGU, nedirSorusunuCoz } from "@/lib/bi/nedir";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const YANIT_BASLIKLARI = { "Cache-Control": "no-store" };
const EN_FAZLA_GOVDE_BOYUTU = 70_000;
const EN_FAZLA_SORU_UZUNLUGU = 2_000;

type KimlikKaydi = Readonly<{
  kimlik_turu: string | null;
  rol: string | null;
  aktif_mi: boolean | null;
}>;

function json(icerik: unknown, durum = 200): NextResponse {
  return NextResponse.json(icerik, { status: durum, headers: YANIT_BASLIKLARI });
}

async function soruyuOku(istek: Request): Promise<string> {
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
  return soru;
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

function destekYaniti(istekId: string, cevap?: string): NextResponse {
  const konuAdlari = NEDIR_KATALOGU.map((konu) => konu.baslik).join(", ");
  return json({
    cevap: cevap ??
      `Bu soru NEDİR sözleşmesine uymuyor. “HBStore nedir?” diye sorabilirsiniz.\n\nTanımlayabildiğim konular: ${konuAdlari}.`,
    kaynaklar: [],
    kullanim: { yol: "destek" },
    istekId,
  });
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

    const soru = await soruyuOku(istek);

    const db = createAdminClient(AbortSignal.any([istek.signal, AbortSignal.timeout(30_000)]));
    const { data, error } = await db
      .from("v_auth_kimlik_admin")
      .select("kimlik_turu, rol, aktif_mi")
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
    if (nedir.durum === "tanim_yok") {
      return destekYaniti(
        istekId,
        `“${nedir.aranan}” için onaylı bir tanımım yok. Yalnız listelenen HapBilgi kavramlarını açıklayabilirim.`,
      );
    }

    return destekYaniti(istekId);
  } catch (hata) {
    return hataYaniti(hata, istekId);
  }
}
