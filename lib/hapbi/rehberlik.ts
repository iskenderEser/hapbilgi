import type { HapbiAracSonucu } from "@/lib/hapbi/sozlesme";
import type { egitimleriOku } from "@/lib/hapbi/egitim";
import { isIcerikTuru, TUR_BASLIK } from "@/lib/video/icerikTuru";
import { TUKETICI_ROLLER, YONLENDIRICI_ROLLER } from "@/lib/utils/roller";

type Katalog = Awaited<ReturnType<typeof egitimleriOku>>;
export type GelisimHedefi = "ogrenme" | "puan";
const kayit = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const sayi = (v: unknown): number | null => (typeof v === "number" || (typeof v === "string" && v.trim() !== "")) && Number.isFinite(Number(v)) ? Number(v) : null;

export function raporOlcumleri(rapor: HapbiAracSonucu, ccKisisel = false) {
  const veri = kayit(rapor.veri);
  const ozet = kayit(ccKisisel ? veri.kendi_kaydim : veri.ozet);
  const al = (...alanlar: string[]) => {
    for (const alan of alanlar) {
      const deger = sayi(ozet[alan]);
      if (deger !== null) return deger;
    }
    return null;
  };
  return {
    net_puan: al("toplam_net_puan", "net_puan", "toplam_puan"),
    izleme_puani: al("video_puani", "izleme_puani"),
    cevaplama_puani: al("soru_puani", "cevaplama_puani"),
    ileri_sarma_kaybi: al("ileri_sarma_kaybi"),
    yanlis_cevap_kaybi: al("yanlis_cevap_kaybi"),
    oneri_kaybi: al("oneri_kaybi"),
    challenge_kaybi: al("challenge_kaybi"),
  };
}

export function olcumleriKarsilastir(onceki: ReturnType<typeof raporOlcumleri>, mevcut: ReturnType<typeof raporOlcumleri>) {
  return Object.keys(mevcut).map(alan => {
    const key = alan as keyof typeof mevcut;
    const eski = onceki[key], yeni = mevcut[key];
    const fark = eski !== null && yeni !== null ? yeni - eski : null;
    return { olcum: key, onceki: eski, mevcut: yeni, fark,
      yuzde_degisim: fark !== null && eski !== null && eski > 0 ? Math.round(fark / eski * 1000) / 10 : null };
  });
}

