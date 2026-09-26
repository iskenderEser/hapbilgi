import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { aktifPeriyot } from "@/lib/zaman/kontrol";
import { tarihAraligi } from "@/lib/utils/tarihAraligi";
import { getSahaLig, type SahaLigKullanici } from "@/lib/tclub/hbligi/getSahaLig";
import { getUreticiEtkiLigi } from "@/lib/tclub/hbligi/getUreticiEtkiLigi";
import type { LigPeriyot } from "@/lib/tclub/hbligi/ligRpcCagir";
import { katkiYuzdesi } from "@/lib/rapor/paylasilan/oran";
import { getUreticiYayinDetaylari, type UreticiYayinPerformansi } from "@/lib/rapor/tclubUretici/getYayinDetaylari";

const GECERLI_PERIYOTLAR = new Set(["bu_hafta", "bu_ay", "bu_donem", "bu_yil"]);

function ligPeriyodu(periyot: string): LigPeriyot {
  const aktif = aktifPeriyot();
  if (periyot === "bu_hafta") return { periyot: "hafta", ...aktif };
  if (periyot === "bu_donem") return { periyot: "donem", ...aktif };
  if (periyot === "bu_yil") return { periyot: "yil", ...aktif };
  return { periyot: "ay", ...aktif };
}

function ozetle(satirlar: SahaLigKullanici[]) {
  const ozet = satirlar.reduce((toplam, satir) => ({
    izleme_puani: toplam.izleme_puani + satir.izleme_puani,
    cevaplama_puani: toplam.cevaplama_puani + satir.cevaplama_puani,
    oneri_puani: toplam.oneri_puani + satir.oneri_puani,
    extra_puani: toplam.extra_puani + satir.extra_puani,
    eclub_puani: toplam.eclub_puani + (satir.eclub_puani ?? 0),
    ileri_sarma_kaybi: toplam.ileri_sarma_kaybi + satir.ileri_sarma_kaybi,
    yanlis_cevap_kaybi: toplam.yanlis_cevap_kaybi + satir.yanlis_cevap_kaybi,
    oneri_kaybi: toplam.oneri_kaybi + satir.oneri_kaybi,
  }), {
    izleme_puani: 0, cevaplama_puani: 0, oneri_puani: 0, extra_puani: 0, eclub_puani: 0,
    ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 0, oneri_kaybi: 0,
  });
  const kazanilan_puan = ozet.izleme_puani + ozet.cevaplama_puani + ozet.oneri_puani + ozet.extra_puani + ozet.eclub_puani;
  const kaybedilen_puan = ozet.ileri_sarma_kaybi + ozet.yanlis_cevap_kaybi + ozet.oneri_kaybi;
  return { ...ozet, kazanilan_puan, kaybedilen_puan, net_puan: kazanilan_puan - kaybedilen_puan };
}

function sahaGrupla(satirlar: SahaLigKullanici[], tur: "takim" | "bolge") {
  const gruplar = new Map<string, { ad: string; satirlar: SahaLigKullanici[] }>();
  for (const satir of satirlar) {
    const id = tur === "takim" ? satir.takim_id : satir.bolge_id;
    if (!id) continue;
    const mevcut = gruplar.get(id) ?? { ad: tur === "takim" ? satir.takim : satir.bolge, satirlar: [] };
    mevcut.satirlar.push(satir);
    gruplar.set(id, mevcut);
  }
  return [...gruplar].map(([id, grup]) => {
    const ozet = ozetle(grup.satirlar);
    return { id, ad: grup.ad, utt_sayisi: grup.satirlar.length, kazanilan_puan: ozet.kazanilan_puan, kaybedilen_puan: ozet.kaybedilen_puan, net_puan: ozet.net_puan };
  }).sort((a, b) => b.net_puan - a.net_puan || a.ad.localeCompare(b.ad, "tr"));
}

