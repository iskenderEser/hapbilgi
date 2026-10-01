import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CekTakipFiltreleri,
  CekTakipIslemi,
  CekTakipSayfalama,
  CekTakipTalebi,
  CekTakipTeslimatKanali,
  CekTakipTeslimatDurumu,
} from "@/lib/eclub/hediyeTakip/cekTakip";
import {
  cekTakipTalepKapsami,
  type CekTakipKapsami,
} from "@/lib/eclub/hediyeTakip/cekTakipErisim";
import type { CekTalepDurumu, SatisSartiTipi } from "@/lib/eclub/store/eclubStoreTipler";
import { ECLUB_TUKETICI_ROLLERI, type EclubKisiRol } from "@/lib/utils/roller";
import { trGunEkle } from "@/lib/zaman/kontrol";

interface HamTalep {
  talep_id: string;
  eczane_id: string;
  yayin_id: string;
  talep_eden_kisi_id: string;
  toplanan_puan: number | string | null;
  talep_edilen_cek_tl: number | string | null;
  siparis_tipi: SatisSartiTipi;
  siparis_verildi_mi: boolean;
  siparis_adet: number | null;
  siparis_mal_fazlasi: number | null;
  durum: CekTalepDurumu;
  utt_id: string | null;
  bm_id: string | null;
  bm_onay_tarihi: string | null;
  tm_id: string | null;
  tm_onay_tarihi: string | null;
  cek_kodu: string | null;
  cek_gonderim_tarihi: string | null;
  devreden_puan: number | null;
  created_at: string;
  guncellenme_at: string;
  eclub_eczaneler: { gln: string | null } | Array<{ gln: string | null }> | null;
  eclub_kisiler: { ad: string | null; soyad: string | null; rol: string } | Array<{ ad: string | null; soyad: string | null; rol: string }> | null;
  v_yayin_kunye: { urun_id: string | null } | Array<{ urun_id: string | null }> | null;
}

interface HamTeslimat {
  talep_id: string;
  kanal: "eposta" | "push";
  durum: "bekliyor" | "isleniyor" | "tamamlandi" | "basarisiz";
}

function tekilIliski<T>(deger: T | T[] | null): T | null {
  return Array.isArray(deger) ? deger[0] ?? null : deger;
}

function kisiRolu(rol: string | null | undefined): EclubKisiRol {
  const normalize = (rol ?? "").trim().toLowerCase();
  return ECLUB_TUKETICI_ROLLERI.includes(normalize as EclubKisiRol)
    ? normalize as EclubKisiRol
    : "eczaci";
}

function trGunBaslangici(gun: string): string {
  return new Date(`${gun}T00:00:00+03:00`).toISOString();
}

export function cekTakipTeslimatKanaliniOzetle(
  durumlar: readonly HamTeslimat["durum"][],
): CekTakipTeslimatKanali {
  const sayilar = {
    bekliyor: durumlar.filter((durum) => durum === "bekliyor").length,
    isleniyor: durumlar.filter((durum) => durum === "isleniyor").length,
    tamamlanan: durumlar.filter((durum) => durum === "tamamlandi").length,
    basarisiz: durumlar.filter((durum) => durum === "basarisiz").length,
  };
  let durum: CekTakipTeslimatDurumu = "yok";
  if (durumlar.length > 0) {
    if (sayilar.tamamlanan === durumlar.length) durum = "tamamlandi";
    else if (sayilar.basarisiz === durumlar.length) durum = "basarisiz";
    else if (sayilar.tamamlanan > 0) durum = "kismen_tamamlandi";
    else if (sayilar.isleniyor > 0) durum = "isleniyor";
    else if (sayilar.bekliyor > 0) durum = "bekliyor";
    else durum = "basarisiz";
  }
  return { durum, toplam: durumlar.length, ...sayilar };
}

export function cekTakipIzinVerilenIslemler(
  kapsam: CekTakipKapsami,
  talep: Pick<HamTalep, "durum" | "utt_id">,
): CekTakipIslemi[] {
  if (talep.durum === "beklemede" && talep.utt_id === kapsam.utt_id) {
    return ["bm_onayina_gonder"];
  }
  return [];
}

