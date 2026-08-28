import { alanlariDogrula } from "@/lib/hapbi/sozlesme";
import { egitimleriOku, egitimIceriginiOku } from "@/lib/hapbi/egitim";
import { TUR_SIRA } from "@/lib/video/icerikTuru";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import { egitimBagla, reddet, type HapbiAlanCalistirici } from "@/lib/hapbi/aracMotorlari/ortak";

export const egitimAraciniCalistir: HapbiAlanCalistirici = async (baglam, ad, a) => {
  const { db, kullanici: k } = baglam;
  if (ad === "egitim_icerigi") {
    alanlariDogrula(a, ["egitim_id"]);
    const egitim = typeof a.egitim_id === "string" ? baglam.egitimHaritasi.get(a.egitim_id) : undefined;
    if (!egitim) return { durum: "yetkisiz", aciklama: "Önce bu istekte erişilebilir eğitimleri okuyup verilen eğitim kimliğini seçin." };
    const veri = await egitimIceriginiOku(db, k, egitim.yayinId);
    if (!veri) return { durum: "yetkisiz", aciklama: "Bu eğitim artık erişilebilir değil; öneriyi yenileyin." };
    return {
      durum: veri.metin ? "ok" : "bos", tur: "egitim_icerigi", veri,
      kaynak: baglam.kaynak(`${egitim.etiket} · yayına bağlı senaryo`, egitim.url),
    };
  }

  alanlariDogrula(a, ["arama", "kategori", "tamamlama"]);
  const utt = TUKETICI_ROLLER.includes(k.rol);
  if (k.kimlik_turu !== "kullanici" || !k.firma_id || !(utt || (k.rol === "bm" && k.cc_aktif)) || (utt && !k.takim_id)) return reddet();
  if (a.arama !== undefined && (typeof a.arama !== "string" || a.arama.length > 120)) throw new Error("Eğitim araması geçersiz.");
  if (a.kategori !== undefined && !["tumu", ...TUR_SIRA].includes(String(a.kategori))) throw new Error("Eğitim kategorisi geçersiz.");
  const tamamlama = a.tamamlama ?? "kalan";
  if (!["kalan", "tamamlanan", "tumu"].includes(String(tamamlama))) throw new Error("Tamamlama filtresi geçersiz.");
  const katalog = await egitimleriOku(db, k, { tumAdaylar: true, tamamlananlarDahil: tamamlama !== "kalan" });
  const kelimeler = typeof a.arama === "string" ? a.arama.trim().toLocaleLowerCase("tr-TR").split(/\s+/).filter(Boolean) : [];
  const eslesen = katalog.videolar.filter(v => (!a.kategori || a.kategori === "tumu" || v.tur === a.kategori)
    && (tamamlama !== "tamamlanan" || v.durum === "bu_turda_tamamlandi")
    && kelimeler.every(kelime => `${v.baslik} ${v.teknik ?? ""}`.toLocaleLowerCase("tr-TR").includes(kelime)));
  const veri = {
    ...katalog, eslesen: eslesen.length, listelenen: Math.min(eslesen.length, 20), videolar: eslesen.slice(0, 20),
    siralama: "Güncel adaylar arasında ad/teknik ve kategori filtresi, yayın tarihi sırası; en çok 20 sonuç.",
  };
  const egitimKaynagi = baglam.kaynak("Eğitim Yayınları · geçerli tur", utt ? undefined : "/challenge-club");
  const egitimler = veri.videolar.map((v, i) => egitimBagla(baglam, `${egitimKaynagi.id}-e${i + 1}`, v));
  return {
    durum: eslesen.length ? "ok" : "bos", kaynak: egitimKaynagi, egitimler,
    veri: { ...veri, videolar: veri.videolar.map((v, i) => ({
      baslik: v.baslik, teknik: v.teknik, tur: v.tur, video_puani: v.video_puani,
      arac_turu: v.arac_turu, durum: v.durum, sonraki_tur: v.sonraki_tur,
      dogru_cevap: v.dogru_cevap, yanlis_cevap: v.yanlis_cevap, dogru_cevap_yuzdesi: v.dogru_cevap_yuzdesi,
      egitim_id: egitimler[i].id,
    })) },
  };
};
