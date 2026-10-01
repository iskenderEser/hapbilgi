import type { SupabaseClient } from "@supabase/supabase-js";
import { konumEtiketi } from "@/lib/eclub/depo";
import { depoKataloguGetir } from "@/lib/eclub/depoSunucu";
import { trGunEkle } from "@/lib/zaman/kontrol";
import { cekTakipTalepKapsami, type CekTakipKapsami } from "./cekTakipErisim";
import { siparisTakipDurumu, siparisTakipStatlariniHesapla, type SiparisTakipApiYaniti, type SiparisTakipFiltreleri, type SiparisTakipTalebi } from "./siparisTakip";

interface HamSiparis {
  talep_id: string;
  created_at: string;
  donem_kodu: string;
  eczane_id: string;
  yayin_id: string;
  talep_eden_kisi_id: string;
  siparis_tipi: SiparisTakipTalebi["siparis"]["tipi"];
  siparis_adet: number;
  siparis_mal_fazlasi: number;
  toplanan_puan: number;
  talep_edilen_cek_tl: number;
  durum: string;
  eclub_eczaneler: { gln: string | null } | Array<{ gln: string | null }> | null;
  eclub_kisiler: { ad: string | null; soyad: string | null; rol: string } | Array<{ ad: string | null; soyad: string | null; rol: string }> | null;
  v_yayin_kunye: { urun_id: string | null } | Array<{ urun_id: string | null }> | null;
}

function tekil<T>(deger: T | T[] | null): T | null {
  return Array.isArray(deger) ? deger[0] ?? null : deger;
}

function trGunBaslangici(gun: string): string {
  return new Date(`${gun}T00:00:00+03:00`).toISOString();
}

