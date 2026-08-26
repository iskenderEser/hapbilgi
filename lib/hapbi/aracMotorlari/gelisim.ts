import { alanlariDogrula, type HapbiAracSonucu } from "@/lib/hapbi/sozlesme";
import { egitimleriOku } from "@/lib/hapbi/egitim";
import { gelisimiDegerlendir, olcumleriKarsilastir, raporOlcumleri } from "@/lib/hapbi/rehberlik";
import { esitSureliLigAraliklari, ligPeriyoduAraligi, oncekiLigPeriyodu, trGunu, trGunEkle } from "@/lib/zaman/kontrol";
import type { LigPeriyot } from "@/lib/tclub/hbligi/ligRpcCagir";
import { TUR_SIRA } from "@/lib/video/icerikTuru";
import { TUKETICI_ROLLER, URETICI_ROLLER, YONETICI_ROLLER, YONLENDIRICI_ROLLER } from "@/lib/utils/roller";
import { egitimBagla, guvenliSatirlar, LIG_ALANLARI, PERIYOT_ALANLARI, periyoduDogrula, reddet, type HapbiAlanCalistirici } from "@/lib/hapbi/aracMotorlari/ortak";
import { performansRaporunuOku, sahaAraciniCalistir } from "@/lib/hapbi/aracMotorlari/saha";

