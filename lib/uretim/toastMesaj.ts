// lib/uretim/toastMesaj.ts
//
// ÜRETİM HATTI TOAST SÖZLÜĞÜ — tek doğruluk kaynağı (İskender kararı 26.07).
//
// Neden: akış cümleleri beş dosyada satır içi string olarak yazılıydı
// ("Senaryo onaylandı.", "Revizyon talebi gönderildi."). Üç sonucu vardı:
// (1) aynı olay her sayfada başka dille anlatılıyordu, (2) hiçbir cümle talebin
// VARYANTINI bilmiyordu, (3) bir cümleyi sunucu (hazir-video ucu) üretiyordu —
// metin iki katmana bölünmüştü.
//
// KURAL — mesaj iki şey söyler: AZ ÖNCE KAPANAN İŞ + YENİ DOĞAN İŞ VE SAHİBİ.
// Cümlenin ikinci yarısı, hattaki bir sonraki aksiyonun ilanıdır; toast bir
// "yaptın bitti" bildirimi değil, sıranın kime geçtiğini söyleyen devir fişidir.
// Bunun üç doğal sonucu vardır ve üçü de aşağıda kodludur:
//   1. Aşama KAPATMAYAN aksiyonlarda birinci yarı yoktur (talep gönderme,
//      revizyon isteme) — ortada kapanan iş yok, yalnız doğan iş ilan edilir.
//   2. Sıradaki iş AYNI KİŞİDEYSE devir cümlesi yerine yönlendirme yazılır
//      ("yayın yönetimi sayfasına gidiniz").
//   3. Zincirin sonunda (yayına alma) mesaj YOKTUR — bu modül oraya hiç
//      çağrılmaz.
//
// Toast, aksiyonu YAPANA gösterilir; karşı taraf bildirimle öğrenir. Bu yüzden
// üretici ve İÜ metinleri ayrı kalıplardır: üretici "siz" formuyla konuşur, İÜ
// karşı tarafı gerçek unvanıyla anar ("Ürün Müdürü onayına ilettiniz") —
// "üretici"/"PM" kod dilidir, ekrana çıkmaz.
//
// Durum ROZETLERİ ayrı sözlüktedir (lib/utils/durum/mesaj.ts): o, bir işin
// içinde bulunduğu HALİ anlatır; bu, bir aksiyonun SONUCUNU. İki yüzey, iki
// sözlük — biri diğerinden türetilemez.

/** Talebin iki bağımsız anahtarından (hazir_video × hazir_soru_seti) doğan dört varyant. */
export type ToastVaryant = "normal" | "hazir_video" | "hazir_set" | "hazir_ikisi";

/** Üretim hattının üç aşaması. Senaryonun hazır varyantı yoktur; o hep İÜ üretir.
 *
 *  NEDEN durum/mesaj.ts'teki `Asama` ile BİRLEŞTİRİLMEDİ (26.07, Adım 7c):
 *  oradaki tip ekrana basılan ETİKETİN kendisidir ("Senaryo Yazmanız Bekleniyor"
 *  sözlüğünün anahtarı aynı zamanda görünen ad). Buradaki ise bir KOD — cümle
 *  parçaları (`Senaryoyu` / `senaryoyu` / `Senaryo`) ondan türetilir. İkisini
 *  birleştirmek, rozet sözlüğünün anahtarını kod'a çevirmeyi gerektirirdi; o
 *  sözlük ve tüketicileri bu işin kapsamı dışında. Aynı kavramın iki gösterimi
 *  bilinçli bırakıldı. */
export type ToastAsama = "senaryo" | "video" | "soru_seti";

export type ToastOlay =
  | { rol: "uretici"; olay: "talep_gonderildi" }
  | { rol: "uretici"; olay: "onay"; asama: ToastAsama; revize: boolean }
  | { rol: "uretici"; olay: "revizyon"; asama: ToastAsama }
  | { rol: "uretici"; olay: "iptal"; asama: ToastAsama }
  | { rol: "iu"; olay: "teslim"; asama: ToastAsama; revize: boolean };

export interface ToastBaglam {
  varyant: ToastVaryant;
  /** Talebi açanın unvanı — TalepBilgisi.uretici_rol_adi (ROL_ADLARI[rol]). */
  rolAdi?: string | null;
}

/** İki bayraktan varyant kodu. null/undefined = false. */
export function toastVaryant(
  hazirVideo?: boolean | null,
  hazirSoruSeti?: boolean | null,
): ToastVaryant {
  const video = hazirVideo === true;
  const set = hazirSoruSeti === true;
  if (video && set) return "hazir_ikisi";
  if (video) return "hazir_video";
  if (set) return "hazir_set";
  return "normal";
}

