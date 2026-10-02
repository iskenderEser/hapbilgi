import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { uttEczanemErisimi, ECZANEM_KAPALI_MESAJI } from "@/lib/eczanem/erisim";
import {
  UTT_MUTABAKAT_DURUMLARI, UTT_MUTABAKAT_KARARLARI,
  uttMutabakatDonemiGecerliMi, uttMutabakatIdGecerliMi,
  uttMutabakatUrunleriniListele, uttMutabakatUrunIslemleriniListele,
  uttMutabakatKarariVer, varsayilanUttMutabakatDonemi,
  type UttMutabakatFiltresi, type UttMutabakatKarari,
} from "@/lib/eczanem/uttMutabakat";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";

async function yetkiliUtt() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { hata: yetkiHatasi() };
  const rol = await rolCozucu(adminSupabase, user.id);
  if (rol !== "utt") return { hata: rolHatasi("Mutabakat sayfasına yalnız UTT erişebilir.") };
  const erisim = await uttEczanemErisimi(adminSupabase, user.id);
  if (!erisim.ok || !erisim.acik) {
    return { hata: rolHatasi(erisim.hata ?? ECZANEM_KAPALI_MESAJI) };
  }
  return { db: adminSupabase, uttId: user.id };
}

export async function GET(request: NextRequest) {
  try {
    const yetki = await yetkiliUtt();
    if (yetki.hata) return yetki.hata;
    const donem = request.nextUrl.searchParams.get("donem") ?? varsayilanUttMutabakatDonemi();
    const durum = request.nextUrl.searchParams.get("durum") ?? "tumu";
    const sayfaMetni = request.nextUrl.searchParams.get("sayfa") ?? "0";
    const urunId = request.nextUrl.searchParams.get("urun_id");
    const sayfa = Number(sayfaMetni);
    if (!uttMutabakatDonemiGecerliMi(donem) || !UTT_MUTABAKAT_DURUMLARI.includes(durum as UttMutabakatFiltresi)
      || !/^\d{1,4}$/.test(sayfaMetni) || !Number.isSafeInteger(sayfa) || sayfa > 500
      || (urunId !== null && !uttMutabakatIdGecerliMi(urunId))) {
      return validasyonHatasi("Mutabakat filtreleri geçersiz.", ["donem", "durum", "sayfa", "urun_id"]);
    }
    const sonuc = urunId
      ? await uttMutabakatUrunIslemleriniListele(yetki.db!, yetki.uttId!, donem, durum as UttMutabakatFiltresi, urunId, sayfa)
      : await uttMutabakatUrunleriniListele(yetki.db!, yetki.uttId!, donem, durum as UttMutabakatFiltresi, sayfa);
    return NextResponse.json(sonuc, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return sunucuHatasi(error, "GET /eczanem/utt/api/mutabakat");
  }
}

export async function POST(request: NextRequest) {
  try {
    const yetki = await yetkiliUtt();
    if (yetki.hata) return yetki.hata;
    let body: unknown;
    try { body = await request.json(); } catch { return validasyonHatasi("Geçerli karar verisi gönderin.", ["mutabakat_id", "karar"]); }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return validasyonHatasi("Geçerli karar verisi gönderin.", ["mutabakat_id", "karar"]);
    }
    const alanlar = body as Record<string, unknown>;
    if (Object.keys(alanlar).some((alan) => alan !== "mutabakat_id" && alan !== "karar")) {
      return validasyonHatasi("Yalnız mutabakat kimliği ve karar gönderilebilir.", ["mutabakat_id", "karar"]);
    }
    const { mutabakat_id, karar } = alanlar;
    if (typeof mutabakat_id !== "string" || !uttMutabakatIdGecerliMi(mutabakat_id)
      || typeof karar !== "string" || !UTT_MUTABAKAT_KARARLARI.includes(karar as UttMutabakatKarari)) {
      return validasyonHatasi("Mutabakat kimliği veya UTT kararı geçersiz.", ["mutabakat_id", "karar"]);
    }
    const sonuc = await uttMutabakatKarariVer(yetki.db!, yetki.uttId!, mutabakat_id, karar as UttMutabakatKarari);
    return NextResponse.json(sonuc, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message.includes("42501")) return rolHatasi("Bu mutabakat işlemine erişim yetkiniz yok.");
    if (error instanceof Error && error.message.includes("P0001")) {
      return NextResponse.json({ hata: "Bu dönem için karar süresi kapalı." }, { status: 422 });
    }
    if (error instanceof Error && error.message.includes("P0002")) {
      return NextResponse.json({ hata: "Mutabakat bulunamadı." }, { status: 404 });
    }
    return sunucuHatasi(error, "POST /eczanem/utt/api/mutabakat");
  }
}
