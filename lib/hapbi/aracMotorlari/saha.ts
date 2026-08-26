import { alanlariDogrula, type HapbiAracSonucu } from "@/lib/hapbi/sozlesme";
import { ligPeriyoduAraligi } from "@/lib/zaman/kontrol";
import type { LigPeriyot } from "@/lib/tclub/hbligi/ligRpcCagir";
import { getUttLig } from "@/lib/tclub/hbligi/getUttLig";
import { getSahaLig, type SahaGorunumu } from "@/lib/tclub/hbligi/getSahaLig";
import { ADMIN_ROLLER, CCLIGI_GORENLERLER, TUKETICI_ROLLER, URETICI_ROLLER, YONETICI_ROLLER, YONLENDIRICI_ROLLER } from "@/lib/utils/roller";
import { ureticiYetenegi } from "@/lib/uretici/yetenekler";
import { kategorileriTopla, ozetToplami } from "@/lib/rapor/bm/toplamlar";
import { guvenliSatirlar, LIG_ALANLARI, PERIYOT_ALANLARI, periyoduDogrula, reddet, type HapbiAlanCalistirici, type HapbiAracBaglami } from "@/lib/hapbi/aracMotorlari/ortak";

function rolKapsami(k: HapbiAracBaglami["kullanici"]) {
  const utt = TUKETICI_ROLLER.includes(k.rol);
  const uretici = ureticiYetenegi(k.rol);
  const sahaRol = utt || YONLENDIRICI_ROLLER.includes(k.rol) || URETICI_ROLLER.includes(k.rol) || YONETICI_ROLLER.includes(k.rol);
  return { utt, uretici, sahaRol };
}

function liste(k: HapbiAracBaglami["kullanici"], rows: Record<string, unknown>[]) {
  return {
    toplam_satir: rows.length, listelenen: Math.min(rows.length, 40),
    kendi_kaydim: rows.find(r => r.kullanici_id === k.kullanici_id)
      ? guvenliSatirlar(rows.filter(r => r.kullanici_id === k.kullanici_id), LIG_ALANLARI)[0] : null,
    satirlar: guvenliSatirlar(rows, LIG_ALANLARI),
    not: "Eksik sıra null'dır, birincilik değildir. Liste 40 satırla sınırlıdır; liste üzerinden tüm kapsam toplamı hesaplama.",
  };
}

export async function performansRaporunuOku(
  baglam: HapbiAracBaglami,
  p: LigPeriyot,
  aralik: ReturnType<typeof ligPeriyoduAraligi>,
): Promise<HapbiAracSonucu> {
  const { db, kullanici: k } = baglam;
  const { utt, uretici, sahaRol } = rolKapsami(k);
  if (k.kimlik_turu !== "kullanici" || !sahaRol || !k.firma_id) return reddet();
  if (YONETICI_ROLLER.includes(k.rol)) {
    const args = { p_yonetici_id: k.kullanici_id, p_baslangic: aralik.baslangic, p_bitis: aralik.bitis };
    const [ozet, takimlar] = await Promise.all([
      db.rpc("get_yonetici_rapor_ana_ozet_v2", args),
      db.rpc("get_yonetici_hiyerarsi_v2", { ...args, p_seviye: "takim", p_ust_birim_id: null }),
    ]);
    if (ozet.error || takimlar.error) throw new Error("Yönetici raporu okunamadı.");
    const alanlar = ["izleme_puani", "cevaplama_puani", "oneri_puani", "extra_puani", "ileri_sarma_kaybi", "yanlis_cevap_kaybi", "oneri_kaybi", "challenge_kaybi", "kazanilan_toplam", "kaybedilen_toplam", "net_puan", "toplam_takim", "toplam_bolge", "toplam_utt", "aktif_utt", "donem_tamamlanan_izleme", "donem_benzersiz_utt_yayin", "donemde_yayina_alinan", "su_an_yayinda", "guncel_tur_toplam_firsat", "guncel_tur_tamamlanan", "guncel_tur_kalan", "guncel_tur_izlenme_orani"];
    return {
      durum: ozet.data?.length ? "ok" : "bos", kaynak: baglam.kaynak("Yönetici firma raporu", "/raporlar/yonetici", p),
      veri: { aralik, ozet: guvenliSatirlar(ozet.data ?? [], alanlar)[0] ?? null,
        takimlar: guvenliSatirlar(takimlar.data ?? [], ["birim_adi", "izleme_puani", "cevaplama_puani", "net_puan"]),
        toplam_takim_satiri: takimlar.data?.length ?? 0,
        not: "guncel_tur alanları anlıktır; dönem puanlarıyla karıştırılmaz. Takım listesi en çok 40 satırdır." },
    };
  }
  const kapsam: Record<string, string> = utt ? { p_kullanici_id: k.kullanici_id }
    : k.rol === "bm" && k.bolge_id ? { p_bolge_id: k.bolge_id }
    : (k.rol === "tm" || uretici?.raporScope === "takim") && k.takim_id ? { p_takim_id: k.takim_id }
    : YONETICI_ROLLER.includes(k.rol) || uretici?.raporScope === "firma" ? { p_firma_id: k.firma_id } : {};
  if (!Object.keys(kapsam).length) return reddet();
  const args = { ...kapsam, p_baslangic: aralik.baslangic, p_bitis: aralik.bitis };
  const [ozet, kategoriler, uretim] = await Promise.all([
    db.rpc("get_kullanici_ozet", args), db.rpc("get_kullanici_kategori_dagilimi", args),
    uretici ? db.rpc("get_uretici_rapor_ozet_v3", { p_uretici_id: k.kullanici_id, p_baslangic: aralik.baslangic, p_bitis: aralik.bitis }) : Promise.resolve({ data: null, error: null }),
  ]);
  if (ozet.error || kategoriler.error || uretim.error) throw new Error("Performans raporu okunamadı.");
  const rows = ozet.data ?? [];
  const raporRol = utt ? "utt" : uretici ? "uretici" : k.rol;
  return {
    durum: rows.length || uretim.data?.length ? "ok" : "bos",
    kaynak: baglam.kaynak(uretici ? "Kişisel üretim ve saha raporu" : "T-Club performans raporu", `/raporlar/${raporRol}`, p),
    veri: { aralik, kapsam: utt ? "kişisel" : k.rol === "bm" ? "bölge" : "yetkili takım/firma", ozet: rows.length ? ozetToplami(rows) : null,
      ...(uretici ? { uretim: guvenliSatirlar(uretim.data ?? [], ["toplam_talep", "tamamlanan_talep", "yayindaki_video", "durdurulan_video"])[0] ?? null } : {}),
      kategoriler: kategorileriTopla(kategoriler.data ?? []),
      not: "Seçilen rapor aralığı. Rapor ekranında aynı dönemi seçin; geçmiş dönem aralığı bu kaynak etiketinde belirtilir. BM için kendi CC puanı değil, UTT saha performansıdır. Üreticinin uretim alanı yalnız kendi oluşturduğu talepler/yayınlar; ozet ve kategoriler ise yetkili saha kapsamıdır. Şirket Üretim Raporları toplamı/varyantları için uretim_raporu gerekir; tamamlanan talep yayına alınan içerik değildir." },
  };
}