function icerikGrupla(
  yayinlar: UreticiYayinPerformansi[],
  anahtar: (yayin: UreticiYayinPerformansi) => string | null,
) {
  const gruplar = new Map<string, { anahtar: string; ad: string; tamamlanma: number; kazanilan_puan: number; kaybedilen_puan: number; net_puan: number }>();
  for (const yayin of yayinlar) {
    const deger = anahtar(yayin);
    if (!deger) continue;
    const mevcut = gruplar.get(deger) ?? { anahtar: deger, ad: deger, tamamlanma: 0, kazanilan_puan: 0, kaybedilen_puan: 0, net_puan: 0 };
    mevcut.tamamlanma += yayin.tamamlanma;
    mevcut.kazanilan_puan += yayin.kazanilan_puan;
    mevcut.kaybedilen_puan += yayin.kaybedilen_puan;
    mevcut.net_puan += yayin.net_puan;
    gruplar.set(deger, mevcut);
  }
  return [...gruplar.values()].sort((a, b) => b.net_puan - a.net_puan || a.ad.localeCompare(b.ad, "tr"));
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const periyot = searchParams.get("periyot") || "bu_ay";
    if (!GECERLI_PERIYOTLAR.has(periyot)) return validasyonHatasi("Geçersiz rapor periyodu.", ["periyot"]);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi("Oturum açılmamış");

    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id,ad,soyad,rol,firma_id")
      .eq("kullanici_id", user.id)
      .single();
    if (kullaniciError || !kullanici) return hataYaniti("Kullanıcı bulunamadı", "kullanicilar SELECT", kullaniciError);
    if (!URETICI_ROLLER.includes(String(kullanici.rol).toLowerCase())) return yetkiHatasi("Bu rapora erişim yetkiniz yok");
    if (!kullanici.firma_id) return hataYaniti("Üretici rolüne firma atanmamış", "kullanicilar.firma_id", null);

    const seciliLigPeriyodu = ligPeriyodu(periyot);
    const { baslangic, bitis } = tarihAraligi(periyot);
    const firmaLigi = await getSahaLig(adminSupabase, {
      gorunum: "yonetici",
      firma_id: kullanici.firma_id,
      takim_id: null,
      bolge_id: null,
    }, seciliLigPeriyodu);
    const [yayinlariminLigi, yayinlar] = await Promise.all([
      getUreticiEtkiLigi(adminSupabase, firmaLigi, kullanici.kullanici_id, seciliLigPeriyodu),
      getUreticiYayinDetaylari(adminSupabase, {
        ureticiId: kullanici.kullanici_id,
        firmaId: kullanici.firma_id,
        yetkiliUttler: firmaLigi.lig.map((satir) => ({ kullanici_id: satir.kullanici_id, ad: satir.ad })),
        baslangic,
        bitis,
      }),
    ]);
    const firmaOzeti = ozetle(firmaLigi.lig);
    const yayinlariminOzeti = ozetle(yayinlariminLigi.lig);
    const yayinDetayNeti = yayinlar.reduce((toplam, yayin) => toplam + yayin.net_puan, 0);

    return NextResponse.json({
      success: true,
      data: {
        kullanici: { ad: kullanici.ad, soyad: kullanici.soyad, rol: kullanici.rol, firma_adi: firmaLigi.kapsam_adi },
        ozet: firmaOzeti,
        bilesenler: firmaOzeti,
        saha: {
          takimlar: sahaGrupla(firmaLigi.lig, "takim"),
          bolgeler: sahaGrupla(firmaLigi.lig, "bolge"),
          uttler: [...firmaLigi.lig].sort((a, b) => b.toplam_puan - a.toplam_puan || a.ad.localeCompare(b.ad, "tr")),
        },
        yayin_katkisi: {
          ...yayinlariminOzeti,
          firma_net_puani: firmaOzeti.net_puan,
          katki_yuzdesi: katkiYuzdesi(yayinlariminOzeti.net_puan, firmaOzeti.net_puan),
          yayin_sayisi: yayinlar.length,
          tamamlanma: yayinlar.reduce((toplam, yayin) => toplam + yayin.tamamlanma, 0),
        },
        yayinlar,
        icerik: {
          araclar: icerikGrupla(yayinlar, (yayin) => yayin.arac_turu),
          kategoriler: icerikGrupla(yayinlar, (yayin) => yayin.icerik_turu),
          urunler: icerikGrupla(yayinlar, (yayin) => yayin.urun_adi),
        },
        tutarlilik: {
          yayinlarimin_lig_neti: yayinlariminOzeti.net_puan,
          yayin_detay_neti: yayinDetayNeti,
          eslesiyor: yayinlariminOzeti.net_puan === yayinDetayNeti,
        },
      },
    });
  } catch (error) {
    return sunucuHatasi(error, "GET /raporlar/api/tclub-uretici");
  }
}
