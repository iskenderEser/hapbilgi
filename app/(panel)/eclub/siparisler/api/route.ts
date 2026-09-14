import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  eclubSiparisSorgusunuParse,
  type EclubEkipSiparisSatiri,
  type EclubSiparisApiData,
  type EclubSiparisDurum,
  type EclubSiparisOzet,
  type EclubSiparisSorgusu,
} from "@/lib/eclub/store/ekipSiparis";
import { eclubYonetimKapsaminiGetir, type EclubKapsamUtt, type EclubYonetimKapsami } from "@/lib/eclub/yonetimKapsami";
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

async function cekTalepleriniGetir(
  supabase: SupabaseClient,
  firmaId: string,
  kapsam: EclubYonetimKapsami,
  sorgu: EclubSiparisSorgusu,
): Promise<EclubEkipSiparisSatiri[]> {
  const uttIdler = kapsam.uttler.map((u) => u.utt_id);

  let q = supabase
    .from("eclub_store_cek_talepleri")
    .select(`
      talep_id,
      eczane_id,
      firma_id,
      yayin_id,
      talep_eden_kisi_id,
      toplanan_puan,
      talep_edilen_cek_tl,
      siparis_tipi,
      siparis_verildi_mi,
      siparis_adet,
      siparis_mal_fazlasi,
      durum,
      utt_id,
      bm_id,
      bm_onay_tarihi,
      cek_kodu,
      cek_gonderim_tarihi,
      devreden_puan,
      created_at,
      guncellenme_at,
      eclub_eczaneler ( gln ),
      eclub_kisiler ( ad, soyad, rol ),
      v_yayin_kunye ( urun_id )
    `)
    .eq("firma_id", firmaId);

  if (sorgu.durum) q = q.eq("durum", sorgu.durum);
  if (sorgu.eczaneId) q = q.eq("eczane_id", sorgu.eczaneId);

  if (sorgu.kisiId) q = q.eq("talep_eden_kisi_id", sorgu.kisiId);
  if (sorgu.uttId) q = q.eq("utt_id", sorgu.uttId);
  else if (uttIdler.length > 0) q = q.in("utt_id", uttIdler);

  if (sorgu.tarihBaslangic) q = q.gte("created_at", trGunBaslangici(sorgu.tarihBaslangic)!);
  if (sorgu.tarihBitis) q = q.lte("created_at", trGunBaslangici(trGunEkle(sorgu.tarihBitis, 1))!);

  const { data: talepler, error } = await q.order("created_at", { ascending: false });
  if (error) {
    throw new Error(`eclub_store_cek_talepleri SELECT: ${error.message}`);
  }

  const uttMap = new Map(kapsam.uttler.map((u) => [u.utt_id, u]));
  const urunIdler = [...new Set((talepler ?? []).map((t: any) => {
    const kunye = Array.isArray(t.v_yayin_kunye) ? t.v_yayin_kunye[0] : t.v_yayin_kunye;
    return kunye?.urun_id as string | undefined;
  }).filter((urunId): urunId is string => Boolean(urunId)))];
  const urunAdlari = new Map<string, string>();
  if (urunIdler.length > 0) {
    const { data: urunler, error: urunError } = await supabase.from("urunler").select("urun_id, urun_adi").in("urun_id", urunIdler);
    if (urunError) throw new Error(`urunler SELECT: ${urunError.message}`);
    for (const urun of urunler ?? []) urunAdlari.set(urun.urun_id, urun.urun_adi);
  }
  const glnler = [...new Set((talepler ?? []).map((t: any) => {
    const eczane = Array.isArray(t.eclub_eczaneler) ? t.eclub_eczaneler[0] : t.eclub_eczaneler;
    return eczane?.gln as string | undefined;
  }).filter((gln): gln is string => Boolean(gln)))];
  const eczaneAdlari = new Map<string, string>();
  if (glnler.length > 0) {
    const { data: masterlar, error: masterError } = await supabase.from("eclub_eczane_master").select("gln, eczane_adi").in("gln", glnler);
    if (masterError) throw new Error(`eclub_eczane_master SELECT: ${masterError.message}`);
    for (const master of masterlar ?? []) eczaneAdlari.set(master.gln, master.eczane_adi);
  }

  return (talepler ?? []).map((t: any) => {
    const eczane = Array.isArray(t.eclub_eczaneler) ? t.eclub_eczaneler[0] : t.eclub_eczaneler;
    const kisi = Array.isArray(t.eclub_kisiler) ? t.eclub_kisiler[0] : t.eclub_kisiler;
    const kunye = Array.isArray(t.v_yayin_kunye) ? t.v_yayin_kunye[0] : t.v_yayin_kunye;
    const utt = t.utt_id ? uttMap.get(t.utt_id) : undefined;

    return {
      siparis_id: t.talep_id,
      talep_id: t.talep_id,
      kisi_id: t.talep_eden_kisi_id,
      eczane_id: t.eczane_id,
      gln: eczane?.gln ?? null,
      eczane_adi: (eczane?.gln ? eczaneAdlari.get(eczane.gln) : null) ?? "Eczane",
      kisi_ad: kisi?.ad ?? "-",
      kisi_soyad: kisi?.soyad ?? "-",
      kisi_rol: kisi?.rol ?? "eczaci",
      urun_id: kunye?.urun_id ?? t.yayin_id,
      urun_adi: (kunye?.urun_id ? urunAdlari.get(kunye.urun_id) : null) ?? "Migros Hediye Çeki",
      urun_gorsel_url: null,
      adres_snapshot: null,
      adet: t.siparis_adet ?? 1,
      puan_birim_fiyat: t.toplanan_puan,
      siparis_toplam_puan: t.toplanan_puan,
      firma_kullanilan_puan: t.toplanan_puan,
      talep_edilen_cek_tl: Number(t.talep_edilen_cek_tl ?? 0),
      siparis_tipi: t.siparis_tipi,
      siparis_verildi_mi: t.siparis_verildi_mi,
      siparis_adet: t.siparis_adet,
      siparis_mal_fazlasi: t.siparis_mal_fazlasi,
      cek_kodu: t.cek_kodu,
      durum: t.durum as EclubSiparisDurum,
      kargo_firmasi: t.cek_kodu ? "Migros Dijital Kod" : null,
      kargo_takip_no: t.cek_kodu ?? null,
      iptal_sebebi: null,
      created_at: t.created_at,
      guncellenme_at: t.guncellenme_at,
      teslim_alma_at: t.cek_gonderim_tarihi,
      utt_id: utt?.utt_id ?? t.utt_id,
      utt_adi: utt?.utt_adi ?? "—",
      bm_adi: utt?.bm_adi ?? "—",
      takim_adi: utt?.takim_adi ?? "—",
      bolge_adi: utt?.bolge_adi ?? "—",
    };
  });
}