export const gelisimAraciniCalistir: HapbiAlanCalistirici = async (baglam, ad, a) => {
  alanlariDogrula(a, [...PERIYOT_ALANLARI, "kapsam", ...(ad === "gelisim_rehberi" ? ["hedef", "kategori", "calisma"] : ["yontem"])]);
  const { db, kullanici: k, simdi } = baglam;
  const utt = TUKETICI_ROLLER.includes(k.rol);
  const sahaRol = utt || YONLENDIRICI_ROLLER.includes(k.rol) || URETICI_ROLLER.includes(k.rol) || YONETICI_ROLLER.includes(k.rol);
  const kapsamUygun = k.kimlik_turu === "kullanici" && !!k.firma_id && (
    a.kapsam === "kisisel" ? utt || (k.rol === "bm" && k.cc_aktif)
      : a.kapsam === "ekip" && !utt && sahaRol
  );
  if (!kapsamUygun) return reddet();

  const p = periyoduDogrula(a);
  const aralik = ligPeriyoduAraligi(p);
  if (new Date(aralik.baslangic) > simdi) throw new Error("Gelecek dönem değerlendirilemez.");
  const ccKisisel = k.rol === "bm" && a.kapsam === "kisisel";
  const raporOku = async (periyot: LigPeriyot, pencere?: ReturnType<typeof ligPeriyoduAraligi>): Promise<HapbiAracSonucu> => {
    if (!pencere) return sahaAraciniCalistir(
      baglam,
      ccKisisel ? "lig_durumu" : "performans_raporu",
      ccKisisel ? { ...periyot, lig: "cc" } : { ...periyot },
    );
    if (!ccKisisel) return performansRaporunuOku(baglam, periyot, pencere);
    const { data, error } = await db.rpc("_cc_ligi_aralik", { p_bas: trGunu(new Date(pencere.baslangic)), p_bit: trGunEkle(trGunu(new Date(pencere.bitis)), 1) })
      .eq("firma_id", k.firma_id).eq("kullanici_id", k.kullanici_id);
    if (error) throw new Error("CC aralık raporu okunamadı.");
    const kendi = (data ?? []).filter((r: Record<string, unknown>) => r.firma_id === k.firma_id && r.kullanici_id === k.kullanici_id);
    return {
      durum: kendi.length ? "ok" : "bos", kaynak: baglam.kaynak("C-Club kişisel karşılaştırma", "/cc-ligi", periyot),
      veri: { kendi_kaydim: guvenliSatirlar(kendi, LIG_ALANLARI)[0] ?? null },
    };
  };

  if (ad === "donem_karsilastir") {
    const yontem = a.yontem ?? "esit_sure";
    if (!["esit_sure", "takvim"].includes(String(yontem))) throw new Error("Karşılaştırma yöntemi geçersiz.");
    const onceki = oncekiLigPeriyodu(p);
    const esit = yontem === "esit_sure" ? esitSureliLigAraliklari(p, simdi) : null;
    if (yontem === "esit_sure" && !esit) return { durum: "bos", aciklama: "Bu dönemde henüz tamamlanmış gün yok; eşit süreli karşılaştırma yapılamıyor. İsterseniz takvim toplamını sorgulayabilirsiniz." };
    const [mevcutRapor, oncekiRapor] = await Promise.all([raporOku(p, esit?.mevcut), raporOku(onceki, esit?.onceki)]);
    if (![mevcutRapor, oncekiRapor].every(r => ["ok", "bos"].includes(r.durum))) throw new Error("Karşılaştırma kaynağı okunamadı.");
    const mevcut = raporOlcumleri(mevcutRapor, ccKisisel);
    const eski = raporOlcumleri(oncekiRapor, ccKisisel);
    const karsilastirmaKaynagi = baglam.kaynak("Dönem karşılaştırması", mevcutRapor.kaynak?.url, p);
    karsilastirmaKaynagi.donem = `${mevcutRapor.kaynak?.donem} ↔ ${oncekiRapor.kaynak?.donem}${esit ? ` · ilk ${esit.gunSayisi} tamamlanmış gün` : ""}`;
    return {
      durum: "ok", tur: "karsilastirma", kaynak: karsilastirmaKaynagi,
      veri: { kapsam: a.kapsam, kanal: ccKisisel ? "C-Club kişisel" : "T-Club raporu",
        yontem, gun_sayisi: esit?.gunSayisi ?? null,
        mevcut_donem: { ...p, ...(esit?.mevcut ?? aralik), tamamlandi: new Date(aralik.bitis) < simdi },
        onceki_donem: { ...onceki, ...(esit?.onceki ?? ligPeriyoduAraligi(onceki)) },
        olcumler: olcumleriKarsilastir(eski, mevcut),
        dayanaklar: [mevcutRapor.kaynak, oncekiRapor.kaynak],
        sinir: esit ? "Yalnız iki dönemin başından eşit sayıda tamamlanmış Türkiye günü; bugünün kısmi verisi dahil değildir. Kısa dönem uzunluğu ortak sınırdır. Bu değerler tam dönem/bugüne kadar toplam değildir. Puan farkı mesleki başarı veya nedensellik ölçümü değildir. Eksik/sıfır/negatif bazda yüzde hesaplanmaz."
          : "Tamamlanmamış dönem henüz biriken toplamdır; tam önceki döneme göre düşüş veya başarı değişimi çıkarılamaz. Sıfır/negatif önceki değer veya eksik kayıt için yüzde hesaplanmaz. Fark nedensellik göstermez; eğitim/satış başarısı ölçümü değildir." },
    };
  }

  if (!["ogrenme", "puan"].includes(String(a.hedef)) || !["tumu", ...TUR_SIRA].includes(String(a.kategori))) throw new Error("Gelişim hedefi geçersiz.");
  const calisma = a.calisma ?? "genel";
  if (!["genel", "tekrar"].includes(String(calisma))) throw new Error("Çalışma türü geçersiz.");
  if (calisma === "tekrar" && (a.hedef !== "ogrenme" || a.kapsam !== "kisisel")) {
    return { durum: "desteklenmiyor", aciklama: "Yeniden çalışma kişisel öğrenme içindir; tekrar/extra puan kazanımını bu araç hesaplamaz. Ekip raporu kişisel eğitim geçmişi değildir." };
  }
  const [rapor, katalog] = await Promise.all([
    raporOku(p),
    a.kapsam === "kisisel" ? egitimleriOku(db, k, { tumAdaylar: true, tamamlananlarDahil: a.hedef === "ogrenme" }) : Promise.resolve(null),
  ]);
  if (!["ok", "bos"].includes(rapor.durum)) throw new Error("Gelişim raporu okunamadı.");
  const degerlendirme = gelisimiDegerlendir(rapor, katalog, a.hedef as "ogrenme" | "puan", String(a.kategori), ccKisisel, calisma as "genel" | "tekrar", k.rol);
  const gelisimKaynagi = baglam.kaynak(a.kapsam === "kisisel" ? "Kişisel gelişim değerlendirmesi" : "Ekip gelişim değerlendirmesi", rapor.kaynak?.url, p);
  const egitimler = degerlendirme.oneriler.map((v, i) => egitimBagla(baglam, `${gelisimKaynagi.id}-e${i + 1}`, v, v.gerekce));
  return {
    durum: "ok", tur: "rehberlik", kaynak: gelisimKaynagi, egitimler,
    veri: { kapsam: a.kapsam, kanal: ccKisisel ? "C-Club kişisel" : "T-Club raporu", aralik,
      degerlendirme: degerlendirme.degerlendirme, olcumler: degerlendirme.olcumler,
      bulgular: degerlendirme.bulgular, kategori_olcumleri: degerlendirme.kategori_olcumleri,
      egitim_durumu: katalog ? { toplam: katalog.toplam_yayin, tamamlanan: katalog.bu_turda_tamamlanan, kalan: katalog.kalan, kategoriler: katalog.kategoriler } : null,
      oneriler: degerlendirme.oneriler.map((v, i) => ({ egitim_id: egitimler[i].id, baslik: v.baslik, teknik: v.teknik, tur: v.tur, durum: v.durum, video_puani: v.video_puani, gerekce: v.gerekce })),
      dayanak: rapor.kaynak },
  };
};