// Öncelikler uygulama verisinden hesaplanır; klinik/saha yetkinliği veya başarı puanı değildir.
export function gelisimiDegerlendir(rapor: HapbiAracSonucu, katalog: Katalog | null, hedef: GelisimHedefi, kategori: string, ccKisisel = false, calisma: "genel" | "tekrar" = "genel", rol = "") {
  const veri = kayit(rapor.veri);
  const olcumler = raporOlcumleri(rapor, ccKisisel);
  const kategoriler = (Array.isArray(veri.kategoriler) ? veri.kategoriler : []).map(kayit);
  const kayiplar = new Map(kategoriler.map(k => [String(k.icerik_turu), sayi(k.yanlis_cevap_kaybi)]));
  const bulgular: { gozlem: string; adim: string }[] = [];
  if ((olcumler.yanlis_cevap_kaybi ?? 0) > 0) bulgular.push({
    gozlem: `Seçilen dönemde yanlış cevaplardan ${olcumler.yanlis_cevap_kaybi} puan kaybı kaydedilmiş.`,
    adim: "Sonraki çalışmalarda yeni yanlış cevap kayıplarını azaltmak için ilgili eğitimleri yeniden çalışın; geçmiş puan kaybı telafi veya iade edilmiş olmaz. Bu değer yanlış cevap sayısı veya bilgi eksikliği ölçümü değildir.",
  });
  if ((olcumler.ileri_sarma_kaybi ?? 0) > 0) bulgular.push({
    gozlem: `Seçilen dönemde ileri sarmadan ${olcumler.ileri_sarma_kaybi} puan kaybı kaydedilmiş.`,
    adim: "Sonraki eğitimlerde yeni kayıpları azaltmak için ileri sarmadan tamamlamaya odaklanın. Geçmiş kayıpların iade edileceği bu veriden çıkarılamaz; kayıp öğrenme düzeyinizi göstermez.",
  });
  if ((olcumler.oneri_kaybi ?? 0) > 0) bulgular.push({
    gozlem: `Seçilen dönemde T-Club önerilerinden ${olcumler.oneri_kaybi} puan kaybı kaydedilmiş.`,
    adim: (TUKETICI_ROLLER.includes(rol) || YONLENDIRICI_ROLLER.includes(rol)
      ? "T-Club Öneri Takibi ekranında önerilerin izlenme durumunu ve sürelerini kontrol edin."
      : "Kapsamınızdaki T-Club raporundan öneri kaybını takip edin; önerilerin izlenme durumlarını ve sürelerini ilgili TM/BM ile değerlendirin. Bu rolde Öneri Takibi ekranına doğrudan erişim yoktur.")
      + " Bu kalem C-Club challenge kaybı değildir. Sonraki çalışmalardaki yeni kayıpları azaltmayı hedefleyin; yeni süre, kota veya geçmiş kayıp iadesi varsaymayın.",
  });
  if ((olcumler.challenge_kaybi ?? 0) > 0) bulgular.push({
    gozlem: `Seçilen dönemde C-Club challenge kayıtlarından ${olcumler.challenge_kaybi} puan kaybı kaydedilmiş.`,
    adim: (ccKisisel && rol === "bm"
      ? "C-Club gelen challenge kayıtlarını ve uygulamadaki sürelerini kontrol edin."
      : "Rapordaki challenge kaybını ilgili saha yöneticileriyle değerlendirin; bunu sizin kişisel gelen challenge kaydınız gibi sunmayın.")
      + " Bu kalem T-Club öneri kaybı değildir. Yeni bir süre, kota veya geçmiş kayıp iadesi varsaymayın.",
  });
  const ozet = kayit(veri.ozet);
  const toplamUtt = sayi(ozet.toplam_utt), aktifUtt = sayi(ozet.aktif_utt);
  if (toplamUtt !== null && aktifUtt !== null && toplamUtt > aktifUtt) bulgular.push({
    gozlem: `Kapsamda ${toplamUtt} UTT, seçilen dönemde ${aktifUtt} aktif UTT var.`,
    adim: "Raporun takım ve bölge kırılımında katılımı inceleyin; katılmayan kişilerin nedenini bu veri açıklamaz.",
  });
  const uretim = kayit(veri.uretim);
  const talep = sayi(uretim.toplam_talep), tamam = sayi(uretim.tamamlanan_talep);
  if (talep !== null && tamam !== null && talep > tamam) bulgular.push({
    gozlem: `Seçilen dönemde açılan ${talep} talebin ${tamam} tanesi üretim tamamlanma aşamasına ulaşmış.`,
    adim: "Üretim raporunda kalan taleplerin aşamasını kontrol edin; gecikme veya sorumlu kişi bu toplamdan çıkarılamaz.",
  });
  const kategoriKaydi = (tur: string) => katalog?.kategoriler.find(k => k.tur === tur);
  const adaylar = (katalog?.videolar ?? []).filter(v => (kategori === "tumu" || v.tur === kategori)
    && (calisma === "tekrar" ? v.durum === "bu_turda_tamamlandi"
      : v.durum !== "bu_turda_tamamlandi" || (hedef === "ogrenme" && (kayiplar.get(String(v.tur)) ?? 0) > 0)));
  const oncelik = (v: Katalog["videolar"][number]): number[] => [
    v.durum === "gelen_challenge_uzerinden_izlenmeli" ? 0 : 1,
    v.durum === "devam_ediyor" ? 0 : 1,
    hedef === "puan" ? -(sayi(v.video_puani) ?? -1) : -(kayiplar.get(String(v.tur)) ?? 0),
    v.durum === "bu_turda_tamamlandi" ? 1 : 0,
    hedef === "puan" ? 0 : kategoriKaydi(String(v.tur))?.tamamlanma_yuzdesi ?? 100,
  ];
  const oneriler = [...adaylar].sort((a, b) => {
    const x = oncelik(a), y = oncelik(b);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0; // Eşitlikte kataloğun yayın tarihi sırası korunur.
  }).slice(0, 3).map(v => {
    const tur = String(v.tur);
    const ad = isIcerikTuru(tur) ? TUR_BASLIK[tur] : "Bu kategori";
    const k = kategoriKaydi(tur);
    let gerekce: string;
    if (v.durum === "gelen_challenge_uzerinden_izlenmeli") gerekce = "Bu eğitim için gelen, henüz tamamlanmamış bir challenge var; bağlantı bu challenge üzerinden açılır.";
    else if (v.durum === "devam_ediyor") gerekce = "Bu turda başladığınız ve henüz tamamlamadığınız eğitim; önce yarım kalan çalışmanızı tamamlayabilirsiniz.";
    else if (v.durum === "bu_turda_tamamlandi") gerekce = (kayiplar.get(tur) ?? 0) > 0
      ? `Bu eğitimi bu turda tamamladınız. ${ad} kategorisinde ${kayiplar.get(tur)} puan yanlış cevap kaybı görüldüğü için yeniden çalışma seçeneğidir; kayıp bu videoya atfedilemez ve tekrar puanı garanti edilmez.`
      : "Bu eğitimi bu turda tamamladınız. Yeniden çalışma isteğiniz doğrultusunda önerildi; bu bir bilgi eksiği tespiti değildir ve tekrar puanı garanti edilmez.";
    else if (hedef === "puan" && sayi(v.video_puani) !== null) gerekce = `Puan hedefinize göre öne çıktı: kayıtlı video puanı ${v.video_puani}. Kazanım izleme ve puan koşullarına bağlıdır.`;
    else if ((kayiplar.get(tur) ?? 0) > 0) gerekce = `${ad} kategorisinde seçilen dönemde ${kayiplar.get(tur)} puan yanlış cevap kaybı var; bu kategoriyi çalışmak için bir adaydır, bu videoda hata yaptığınız anlamına gelmez.`;
    else gerekce = k ? `${ad} kategorisinde bu turda ${k.toplam} eğitimin ${k.tamamlanan} tanesi tamamlanmış; öğrenme kapsamınızı genişletmek için önerildi.` : "Bu turda henüz tamamlamadığınız bir eğitim.";
    return { ...v, gerekce };
  });
  return { olcumler, bulgular, oneriler,
    kategori_olcumleri: kategoriler.filter(k => isIcerikTuru(k.icerik_turu)).map(k => ({
      kategori: k.icerik_turu, baslik: TUR_BASLIK[k.icerik_turu as keyof typeof TUR_BASLIK],
      izlenme_sayisi: sayi(k.izlenme_sayisi), net_puan: sayi(k.toplam_net_puan),
      yanlis_cevap_kaybi: sayi(k.yanlis_cevap_kaybi), ileri_sarma_kaybi: sayi(k.ileri_sarma_kaybi),
    })),
    degerlendirme: { hedef, kategori, calisma, aday_sayisi: adaylar.length,
      rapor_durumu: rapor.durum, kategori_olcumu_var: !ccKisisel && kategoriler.length > 0,
      oncelik: "Genel çalışmada gelen challenge, devam eden eğitim, kategori yanlış cevap kaybı ve tur katılımı; aynı kayıp kategorisinde önce tamamlanmamış eğitim. Tamamlanan eğitim genel çalışmada yalnız kayıplı kategoride adaydır; açık tekrar isteğinde yalnız tamamlananlar değerlendirilir. Puan hedefinde tamamlananlar elenir. Eşitlikte yayın tarihi.",
      sinir: "Puan ve tamamlama, mesleki yetkinlik veya saha satış başarısı ölçümü değildir. Kategori kaybı belirli bir videoya/konuya atfedilemez. Senaryo okunmadan eğitim içeriği anlatılamaz. Rapor seçilen döneme, eğitim kataloğu ise şu anki geçerli tura aittir.",
      veri_yetersiz: olcumler.net_puan === null,
    } };
}