function siparisOzetiniHesapla(siparisler: EclubEkipSiparisSatiri[]): EclubSiparisOzet {
  return siparisler.reduce<EclubSiparisOzet>((ozet, siparis) => {
    ozet.toplam += 1;
    if (siparis.durum === "beklemede" || siparis.durum === "hazirlaniyor" || siparis.durum === "bm_onayinda") {
      ozet.islemde += 1;
    }
    if (siparis.durum === "kargoda") ozet.kargoda += 1;
    if (siparis.durum === "teslim_edildi" || siparis.durum === "cek_kodlari_gonderildi") {
      ozet.teslim_edildi += 1;
    }
    if (siparis.durum === "iptal") ozet.iptal += 1;
    if (siparis.durum !== "iptal") {
      ozet.firma_kullanilan_puan += Number(siparis.firma_kullanilan_puan ?? 0);
    }
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

    // 1. Klasik fiziksel siparişler
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

    // 2. Yeni dönem Migros Hediye Çeki talepleri
    const cekTalepleri = await cekTalepleriniGetir(adminSupabase, kullanici.firma_id, kapsam, sorgu);
    for (const talep of cekTalepleri) {
      siparisHaritasi.set(talep.siparis_id, talep);
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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad, rol, firma_id, bolge_id")
      .eq("kullanici_id", user.id)
      .single();

    if (kullaniciError || !kullanici) {
      return hataYaniti("Kullanıcı bulunamadı.", "kullanicilar SELECT", kullaniciError, 404);
    }

    const rol = (kullanici.rol ?? "").toLowerCase();
    const body = await request.json();
    const { action, talep_idler } = body;

    if (!talep_idler || !Array.isArray(talep_idler) || talep_idler.length === 0) {
      return validasyonHatasi("En az bir talep seçilmelidir.", ["talep_idler"]);
    }
    if (!talep_idler.every((id) => typeof id === "string")) return validasyonHatasi("Talep kimlikleri geçersizdir.", ["talep_idler"]);

    const { data: seciliTalepler, error: seciliTalepError } = await adminSupabase
      .from("eclub_store_cek_talepleri")
      .select("talep_id, firma_id, utt_id, bm_id, durum")
      .in("talep_id", talep_idler);
    if (seciliTalepError) return hataYaniti("Seçili talepler doğrulanamadı.", "eclub_store_cek_talepleri SELECT — kapsam", seciliTalepError);
    if ((seciliTalepler ?? []).length !== new Set(talep_idler).size || (seciliTalepler ?? []).some((t) => t.firma_id !== kullanici.firma_id)) {
      return rolHatasi("Seçilen talepler firma kapsamınızda değil.");
    }

    if (action === "bm_onayina_gonder") {
      if (!["utt", "kd_utt"].includes(rol)) {
        return rolHatasi("Bu işlem yalnız UTT rolüne açıktır.");
      }
      if ((seciliTalepler ?? []).some((t) => t.utt_id !== kullanici.kullanici_id || t.durum !== "beklemede")) {
        return rolHatasi("Seçilen talepler UTT kapsamınızda veya beklemede değil.");
      }

      const { data: rpcRes, error: rpcErr } = await adminSupabase.rpc("eclub_store_bm_onayina_gonder", {
        p_utt_id: kullanici.kullanici_id,
        p_talep_idler: talep_idler,
      });

      if (rpcErr) return hataYaniti("Talepler BM onayına gönderilemedi.", "eclub_store_bm_onayina_gonder RPC", rpcErr);
      const guncellenen = Array.isArray(rpcRes) ? (rpcRes[0]?.guncellenen_adet ?? 0) : Number(rpcRes ?? 0);
      return NextResponse.json({
        ok: true,
        mesaj: `${guncellenen} adet talep Bölge Müdürüne (BM) iletildi.`,
        guncellenen_adet: guncellenen,
      }, { status: 200 });
    }

    if (action === "bm_onayla") {
      if (rol !== "bm") {
        return rolHatasi("Bu işlem yalnız Bölge Müdürü (BM) rolüne açıktır.");
      }
      if ((seciliTalepler ?? []).some((t) => t.bm_id !== kullanici.kullanici_id || t.durum !== "bm_onayinda")) {
        return rolHatasi("Seçilen talepler BM kapsamınızda veya onay aşamasında değil.");
      }

      const { data: rpcRes, error: rpcErr } = await adminSupabase.rpc("eclub_store_bm_onayla", {
        p_bm_id: kullanici.kullanici_id,
        p_talep_idler: talep_idler,
      });

      if (rpcErr) return hataYaniti("Talepler onaylanamadı.", "eclub_store_bm_onayla RPC", rpcErr);
      const guncellenen = Array.isArray(rpcRes) ? (rpcRes[0]?.guncellenen_adet ?? 0) : Number(rpcRes ?? 0);
      return NextResponse.json({
        ok: true,
        mesaj: `${guncellenen} adet talep onaylandı, Admin kod teslimatına sevk edildi.`,
        guncellenen_adet: guncellenen,
      }, { status: 200 });
    }

    return validasyonHatasi(`Geçersiz işlem: ${action}`, ["action"]);
  } catch (error) {
    return sunucuHatasi(error, "POST /eclub/siparisler/api");
  }
}