export const sahaAraciniCalistir: HapbiAlanCalistirici = async (baglam, ad, a) => {
  alanlariDogrula(a, ad === "lig_durumu" ? [...PERIYOT_ALANLARI, "lig"] : PERIYOT_ALANLARI);
  const p = periyoduDogrula(a);
  const aralik = ligPeriyoduAraligi(p);
  const { db, kullanici: k } = baglam;
  if (k.kimlik_turu !== "kullanici") return reddet();
  if (ad === "performans_raporu") return performansRaporunuOku(baglam, p, aralik);

  const { utt, uretici, sahaRol } = rolKapsami(k);
  if (a.lig === "cc") {
    if (!CCLIGI_GORENLERLER.includes(k.rol) || !k.firma_id || !k.cc_aktif) return reddet();
    const isimler = { hafta: "get_cc_ligi_haftalik", ay: "get_cc_ligi_aylik", donem: "get_cc_ligi_donemlik", yil: "get_cc_ligi_yillik" };
    const args = { p_yil: p.yil, ...(p.periyot === "ay" ? { p_ay: p.ay } : p.periyot === "donem" ? { p_ceyrek: p.ceyrek } : p.periyot === "hafta" ? { p_hafta: p.hafta } : {}) };
    const { data, error } = await db.rpc(isimler[p.periyot], args);
    if (error) throw new Error("CC ligi okunamadı.");
    const rows = (data ?? []).filter((r: Record<string, unknown>) => r.firma_id === k.firma_id);
    return { durum: rows.length ? "ok" : "bos", kaynak: baglam.kaynak("C-Club Ligi · firma kapsamı", "/cc-ligi", p), veri: { aralik, ...liste(k, rows) } };
  }
  if (a.lig !== "hb") throw new Error("Desteklenmeyen lig.");
  if (!sahaRol && !ADMIN_ROLLER.includes(k.rol)) return reddet();
  if (utt) {
    if (!k.bolge_id || !k.firma_id) return reddet();
    const sonuc = await getUttLig(db, k.kullanici_id, k.bolge_id, p);
    const rows = sonuc.lig.map(r => ({ ...r, sira: r.sira > 0 ? r.sira : null }));
    return { durum: rows.length ? "ok" : "bos", kaynak: baglam.kaynak("HB Ligi · bölge kapsamı", "/hbligi", p), veri: { aralik, ...liste(k, rows) } };
  }
  const gorunum: SahaGorunumu = ADMIN_ROLLER.includes(k.rol) ? "admin" : URETICI_ROLLER.includes(k.rol) ? "uretici" : k.rol === "bm" ? "bm" : k.rol === "tm" ? "tm" : "yonetici";
  const sonuc = await getSahaLig(db, { ...k, gorunum, uretici_scope: uretici?.raporScope }, p);
  return {
    durum: sonuc.lig.length ? "ok" : "bos", kaynak: baglam.kaynak(`HB Ligi · ${sonuc.kapsam_adi}`, "/hbligi", p),
    veri: { aralik, kapsam: sonuc.kapsam_aciklamasi, ...liste(k, sonuc.lig.map(r => ({ ...r }))) },
  };
};
