import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { ECZANEM_KAPALI_MESAJI, uttEczanemErisimi } from "@/lib/eczanem/erisim";
import {
  UTT_MUTABAKAT_DURUMLARI,
  UTT_MUTABAKAT_KARARLARI,
  tmMutabakatKarariVer,
  tumUttMutabakatKayitlariniListele,
  uttMutabakatDonemiGecerliMi,
  uttMutabakatEczaneleriniListele,
  uttMutabakatEczaneIslemleriniListele,
  uttMutabakatIdGecerliMi,
  varsayilanUttMutabakatDonemi,
  type UttMutabakatFiltresi,
  type UttMutabakatKarari,
} from "@/lib/eczanem/uttMutabakat";
import { eclubYonetimKapsaminiGetir, type EclubKapsamUtt } from "@/lib/eclub/yonetimKapsami";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";

async function yetkiliTm() {
  const supabase = await createClient();
  const db = createAdminClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { hata: yetkiHatasi() };

  const rol = await rolCozucu(db, user.id);
  if (rol !== "tm") return { hata: rolHatasi("Mutabakat Takip sayfasına yalnız TM erişebilir.") };

  const erisim = await uttEczanemErisimi(db, user.id);
  if (!erisim.ok || !erisim.acik) return { hata: rolHatasi(erisim.hata ?? ECZANEM_KAPALI_MESAJI) };

  const { data: kullanici, error: kullaniciHatasi } = await db
    .from("kullanicilar")
    .select("kullanici_id, ad, soyad, rol, firma_id, takim_id, bolge_id")
    .eq("kullanici_id", user.id)
    .single();
  if (kullaniciHatasi || !kullanici) throw new Error("TM organizasyon kapsamı alınamadı.");

  const kapsam = await eclubYonetimKapsaminiGetir(db, kullanici);
  return { db, kullaniciId: user.id, uttler: kapsam.uttler.filter((utt) => utt.rol === "utt") };
}

const hedefUtt = (uttler: EclubKapsamUtt[], uttId: string) => uttler.find((utt) => utt.utt_id === uttId) ?? null;

