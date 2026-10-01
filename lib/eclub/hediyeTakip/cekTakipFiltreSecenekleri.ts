import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CekTakipFiltreSecenekleri,
  CekTakipUyeSecenegi,
} from "@/lib/eclub/hediyeTakip/cekTakip";
import {
  cekTakipTalepKapsami,
  type CekTakipKapsami,
} from "@/lib/eclub/hediyeTakip/cekTakipErisim";
import { ECLUB_TUKETICI_ROLLERI, type EclubKisiRol } from "@/lib/utils/roller";

interface HamTalep {
  eczane_id: string;
  talep_eden_kisi_id: string;
  eclub_eczaneler: { gln: string | null } | Array<{ gln: string | null }> | null;
  eclub_kisiler: { ad: string | null; soyad: string | null; rol: string } | Array<{ ad: string | null; soyad: string | null; rol: string }> | null;
  v_yayin_kunye: { urun_id: string | null } | Array<{ urun_id: string | null }> | null;
}

function tekilIliski<T>(deger: T | T[] | null): T | null {
  return Array.isArray(deger) ? deger[0] ?? null : deger;
}

function kisiRoluMu(rol: string): rol is EclubKisiRol {
  return ECLUB_TUKETICI_ROLLERI.includes(rol);
}

export async function cekTakipFiltreSecenekleriniGetir(
  adminSupabase: SupabaseClient,
  kapsam: CekTakipKapsami,
): Promise<CekTakipFiltreSecenekleri> {
  const { data, error } = await adminSupabase
    .from("eclub_store_cek_talepleri")
    .select(`
      eczane_id,
      talep_eden_kisi_id,
      eclub_eczaneler ( gln ),
      eclub_kisiler ( ad, soyad, rol ),
      v_yayin_kunye ( urun_id )
    `)
    .match(cekTakipTalepKapsami(kapsam));

  if (error) throw new Error(`Çek Takip filtre seçenekleri alınamadı: ${error.message}`);
  const talepler = (data ?? []) as unknown as HamTalep[];

  const glnler = [...new Set(talepler.flatMap((talep) => {
    const gln = tekilIliski(talep.eclub_eczaneler)?.gln;
    return gln ? [gln] : [];
  }))];
  const urunIdler = [...new Set(talepler.flatMap((talep) => {
    const urunId = tekilIliski(talep.v_yayin_kunye)?.urun_id;
    return urunId ? [urunId] : [];
  }))];

  const [masterSonucu, urunSonucu] = await Promise.all([
    glnler.length > 0
      ? adminSupabase.from("eclub_eczane_master").select("gln, eczane_adi").in("gln", glnler)
      : Promise.resolve({ data: [], error: null }),
    urunIdler.length > 0
      ? adminSupabase.from("urunler").select("urun_id, urun_adi").in("urun_id", urunIdler)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (masterSonucu.error) throw new Error(`Çek Takip eczane seçenekleri alınamadı: ${masterSonucu.error.message}`);
  if (urunSonucu.error) throw new Error(`Çek Takip ürün seçenekleri alınamadı: ${urunSonucu.error.message}`);

  const eczaneAdlari = new Map((masterSonucu.data ?? []).map((eczane) => [eczane.gln, eczane.eczane_adi]));
  const urunAdlari = new Map((urunSonucu.data ?? []).map((urun) => [urun.urun_id, urun.urun_adi]));
  const eczaneler = new Map<string, CekTakipFiltreSecenekleri["eczaneler"][number]>();
  const uyeler = new Map<string, CekTakipUyeSecenegi>();

  for (const talep of talepler) {
    const eczane = tekilIliski(talep.eclub_eczaneler);
    const kisi = tekilIliski(talep.eclub_kisiler);
    eczaneler.set(talep.eczane_id, {
      eczane_id: talep.eczane_id,
      eczane_adi: (eczane?.gln ? eczaneAdlari.get(eczane.gln) : null) ?? "Eczane",
      gln: eczane?.gln ?? null,
    });
    if (kisi && kisiRoluMu(kisi.rol)) {
      uyeler.set(talep.talep_eden_kisi_id, {
        kisi_id: talep.talep_eden_kisi_id,
        eczane_id: talep.eczane_id,
        ad_soyad: `${kisi.ad ?? ""} ${kisi.soyad ?? ""}`.trim() || "Üye",
        rol: kisi.rol,
      });
    }
  }

  return {
    eczaneler: [...eczaneler.values()].sort((a, b) => a.eczane_adi.localeCompare(b.eczane_adi, "tr")),
    uyeler: [...uyeler.values()].sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, "tr")),
    urunler: urunIdler.map((urun_id) => ({
      urun_id,
      urun_adi: urunAdlari.get(urun_id) ?? "Ürün",
    })).sort((a, b) => a.urun_adi.localeCompare(b.urun_adi, "tr")),
  };
}