export async function cekTakipTalepleriniGetir(
  adminSupabase: SupabaseClient,
  kapsam: CekTakipKapsami,
  filtreler: CekTakipFiltreleri,
): Promise<{ talepler: CekTakipTalebi[]; sayfalama: CekTakipSayfalama }> {
  let sorgu = adminSupabase
    .from("eclub_store_cek_talepleri")
    .select(`
      talep_id, eczane_id, yayin_id, talep_eden_kisi_id,
      toplanan_puan, talep_edilen_cek_tl, siparis_tipi,
      siparis_verildi_mi, siparis_adet, siparis_mal_fazlasi,
      durum, utt_id, bm_id, bm_onay_tarihi, tm_id, tm_onay_tarihi,
      cek_kodu, cek_gonderim_tarihi, devreden_puan, created_at, guncellenme_at,
      eclub_eczaneler ( gln ),
      eclub_kisiler ( ad, soyad, rol ),
      v_yayin_kunye ( urun_id )
    `)
    .match(cekTakipTalepKapsami(kapsam));

  if (filtreler.eczane_id) sorgu = sorgu.eq("eczane_id", filtreler.eczane_id);
  if (filtreler.kisi_id) sorgu = sorgu.eq("talep_eden_kisi_id", filtreler.kisi_id);
  if (filtreler.durum) sorgu = sorgu.eq("durum", filtreler.durum);
  if (filtreler.baslangic) sorgu = sorgu.gte("created_at", trGunBaslangici(filtreler.baslangic));
  if (filtreler.bitis) sorgu = sorgu.lt("created_at", trGunBaslangici(trGunEkle(filtreler.bitis, 1)));

  const { data, error } = await sorgu.order("created_at", { ascending: false }).order("talep_id", { ascending: true });
  if (error) throw new Error(`Çek Takip talepleri alınamadı: ${error.message}`);

  const tumTalepler = ((data ?? []) as unknown as HamTalep[]).filter((talep) => {
    if (!filtreler.urun_id) return true;
    return tekilIliski(talep.v_yayin_kunye)?.urun_id === filtreler.urun_id;
  });
  const toplam = tumTalepler.length;
  const sayfaliHamTalepler = tumTalepler.slice(filtreler.offset, filtreler.offset + filtreler.limit);
  const talepIdler = sayfaliHamTalepler.map((talep) => talep.talep_id);
  const urunIdler = [...new Set(sayfaliHamTalepler.flatMap((talep) => {
    const urunId = tekilIliski(talep.v_yayin_kunye)?.urun_id;
    return urunId ? [urunId] : [];
  }))];
  const glnler = [...new Set(sayfaliHamTalepler.flatMap((talep) => {
    const gln = tekilIliski(talep.eclub_eczaneler)?.gln;
    return gln ? [gln] : [];
  }))];
  const kullaniciIdler = [...new Set(sayfaliHamTalepler.flatMap((talep) => (
    [talep.utt_id, talep.bm_id, talep.tm_id].filter((id): id is string => Boolean(id))
  )))];

  const [urunSonucu, eczaneSonucu, kullaniciSonucu, teslimatSonucu] = await Promise.all([
    urunIdler.length > 0
      ? adminSupabase.from("urunler").select("urun_id, urun_adi").in("urun_id", urunIdler)
      : Promise.resolve({ data: [], error: null }),
    glnler.length > 0
      ? adminSupabase.from("eclub_eczane_master").select("gln, eczane_adi").in("gln", glnler)
      : Promise.resolve({ data: [], error: null }),
    kullaniciIdler.length > 0
      ? adminSupabase.from("kullanicilar").select("kullanici_id, ad, soyad").in("kullanici_id", kullaniciIdler)
      : Promise.resolve({ data: [], error: null }),
    talepIdler.length > 0
      ? adminSupabase.from("eclub_cek_teslimat_outbox").select("talep_id, kanal, durum").in("talep_id", talepIdler)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (urunSonucu.error) throw new Error(`Çek Takip ürünleri alınamadı: ${urunSonucu.error.message}`);
  if (eczaneSonucu.error) throw new Error(`Çek Takip eczaneleri alınamadı: ${eczaneSonucu.error.message}`);
  if (kullaniciSonucu.error) throw new Error(`Çek Takip onay kullanıcıları alınamadı: ${kullaniciSonucu.error.message}`);
  if (teslimatSonucu.error) throw new Error(`Çek Takip teslimatları alınamadı: ${teslimatSonucu.error.message}`);

  const urunAdlari = new Map((urunSonucu.data ?? []).map((urun) => [urun.urun_id, urun.urun_adi]));
  const eczaneAdlari = new Map((eczaneSonucu.data ?? []).map((eczane) => [eczane.gln, eczane.eczane_adi]));
  const kullaniciAdlari = new Map((kullaniciSonucu.data ?? []).map((kullanici) => [
    kullanici.kullanici_id,
    `${kullanici.ad ?? ""} ${kullanici.soyad ?? ""}`.trim() || "—",
  ]));
  const teslimatlar = (teslimatSonucu.data ?? []) as HamTeslimat[];
  const kanalDurumlari = (talepId: string, kanal: HamTeslimat["kanal"]) => teslimatlar
    .filter((teslimat) => teslimat.talep_id === talepId && teslimat.kanal === kanal)
    .map((teslimat) => teslimat.durum);

  const talepler = sayfaliHamTalepler.map<CekTakipTalebi>((talep) => {
    const eczane = tekilIliski(talep.eclub_eczaneler);
    const kisi = tekilIliski(talep.eclub_kisiler);
    const kunye = tekilIliski(talep.v_yayin_kunye);
    return {
      talep_id: talep.talep_id,
      created_at: talep.created_at,
      guncellenme_at: talep.guncellenme_at,
      durum: talep.durum,
      eczane: {
        eczane_id: talep.eczane_id,
        eczane_adi: (eczane?.gln ? eczaneAdlari.get(eczane.gln) : null) ?? "Eczane",
        gln: eczane?.gln ?? null,
      },
      uye: {
        kisi_id: talep.talep_eden_kisi_id,
        ad_soyad: `${kisi?.ad ?? ""} ${kisi?.soyad ?? ""}`.trim() || "Üye",
        rol: kisiRolu(kisi?.rol),
      },
      urun: {
        yayin_id: talep.yayin_id,
        urun_id: kunye?.urun_id ?? talep.yayin_id,
        urun_adi: (kunye?.urun_id ? urunAdlari.get(kunye.urun_id) : null) ?? "Ürün",
      },
      odul_kosulu: {
        siparis_tipi: talep.siparis_tipi,
        siparis_verildi_mi: talep.siparis_verildi_mi,
        siparis_adet: talep.siparis_adet ?? 0,
        siparis_mal_fazlasi: talep.siparis_mal_fazlasi ?? 0,
      },
      puan: {
        kullanilan: Number(talep.toplanan_puan ?? 0),
        devreden: Number(talep.devreden_puan ?? 0),
      },
      cek: {
        tutar_tl: Number(talep.talep_edilen_cek_tl ?? 0),
        kod: talep.cek_kodu,
        gonderim_tarihi: talep.cek_gonderim_tarihi,
      },
      onay: {
        utt: { kullanici_id: talep.utt_id, ad_soyad: talep.utt_id ? kullaniciAdlari.get(talep.utt_id) ?? null : null, tarih: null },
        bm: { kullanici_id: talep.bm_id, ad_soyad: talep.bm_id ? kullaniciAdlari.get(talep.bm_id) ?? null : null, tarih: talep.bm_onay_tarihi },
        tm: { kullanici_id: talep.tm_id, ad_soyad: talep.tm_id ? kullaniciAdlari.get(talep.tm_id) ?? null : null, tarih: talep.tm_onay_tarihi },
      },
      teslimat: {
        eposta: cekTakipTeslimatKanaliniOzetle(kanalDurumlari(talep.talep_id, "eposta")),
        push: cekTakipTeslimatKanaliniOzetle(kanalDurumlari(talep.talep_id, "push")),
      },
      izin_verilen_islemler: cekTakipIzinVerilenIslemler(kapsam, talep),
    };
  });

  return {
    talepler,
    sayfalama: {
      toplam,
      offset: filtreler.offset,
      limit: filtreler.limit,
      sonraki_kayit_var_mi: filtreler.offset + talepler.length < toplam,
    },
  };
}