export async function GET(request: NextRequest) {
  try {
    const yetki = await yetkiliTm();
    if (yetki.hata) return yetki.hata;

    const donem = request.nextUrl.searchParams.get("donem") ?? varsayilanUttMutabakatDonemi();
    const durum = request.nextUrl.searchParams.get("durum") ?? "tumu";
    const uttId = request.nextUrl.searchParams.get("utt_id");
    const eczaneId = request.nextUrl.searchParams.get("eczane_id");
    const urunId = request.nextUrl.searchParams.get("urun_id");
    const sayfaMetni = request.nextUrl.searchParams.get("sayfa") ?? "0";
    const gorunum = request.nextUrl.searchParams.get("gorunum");
    const sayfa = Number(sayfaMetni);

    if (!uttMutabakatDonemiGecerliMi(donem)
      || !UTT_MUTABAKAT_DURUMLARI.includes(durum as UttMutabakatFiltresi)
      || !/^\d{1,4}$/.test(sayfaMetni) || !Number.isSafeInteger(sayfa) || sayfa > 500
      || (gorunum !== null && gorunum !== "duz")
      || (uttId !== null && !uttMutabakatIdGecerliMi(uttId))
      || (eczaneId !== null && (uttId === null || !uttMutabakatIdGecerliMi(eczaneId)))
      || (urunId !== null && (eczaneId === null || !uttMutabakatIdGecerliMi(urunId)))) {
      return validasyonHatasi("Mutabakat takip filtreleri geçersiz.", ["donem", "durum", "sayfa", "utt_id", "eczane_id", "urun_id"]);
    }

    if (gorunum === "duz") {
      const uttKayitlari = await Promise.all(yetki.uttler!.map(async (utt) => {
        const kayitlar = await tumUttMutabakatKayitlariniListele(yetki.db!, utt.utt_id, donem, durum as UttMutabakatFiltresi);
        return kayitlar.map((kayit) => ({
          ...kayit,
          bm_adi: utt.bm_adi,
          utt_adi: utt.utt_adi,
        }));
      }));
      return NextResponse.json({ kayitlar: uttKayitlari.flat() }, { headers: { "Cache-Control": "no-store" } });
    }

    if (uttId) {
      if (!hedefUtt(yetki.uttler!, uttId)) return rolHatasi("Bu UTT takımınızın kapsamında değil.");
      const sonuc = eczaneId
        ? await uttMutabakatEczaneIslemleriniListele(yetki.db!, uttId, donem, durum as UttMutabakatFiltresi, eczaneId, urunId, sayfa)
        : await uttMutabakatEczaneleriniListele(yetki.db!, uttId, donem, durum as UttMutabakatFiltresi, sayfa);
      return NextResponse.json(sonuc, { headers: { "Cache-Control": "no-store" } });
    }

    const uttOzetleri = await Promise.all(yetki.uttler!.map(async (utt) => {
      const liste = await uttMutabakatEczaneleriniListele(yetki.db!, utt.utt_id, donem, durum as UttMutabakatFiltresi, 0);
      return { ...utt, toplam_eczane: liste.toplam_eczane, toplam: liste.toplam, toplam_puan: liste.toplam_puan, toplam_indirim_tl: liste.toplam_indirim_tl };
    }));

    return NextResponse.json({
      donem,
      durum,
      toplam_utt: uttOzetleri.length,
      toplam: uttOzetleri.reduce((toplam, utt) => toplam + utt.toplam, 0),
      toplam_puan: uttOzetleri.reduce((toplam, utt) => toplam + utt.toplam_puan, 0),
      toplam_indirim_tl: uttOzetleri.reduce((toplam, utt) => toplam + utt.toplam_indirim_tl, 0),
      uttler: uttOzetleri,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return sunucuHatasi(error, "GET /eczanem/tm/api/mutabakat");
  }
}

export async function POST(request: NextRequest) {
  try {
    const yetki = await yetkiliTm();
    if (yetki.hata) return yetki.hata;
    let body: unknown;
    try { body = await request.json(); } catch { return validasyonHatasi("Geçerli mutabakat kararı gönderin.", ["mutabakat_id", "islem", "karar"]); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return validasyonHatasi("Geçerli mutabakat kararı gönderin.", ["mutabakat_id", "islem", "karar"]);
    const alanlar = body as Record<string, unknown>;
    if (Object.keys(alanlar).some((alan) => !["mutabakat_id", "islem", "karar"].includes(alan))
      || alanlar.islem !== "karar_ver"
      || typeof alanlar.mutabakat_id !== "string"
      || !uttMutabakatIdGecerliMi(alanlar.mutabakat_id)
      || typeof alanlar.karar !== "string"
      || !UTT_MUTABAKAT_KARARLARI.includes(alanlar.karar as UttMutabakatKarari)) {
      return validasyonHatasi("TM mutabakat kararı geçersiz.", ["mutabakat_id", "islem", "karar"]);
    }
    const sonuc = await tmMutabakatKarariVer(
      yetki.db!, yetki.kullaniciId!, alanlar.mutabakat_id, alanlar.karar as UttMutabakatKarari,
    );
    return NextResponse.json(sonuc, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message.includes("42501")) return rolHatasi("Bu mutabakat işlemine erişim yetkiniz yok.");
    if (error instanceof Error && error.message.includes("P0001")) return NextResponse.json({ hata: "TM kararı artık değiştirilemez." }, { status: 422 });
    if (error instanceof Error && error.message.includes("P0002")) return NextResponse.json({ hata: "Mutabakat bulunamadı." }, { status: 404 });
    return sunucuHatasi(error, "POST /eczanem/tm/api/mutabakat");
  }
}
