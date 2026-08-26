import { alanlariDogrula } from "@/lib/hapbi/sozlesme";
import { eclubKisiHapbiOzeti, type EclubKisiListeFiltresi } from "@/lib/hapbi/eclubKisi";
import { ECLUB_TUKETICI_ROLLERI, ECLUB_YONETIM_ROLLERI } from "@/lib/utils/roller";
import { ligPeriyoduAraligi } from "@/lib/zaman/kontrol";
import { PERIYOT_ALANLARI, periyoduDogrula, reddet, type HapbiAlanCalistirici } from "@/lib/hapbi/aracMotorlari/ortak";

export const eclubAraciniCalistir: HapbiAlanCalistirici = async (baglam, ad, a) => {
  const { db, kullanici: k, simdi } = baglam;
  if (ad === "eclub_kisisel_durum") {
    alanlariDogrula(a, ["liste"]);
    if (k.kimlik_turu !== "eclub_kisi" || !ECLUB_TUKETICI_ROLLERI.includes(k.rol)) return reddet();
    const liste = a.liste ?? "bekleyen";
    if (!["bekleyen", "tamamlanan", "suresi_gecmis", "tumu"].includes(String(liste))) throw new Error("E-Club liste filtresi geçersiz.");
    const veri = await eclubKisiHapbiOzeti(db, k.kullanici_id, k.rol, liste as EclubKisiListeFiltresi, simdi);
    const eclubKaynagi = baglam.kaynak("Kişisel E-Club özeti", "/eclub/panel");
    const egitimler = veri.egitimler.map((egitim, i) => ({
      id: `${eclubKaynagi.id}-e${i + 1}`,
      etiket: `${egitim.baslik}${egitim.teknik ? ` · ${egitim.teknik}` : ""}`,
      url: egitim.url,
      gerekce: egitim.durum === "bekleyen"
        ? `Süresi devam eden eğitim${egitim.kalan_gun !== null ? `; ${egitim.kalan_gun} gün kaldı` : ""}.`
        : egitim.durum === "tamamlanan" ? "Tamamladığınız eğitim." : "Tamamlanmadan süresi geçmiş; puanlı güncel görev değildir.",
    }));
    return {
      durum: "ok", tur: "rehberlik", kaynak: eclubKaynagi, egitimler,
      veri: { ...veri, egitimler: veri.egitimler.map((egitim, i) => ({
        egitim_id: egitimler[i].id, baslik: egitim.baslik, teknik: egitim.teknik,
        firma: egitim.firma, durum: egitim.durum, kalan_gun: egitim.kalan_gun,
        kayitli_video_puani: egitim.kayitli_video_puani, kayitli_soru_puani: egitim.kayitli_soru_puani,
      })) },
    };
  }

  alanlariDogrula(a, PERIYOT_ALANLARI);
  const p = periyoduDogrula(a);
  const aralik = ligPeriyoduAraligi(p);
  if (k.kimlik_turu !== "kullanici" || !k.eclub_aktif || !k.firma_id || !ECLUB_YONETIM_ROLLERI.includes(k.rol)) return reddet();
  const { eclubYonetimKapsaminiGetir } = await import("@/lib/eclub/yonetimKapsami");
  const { eclubRaporunuTopla } = await import("@/lib/eclub/rapor");
  const kapsam = await eclubYonetimKapsaminiGetir(db, { ...k, ad: null, soyad: null });
  if (kapsam.uttler.length > 100) return { durum: "desteklenmiyor", aciklama: "Bu kapsam etkileşimli sorgu sınırını aşıyor. E-Club rapor ekranını kullanın." };
  const rows = [];
  for (const u of kapsam.uttler) {
    const sonuc = await db.rpc("get_eclub_utt_rapor", {
      p_utt_id: u.utt_id, p_baslangic: aralik.baslangic,
      p_bitis: new Date(new Date(aralik.bitis).getTime() + 1).toISOString(),
    });
    if (sonuc.error) throw new Error("E-Club raporu okunamadı.");
    rows.push(...sonuc.data ?? []);
  }
  const rapor = eclubRaporunuTopla(rows);
  return {
    durum: rows.length ? "ok" : "bos", kaynak: baglam.kaynak("E-Club takım raporu", "/eclub/raporlar", p),
    veri: { aralik, kapsam: kapsam.kapsam_adi, ozet: rapor.ozet,
      toplam_icerik: rapor.icerikler.length, toplam_eczane: rapor.eczaneler.length,
      liste_siniri: 30,
      icerikler: rapor.icerikler.slice(0, 30).map(({ icerik_adi, toplam_puan, tamamlanan_izleme }) => ({ icerik_adi, toplam_puan, tamamlanan_izleme })),
      eczaneler: rapor.eczaneler.slice(0, 30).map(({ eczane_adi, toplam_puan, tamamlanan_izleme }) => ({ eczane_adi, toplam_puan, tamamlanan_izleme })) },
  };
};
