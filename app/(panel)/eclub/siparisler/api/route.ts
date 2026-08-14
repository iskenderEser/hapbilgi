import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  eclubSiparisSorgusunuParse,
  type EclubEkipSiparisSatiri,
  type EclubSiparisApiData,
  type EclubSiparisOzet,
  type EclubSiparisSorgusu,
} from "@/lib/eclub/store/ekipSiparis";
import { eclubYonetimKapsaminiGetir, type EclubKapsamUtt } from "@/lib/eclub/yonetimKapsami";
import { ECLUB_YONETIM_ROLLERI } from "@/lib/utils/roller";
import { trGunEkle } from "@/lib/zaman/kontrol";
import {
  hataYaniti,
  rolHatasi,
  sunucuHatasi,
  validasyonHatasi,
  yetkiHatasi,
} from "@/lib/utils/hataIsle";

const RPC_SAYFA_BOYUTU = 100;
const BOS_OZET: EclubSiparisOzet = {
  toplam: 0,
  islemde: 0,
  kargoda: 0,
  teslim_edildi: 0,
  iptal: 0,
  firma_kullanilan_puan: 0,
};

function trGunBaslangici(gun: string | null): string | null {
  return gun ? new Date(`${gun}T00:00:00+03:00`).toISOString() : null;
}

async function uttSiparisleriniGetir(
  supabase: SupabaseClient,
  utt: EclubKapsamUtt,
  sorgu: EclubSiparisSorgusu,
): Promise<{ utt: EclubKapsamUtt; data: EclubSiparisApiData }> {
  const rpcCagir = (offset: number) => supabase.rpc("get_eclub_utt_siparisler", {
    p_utt_id: utt.utt_id,
    p_eczane_id: sorgu.eczaneId,
    p_kisi_id: sorgu.kisiId,
    p_durum: sorgu.durum,
    p_tarih_baslangic: trGunBaslangici(sorgu.tarihBaslangic),
    p_tarih_bitis: trGunBaslangici(sorgu.tarihBitis ? trGunEkle(sorgu.tarihBitis, 1) : null),
    p_offset: offset,
    p_limit: RPC_SAYFA_BOYUTU,
  });

  const ilkSonuc = await rpcCagir(0);
  if (ilkSonuc.error) throw new Error(`get_eclub_utt_siparisler RPC (${utt.utt_adi}): ${ilkSonuc.error.message}`);
  const ilkData = (ilkSonuc.data ?? {}) as Partial<EclubSiparisApiData>;
  const toplam = Number(ilkData.toplam ?? 0);
  const siparisler = [...(ilkData.siparisler ?? [])];

  for (let offset = RPC_SAYFA_BOYUTU; offset < toplam; offset += RPC_SAYFA_BOYUTU) {
    const sayfaSonucu = await rpcCagir(offset);
    if (sayfaSonucu.error) throw new Error(`get_eclub_utt_siparisler RPC (${utt.utt_adi}, ${offset}): ${sayfaSonucu.error.message}`);
    const sayfaData = (sayfaSonucu.data ?? {}) as Partial<EclubSiparisApiData>;
    siparisler.push(...(sayfaData.siparisler ?? []));
  }

  return {
    utt,
    data: {
      siparisler,
      toplam,
      ozet: { ...BOS_OZET, ...(ilkData.ozet ?? {}) },
      kapsam: {
        eczaneler: ilkData.kapsam?.eczaneler ?? [],
        kisiler: ilkData.kapsam?.kisiler ?? [],
      },
    },
  };
}

