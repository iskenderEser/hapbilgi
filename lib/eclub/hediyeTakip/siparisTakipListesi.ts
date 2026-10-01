import type { SupabaseClient } from "@supabase/supabase-js";
import { konumEtiketi, type DepoKonumu } from "@/lib/eclub/depo";
import { cekTakipTalepKapsami, type CekTakipKapsami } from "./cekTakipErisim";
import { siparisTakipDurumunuCoz, siparisTakipStatlariniHesapla, type SiparisTakipFiltreleri, type SiparisTakipTalebi, type SiparisTakipApiYaniti } from "./siparisTakip";

export async function siparisTakipVerisiniGetir(admin: SupabaseClient, kapsam: CekTakipKapsami, filtreler: SiparisTakipFiltreleri): Promise<SiparisTakipApiYaniti> {
  let query = admin.from("eclub_store_cek_talepleri").select("talep_id, eczane_id, yayin_id, talep_eden_kisi_id, utt_id, siparis_adet, siparis_mal_fazlasi, siparis_verildi_mi, durum, created_at").match(cekTakipTalepKapsami(kapsam)).eq("siparis_verildi_mi", true);
  if (filtreler.eczane_id) query = query.eq("eczane_id", filtreler.eczane_id);
  if (filtreler.baslangic) query = query.gte("created_at", `${filtreler.baslangic}T00:00:00+03:00`);
  if (filtreler.bitis) query = query.lt("created_at", `${filtreler.bitis}T23:59:59.999+03:00`);
  const { data, error } = await query.order("created_at", { ascending: false }).order("talep_id", { ascending: true });
  if (error) throw new Error(`Sipariş Takip talepleri alınamadı: ${error.message}`);
  const ham = (data ?? []) as Array<Record<string, unknown>>;
  const urunIds = [...new Set(ham.map((row) => row.yayin_id as string))];
  const eczaneIds = [...new Set(ham.map((row) => row.eczane_id as string))];
  const kisiIds = [...new Set(ham.map((row) => row.talep_eden_kisi_id as string))];
  const [eczaneler, kisiler, yayinlar, tercihler, katalog] = await Promise.all([
    admin.from("eclub_eczaneler").select("eczane_id, gln").in("eczane_id", eczaneIds),
    admin.from("eclub_kisiler").select("kisi_id, ad, soyad, rol").in("kisi_id", kisiIds),
    admin.from("v_yayin_kunye").select("yayin_id, urun_id").in("yayin_id", urunIds),
    admin.from("eclub_eczane_depo_tercihleri").select("eczane_id, depo_sube_id").in("eczane_id", eczaneIds),
    admin.from("ecza_depo_subeleri").select("depo_sube_id, depo_id, depo_adi, sube_adi, il, ilce, adres, aktif_mi").eq("aktif_mi", true),
  ]);
  for (const result of [eczaneler, kisiler, yayinlar, tercihler, katalog]) if (result.error) throw new Error(result.error.message);
  const glns = (eczaneler.data ?? []).map((row) => row.gln).filter(Boolean);
  const urunIdsGercek = (yayinlar.data ?? []).map((row) => row.urun_id).filter(Boolean);
  const [master, urunler] = await Promise.all([
    admin.from("eclub_eczane_master").select("gln, eczane_adi").in("gln", glns),
    admin.from("urunler").select("urun_id, urun_adi").in("urun_id", urunIdsGercek),
  ]);
  if (master.error || urunler.error) throw new Error(master.error?.message ?? urunler.error?.message);
  const katalogRows = (katalog.data ?? []) as DepoKonumu[];
  const rows: SiparisTakipTalebi[] = ham.map((row) => {
    const eczaneId = row.eczane_id as string;
    const gln = eczaneler.data?.find((item) => item.eczane_id === eczaneId)?.gln;
    const yayin = yayinlar.data?.find((item) => item.yayin_id === row.yayin_id);
    const kisi = kisiler.data?.find((item) => item.kisi_id === row.talep_eden_kisi_id);
    const durum = siparisTakipDurumunuCoz(String(row.durum));
    const tercihIds = (tercihler.data ?? []).filter((item) => item.eczane_id === eczaneId).map((item) => item.depo_sube_id);
    const depoTercihleri = katalogRows.filter((item) => tercihIds.includes(item.depo_sube_id)).map((item) => ({ depo_sube_id: item.depo_sube_id, etiket: konumEtiketi(item) }));
    return {
      talep_id: row.talep_id as string, created_at: row.created_at as string,
      eczane: { eczane_id: eczaneId, eczane_adi: master.data?.find((item) => item.gln === gln)?.eczane_adi ?? "Eczane" },
      uye: { ad_soyad: `${kisi?.ad ?? ""} ${kisi?.soyad ?? ""}`.trim() || "Üye", rol: (kisi?.rol ?? "eczaci") as SiparisTakipTalebi["uye"]["rol"] },
      urun: { urun_id: yayin?.urun_id ?? row.yayin_id as string, urun_adi: urunler.data?.find((item) => item.urun_id === yayin?.urun_id)?.urun_adi ?? "Ürün" },
      utt_adi: row.utt_id === kapsam.utt_id ? "Siz" : "—", siparis: { adet: Number(row.siparis_adet ?? 0), mal_fazlasi: Number(row.siparis_mal_fazlasi ?? 0) }, durum, depo_tercihleri: depoTercihleri,
      izin_verilen_islemler: ["depo_tercihlerini_kontrol_et"],
    };
  }).filter((row) => (!filtreler.urun_id || row.urun.urun_id === filtreler.urun_id) && (!filtreler.durum || row.durum === filtreler.durum));
  const page = rows.slice(filtreler.offset, filtreler.offset + filtreler.limit);
  const statlar = siparisTakipStatlariniHesapla(rows.map((row) => row.durum));
  const eczaneSecenekleri = [...new Map(rows.map((row) => [row.eczane.eczane_id, { id: row.eczane.eczane_id, etiket: row.eczane.eczane_adi }])).values()];
  const urunSecenekleri = [...new Map(rows.map((row) => [row.urun.urun_id, { id: row.urun.urun_id, etiket: row.urun.urun_adi }])).values()];
  return { statlar, filtre_secenekleri: { eczaneler: eczaneSecenekleri, urunler: urunSecenekleri }, talepler: page, sayfalama: { toplam: rows.length, offset: filtreler.offset, limit: filtreler.limit, sonraki_kayit_var_mi: filtreler.offset + page.length < rows.length } };
}