// Aşamanın iki adı. `belirtme` cümle başında ("Senaryoyu onayladınız"),
// `belirtmeKucuk` "Revize " ekinden sonra ("Revize senaryoyu onayladınız"),
// `talep` ise talep/iptal kalıplarında ("Senaryo için revizyon talebiniz…").
// Küçük harf türetme fonksiyonla yapılmaz: Türkçe'de "I/İ" tuzağı var, iki biçim
// de açıkça yazılır.
const ASAMA_AD: Record<ToastAsama, { belirtme: string; belirtmeKucuk: string; talep: string }> = {
  senaryo:   { belirtme: "Senaryoyu",   belirtmeKucuk: "senaryoyu",   talep: "Senaryo" },
  video:     { belirtme: "Videoyu",     belirtmeKucuk: "videoyu",     talep: "Video" },
  soru_seti: { belirtme: "Soru setini", belirtmeKucuk: "soru setini", talep: "Soru seti" },
};

// Talep gönderimi — yalnız varyanttan çözülür. Aşama kapatmadığı için tek
// yarılıdır: doğan işi ve sahibini söyler. Hazır videoda video zaten formdan
// Bunny'ye gitmiştir (zincir yükleme biter bitmez kurulur), o yüzden ilan edilen
// iş senaryo değil soru setidir. İkisi de hazırsa İÜ'ye iş düşmez; sıradaki
// aksiyon üreticinin kendisindedir → yönlendirme.
const TALEP_GONDERILDI: Record<ToastVaryant, string> = {
  normal:      "Senaryo talebiniz içerik üreticinize iletildi",
  hazir_set:   "Senaryo talebiniz içerik üreticinize iletildi",
  hazir_video: "Soru seti talebiniz içerik üreticinize iletildi",
  hazir_ikisi: "Yayın yönetimi sayfasına gidiniz",
};

const YAYIN_YONLENDIRME = "yayın yönetimi sayfasına gidiniz";

/**
 * Onay mesajının İKİNCİ yarısı: bu onayla hangi iş doğdu, kimde?
 * Senaryo onayı her varyantta videoyu İÜ'ye açar. Video onayı hazır soru seti
 * varsa İÜ'ye iş açmaz (set otomatik onaylı yazılır) — top üreticide kalır.
 * Soru seti onayı hattın sonudur; sırada yayına alma vardır, o da üreticide.
 */
function onayDevami(asama: ToastAsama, varyant: ToastVaryant): string {
  if (asama === "senaryo") return "içerik üreticinize video talebiniz iletildi";
  if (asama === "video") {
    return varyant === "hazir_set"
      ? YAYIN_YONLENDIRME
      : "soru seti talebiniz içerik üreticisine iletildi";
  }
  return YAYIN_YONLENDIRME;
}

/** "Senaryoyu" / "Revize senaryoyu" — revizyon turu cümlenin başında belli olur. */
function nesneAdi(asama: ToastAsama, revize: boolean): string {
  const ad = ASAMA_AD[asama];
  return revize ? `Revize ${ad.belirtmeKucuk}` : ad.belirtme;
}

/**
 * Bir aksiyonun toast metni. Çağıran sayfa metin bilmez; olayı, varyantı ve
 * (İÜ tarafında) talebi açanın unvanını verir.
 *
 * Nokta ile bitmez: cümleler onaylı tablodan birebir alınmıştır.
 */
export function uretimToast(olay: ToastOlay, baglam: ToastBaglam): string {
  if (olay.rol === "iu") {
    const nesne = nesneAdi(olay.asama, olay.revize);
    const rol = baglam.rolAdi?.trim();
    // Unvan ek ALMAZ: unvanlar hem ünlüyle ("Ürün Müdürü") hem ünsüzle
    // ("Medikal Müdür") bitiyor; "… onayına ilettiniz" kalıbı hepsinde doğru okunur.
    return rol ? `${nesne} ${rol} onayına ilettiniz` : `${nesne} onaya ilettiniz`;
  }

  switch (olay.olay) {
    case "talep_gonderildi":
      return TALEP_GONDERILDI[baglam.varyant];
    case "onay":
      return `${nesneAdi(olay.asama, olay.revize)} onayladınız, ${onayDevami(olay.asama, baglam.varyant)}`;
    case "revizyon":
      return `${ASAMA_AD[olay.asama].talep} için revizyon talebiniz içerik üreticisine iletildi`;
    case "iptal":
      return `${ASAMA_AD[olay.asama].talep} talebinizi iptal ettiniz`;
    default: {
      // Yeni olay eklenip burada karşılanmazsa tsc bu satırda patlar.
      const kapsanmayan: never = olay;
      return kapsanmayan;
    }
  }
}