function siparisOzetiniHesapla(siparisler: EclubEkipSiparisSatiri[]): EclubSiparisOzet {
  return siparisler.reduce<EclubSiparisOzet>((ozet, siparis) => {
    ozet.toplam += 1;
    if (siparis.durum === "beklemede" || siparis.durum === "hazirlaniyor") ozet.islemde += 1;
    if (siparis.durum === "kargoda") ozet.kargoda += 1;
    if (siparis.durum === "teslim_edildi") ozet.teslim_edildi += 1;
    if (siparis.durum === "iptal") ozet.iptal += 1;
    if (siparis.durum !== "iptal") ozet.firma_kullanilan_puan += Number(siparis.firma_kullanilan_puan ?? 0);
    return ozet;
  }, { ...BOS_OZET });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad, rol, firma_id, takim_id, bolge_id")
      .eq("kullanici_id", user.id)
      .single();

    if (kullaniciError || !kullanici) {
      return hataYaniti("Kullanıcı bulunamadı.", "kullanicilar SELECT — E-Club sipariş", kullaniciError, 404);
    }

    const rol = (kullanici.rol ?? "").toLowerCase();
    if (!ECLUB_YONETIM_ROLLERI.includes(rol)) {
      return rolHatasi("E-Club siparişlerine erişim yetkiniz yok.");
    }
    if (!kullanici.firma_id) return rolHatasi("E-Club siparişleri için firma bağlantısı bulunamadı.");

    const { data: firma, error: firmaError } = await adminSupabase
      .from("firmalar")
      .select("eclub_store_aktif")
      .eq("firma_id", kullanici.firma_id)
      .single();

    if (firmaError || !firma) {
      return hataYaniti("Firma mağaza ayarı doğrulanamadı.", "firmalar SELECT — E-Club Store", firmaError);
    }
    if (firma.eclub_store_aktif === false) return rolHatasi("E-Club Store firmanız için kapalıdır.");

    const sonuc = eclubSiparisSorgusunuParse(request.nextUrl.searchParams);
    if (!sonuc.ok) return validasyonHatasi(sonuc.hata, sonuc.alanlar);

    const sorgu = sonuc.sorgu;
    const kapsam = await eclubYonetimKapsaminiGetir(adminSupabase, kullanici);
    if (sorgu.uttId && !kapsam.uttler.some((utt) => utt.utt_id === sorgu.uttId)) {
      return rolHatasi("Seçilen UTT E-Club kapsamınızda değil.");
    }

    const sonuclar = await Promise.all(kapsam.uttler.map((utt) => uttSiparisleriniGetir(adminSupabase, utt, sorgu)));
    const hedefSonuclar = sorgu.uttId
      ? sonuclar.filter(({ utt }) => utt.utt_id === sorgu.uttId)
      : sonuclar;

    const siparisHaritasi = new Map<string, EclubEkipSiparisSatiri>();
    for (const { utt, data } of hedefSonuclar) {
      for (const siparis of data.siparisler) {
        if (siparisHaritasi.has(siparis.siparis_id)) continue;
        siparisHaritasi.set(siparis.siparis_id, {
          ...siparis,
          utt_id: utt.utt_id,
          utt_adi: utt.utt_adi,
          bm_adi: utt.bm_adi,
          takim_adi: utt.takim_adi,
          bolge_adi: utt.bolge_adi,
        });
      }
    }
    const tumSiparisler = [...siparisHaritasi.values()].sort((a, b) => (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        || a.siparis_id.localeCompare(b.siparis_id)
    ));

    const eczaneHaritasi = new Map(hedefSonuclar.flatMap(({ data }) => data.kapsam.eczaneler).map((eczane) => [eczane.eczane_id, eczane]));
    const kisiHaritasi = new Map(hedefSonuclar.flatMap(({ data }) => data.kapsam.kisiler).map((kisi) => [kisi.kisi_id, kisi]));
    const sayfaliSiparisler = tumSiparisler.slice(sorgu.offset, sorgu.offset + sorgu.limit);

    return NextResponse.json({
      siparisler: sayfaliSiparisler,
      toplam: tumSiparisler.length,
      ozet: siparisOzetiniHesapla(tumSiparisler),
      kapsam: {
        eczaneler: [...eczaneHaritasi.values()].sort((a, b) => a.eczane_adi.localeCompare(b.eczane_adi, "tr")),
        kisiler: [...kisiHaritasi.values()].sort((a, b) => `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, "tr")),
      },
      kapsam_hiyerarsi: kapsam,
      utt_ozetleri: sonuclar.map(({ utt, data }) => ({ utt_id: utt.utt_id, ozet: data.ozet })),
    }, { status: 200 });
  } catch (error) {
    return sunucuHatasi(error, "GET /eclub/siparisler/api");
  }
}