export async function siparisTakipVerisiniGetir(
  admin: SupabaseClient,
  kapsam: CekTakipKapsami,
  filtreler: SiparisTakipFiltreleri,
): Promise<SiparisTakipApiYaniti> {
  const ham: HamSiparis[] = [];
  for (let baslangic = 0; ; baslangic += 500) {
    let sorgu = admin.from("eclub_store_cek_talepleri")
      .select(`talep_id, created_at, donem_kodu, eczane_id, yayin_id, talep_eden_kisi_id,
        siparis_tipi, siparis_adet, siparis_mal_fazlasi, toplanan_puan, talep_edilen_cek_tl, durum,
        eclub_eczaneler ( gln ), eclub_kisiler ( ad, soyad, rol ), v_yayin_kunye ( urun_id )`)
      .match(cekTakipTalepKapsami(kapsam))
      .eq("siparis_verildi_mi", true)
      .neq("siparis_tipi", "siparissiz_cek");
    if (filtreler.eczane_id) sorgu = sorgu.eq("eczane_id", filtreler.eczane_id);
    if (filtreler.baslangic) sorgu = sorgu.gte("created_at", trGunBaslangici(filtreler.baslangic));
    if (filtreler.bitis) sorgu = sorgu.lt("created_at", trGunBaslangici(trGunEkle(filtreler.bitis, 1)));
    const { data, error } = await sorgu.order("created_at", { ascending: false }).order("talep_id", { ascending: true }).range(baslangic, baslangic + 499);
    if (error) throw new Error(`Siparişler alınamadı: ${error.message}`);
    const parca = (data ?? []) as unknown as HamSiparis[];
    ham.push(...parca);
    if (parca.length < 500) break;
  }

  const onaylar = new Map<string, { tarih: string; depoIds: string[] }>();
  for (let baslangic = 0; ; baslangic += 500) {
    const { data, error } = await admin.from("eclub_siparis_utt_onaylari")
      .select("talep_id, onay_tarihi, depo_tercihleri_snapshot")
      .eq("utt_id", kapsam.utt_id)
      .order("onay_tarihi", { ascending: false })
      .range(baslangic, baslangic + 499);
    if (error) throw new Error(`UTT sipariş onayları alınamadı: ${error.message}`);
    for (const kayit of data ?? []) onaylar.set(kayit.talep_id, {
      tarih: kayit.onay_tarihi,
      depoIds: Array.isArray(kayit.depo_tercihleri_snapshot)
        ? kayit.depo_tercihleri_snapshot.flatMap((tercih: { depo_sube_id?: unknown }) => typeof tercih.depo_sube_id === "string" ? [tercih.depo_sube_id] : [])
        : [],
    });
    if ((data ?? []).length < 500) break;
  }

  const tumUrunIds = [...new Set(ham.flatMap((kayit) => {
    const id = tekil(kayit.v_yayin_kunye)?.urun_id;
    return id ? [id] : [];
  }))];
  const tumGlnler = [...new Set(ham.flatMap((kayit) => {
    const gln = tekil(kayit.eclub_eczaneler)?.gln;
    return gln ? [gln] : [];
  }))];
  const eczaneIds = [...new Set(ham.map((kayit) => kayit.eczane_id))];
  const [urunSonucu, eczaneSonucu, tercihSonucu, depoKatalogu] = await Promise.all([
    tumUrunIds.length ? admin.from("urunler").select("urun_id, urun_adi").in("urun_id", tumUrunIds) : Promise.resolve({ data: [], error: null }),
    tumGlnler.length ? admin.from("eclub_eczane_master").select("gln, eczane_adi").in("gln", tumGlnler) : Promise.resolve({ data: [], error: null }),
    eczaneIds.length ? admin.from("eclub_eczane_depo_tercihleri").select("eczane_id, depo_sube_id").in("eczane_id", eczaneIds) : Promise.resolve({ data: [], error: null }),
    depoKataloguGetir(admin),
  ]);
  if (urunSonucu.error || eczaneSonucu.error || tercihSonucu.error) {
    throw new Error(urunSonucu.error?.message ?? eczaneSonucu.error?.message ?? tercihSonucu.error?.message);
  }
  const urunAdlari = new Map((urunSonucu.data ?? []).map((urun) => [urun.urun_id, urun.urun_adi]));
  const eczaneAdlari = new Map((eczaneSonucu.data ?? []).map((eczane) => [eczane.gln, eczane.eczane_adi]));
  const depoAdlari = new Map(depoKatalogu.map((depo) => [depo.depo_sube_id, konumEtiketi(depo)]));
  const tercihler = new Map<string, string[]>();
  for (const tercih of tercihSonucu.data ?? []) {
    const liste = tercihler.get(tercih.eczane_id) ?? [];
    liste.push(depoAdlari.get(tercih.depo_sube_id) ?? "Depo / şube adı bulunamadı");
    tercihler.set(tercih.eczane_id, liste);
  }

  const filtreli = ham.filter((kayit) => !filtreler.urun_id || tekil(kayit.v_yayin_kunye)?.urun_id === filtreler.urun_id);
  const durumlu = filtreli.map((kayit) => ({ kayit, durum: siparisTakipDurumu(kayit.durum, onaylar.get(kayit.talep_id)?.tarih ?? null) }));
  const sonuclar = durumlu.filter(({ durum }) => !filtreler.durum || durum === filtreler.durum);
  const sayfali = sonuclar.slice(filtreler.offset, filtreler.offset + filtreler.limit);
  const talepler: SiparisTakipTalebi[] = sayfali.map(({ kayit, durum }) => {
    const gln = tekil(kayit.eclub_eczaneler)?.gln ?? null;
    const kisi = tekil(kayit.eclub_kisiler);
    const urunId = tekil(kayit.v_yayin_kunye)?.urun_id ?? kayit.yayin_id;
    return {
      talep_id: kayit.talep_id,
      created_at: kayit.created_at,
      donem_kodu: kayit.donem_kodu,
      eczane: { eczane_id: kayit.eczane_id, eczane_adi: (gln ? eczaneAdlari.get(gln) : null) ?? "Eczane", gln },
      uye: { ad_soyad: `${kisi?.ad ?? ""} ${kisi?.soyad ?? ""}`.trim() || "Üye", rol: kisi?.rol ?? "eczaci" },
      urun: { yayin_id: kayit.yayin_id, urun_id: urunId, urun_adi: urunAdlari.get(urunId) ?? "Ürün" },
      siparis: {
        tipi: kayit.siparis_tipi,
        adet: Number(kayit.siparis_adet ?? 0),
        mal_fazlasi: Number(kayit.siparis_mal_fazlasi ?? 0),
        kullanilan_puan: Number(kayit.toplanan_puan ?? 0),
        cek_tutari_tl: Number(kayit.talep_edilen_cek_tl ?? 0),
      },
      depo_tercihleri: onaylar.has(kayit.talep_id)
        ? (onaylar.get(kayit.talep_id)?.depoIds ?? []).map((id) => depoAdlari.get(id) ?? "Depo / şube adı bulunamadı")
        : tercihler.get(kayit.eczane_id) ?? [],
      depo_tercihleri_onay_anlik_mi: onaylar.has(kayit.talep_id),
      durum,
      utt_onay_tarihi: onaylar.get(kayit.talep_id)?.tarih ?? null,
      onaylanabilir_mi: durum === "inceleme_bekliyor",
    };
  });
  const eczaneler = [...new Map(ham.map((kayit) => {
    const gln = tekil(kayit.eclub_eczaneler)?.gln ?? null;
    return [kayit.eczane_id, { id: kayit.eczane_id, etiket: (gln ? eczaneAdlari.get(gln) : null) ?? "Eczane" }];
  })).values()].sort((a, b) => a.etiket.localeCompare(b.etiket, "tr"));
  const urunler = [...new Map(ham.map((kayit) => {
    const id = tekil(kayit.v_yayin_kunye)?.urun_id ?? kayit.yayin_id;
    return [id, { id, etiket: urunAdlari.get(id) ?? "Ürün" }];
  })).values()].sort((a, b) => a.etiket.localeCompare(b.etiket, "tr"));
  return {
    // Durum filtresi listeyi daraltır; stat kartları diğer filtrelerdeki tüm aşamaları gösterir.
    statlar: siparisTakipStatlariniHesapla(durumlu.map(({ durum }) => durum)),
    filtre_secenekleri: { eczaneler, urunler },
    talepler,
    sayfalama: { toplam: sonuclar.length, offset: filtreler.offset, limit: filtreler.limit, sonraki_kayit_var_mi: filtreler.offset + talepler.length < sonuclar.length },
  };
}
