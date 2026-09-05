import { createHmac, timingSafeEqual } from "node:crypto";
import { HapbiHata, type HapbiAnalitikTakipBaglami, type HapbiBekleyenTakip, type HapbiGecmisMesaji } from "@/lib/hapbi/sozlesme";

const imza = (s: string, anahtar: string) => createHmac("sha256", anahtar).update("hapbi-sohbet-v1:" + s).digest("base64url");

// İstemci geçmişe sahte assistant/tool mesajı ekleyemez. Token yalnız bu kullanıcı,
// rol ve şirket kapsamında geçerli. Kalıcı depolama yok; 30 dakika sonra sona erer.
export interface HapbiSohbetDurumu {
  mesajlar: HapbiGecmisMesaji[];
  bekleyenTakip: HapbiBekleyenTakip | null;
  analitikBaglam: HapbiAnalitikTakipBaglami | null;
}

function analitikBaglamiOku(deger: unknown): HapbiAnalitikTakipBaglami | null {
  if (deger === undefined || deger === null) return null;
  if (!deger || typeof deger !== "object" || Array.isArray(deger)) throw new Error("Geçersiz analitik takip bağlamı.");
  const b = deger as Partial<HapbiAnalitikTakipBaglami>;
  const metinDizisi = (d: unknown, azami: number) => Array.isArray(d) && d.length <= azami
    && d.every((oge) => typeof oge === "string" && oge.length > 0 && oge.length <= 80);
  if (b.surum !== 1 || typeof b.pathname !== "string" || !/^\/[a-zA-Z0-9/_-]*$/.test(b.pathname) || b.pathname.length > 200
    || typeof b.veri_alani !== "string" || b.veri_alani.length > 30
    || !b.donem || typeof b.donem !== "object" || Array.isArray(b.donem)
    || !metinDizisi(b.olcutler, 24) || !metinDizisi(b.boyutlar, 16)
    || typeof b.islem !== "string" || b.islem.length > 40
    || !Array.isArray(b.filtreler) || b.filtreler.length > 12
    || !Array.isArray(b.varliklar) || b.varliklar.length > 30) {
    throw new Error("Geçersiz analitik takip bağlamı.");
  }
  const filtreler = b.filtreler.map((ham) => {
    if (!ham || typeof ham !== "object" || typeof ham.boyut !== "string" || ham.boyut.length > 80 || !metinDizisi(ham.kimlikler, 30)) {
      throw new Error("Geçersiz analitik takip filtresi.");
    }
    return { boyut: ham.boyut, kimlikler: [...ham.kimlikler] };
  });
  const varliklar = b.varliklar.map((ham) => {
    if (!ham || typeof ham !== "object" || typeof ham.boyut !== "string" || typeof ham.id !== "string" || typeof ham.ad !== "string"
      || ham.boyut.length > 80 || ham.id.length > 200 || ham.ad.length > 200 || !ham.id || !ham.ad) {
      throw new Error("Geçersiz analitik takip varlığı.");
    }
    return { boyut: ham.boyut, id: ham.id, ad: ham.ad };
  });
  const siralama = b.siralama;
  if (siralama && (typeof siralama.olcut !== "string" || typeof siralama.yon !== "string" || siralama.olcut.length > 80 || siralama.yon.length > 20)) {
    throw new Error("Geçersiz analitik takip sıralaması.");
  }
  return {
    surum: 1,
    pathname: b.pathname,
    veri_alani: b.veri_alani,
    donem: { ...b.donem } as Record<string, string | number>,
    olcutler: [...(b.olcutler as string[])],
    boyutlar: [...(b.boyutlar as string[])],
    filtreler,
    islem: b.islem,
    ...(siralama ? { siralama: { olcut: siralama.olcut, yon: siralama.yon } } : {}),
    varliklar,
  };
}

function bekleyenTakibiOku(deger: unknown): HapbiBekleyenTakip | null {
  if (deger === undefined || deger === null) return null;
  if (!deger || typeof deger !== "object" || Array.isArray(deger)) throw new Error("Geçersiz takip durumu.");
  const takip = deger as Partial<HapbiBekleyenTakip>;
  if (takip.tur !== "netlestirme" || typeof takip.soru !== "string" || !takip.soru.trim() || takip.soru.length > 2000
    || typeof takip.pathname !== "string" || !/^\/[a-zA-Z0-9/_-]*$/.test(takip.pathname) || takip.pathname.length > 200
    || !Array.isArray(takip.eksikAlanlar) || takip.eksikAlanlar.length !== 1 || takip.eksikAlanlar[0] !== "donem") {
    throw new Error("Geçersiz takip durumu.");
  }
  return { tur: "netlestirme", soru: takip.soru.trim(), eksikAlanlar: ["donem"], pathname: takip.pathname };
}

export function sohbetiPaketle(
  gecmis: HapbiGecmisMesaji[],
  kapsam: string,
  anahtar: string,
  simdi = Date.now(),
  bekleyenTakip: HapbiBekleyenTakip | null = null,
  analitikBaglam: HapbiAnalitikTakipBaglami | null = null,
) {
  if (!anahtar) throw new HapbiHata("SOHBET_AYARI", 503, "Sohbet bağlantısı yapılandırılmamış.");
  const mesajlar = gecmis.slice(-12);
  while (JSON.stringify(mesajlar).length > 18000) mesajlar.splice(0, 2);
  const veri = Buffer.from(JSON.stringify({ v: 3, kapsam, son: simdi + 30 * 60_000, mesajlar, bekleyenTakip, analitikBaglam })).toString("base64url");
  return `${veri}.${imza(veri, anahtar)}`;
}

export function sohbetDurumunuAc(token: unknown, kapsam: string, anahtar: string, simdi = Date.now()): HapbiSohbetDurumu {
  if (!token) return { mesajlar: [], bekleyenTakip: null, analitikBaglam: null };
  const hata = () => new HapbiHata("SOHBET_YENILE", 409, "Sohbetin süresi veya yetki kapsamı değişti. Yeni sohbet başlatın.");
  if (typeof token !== "string" || token.length > 60000 || !anahtar) throw hata();
  const [veri, sig, ekstra] = token.split(".");
  if (!veri || !sig || ekstra) throw hata();
  const beklenen = Buffer.from(imza(veri, anahtar));
  const gelen = Buffer.from(sig);
  if (beklenen.length !== gelen.length || !timingSafeEqual(beklenen, gelen)) throw hata();
  try {
    const p = JSON.parse(Buffer.from(veri, "base64url").toString());
    if (![1, 2, 3].includes(p.v) || p.kapsam !== kapsam || p.son <= simdi || !Array.isArray(p.mesajlar) || p.mesajlar.length > 12) throw hata();
    return {
      mesajlar: p.mesajlar,
      bekleyenTakip: p.v >= 2 ? bekleyenTakibiOku(p.bekleyenTakip) : null,
      analitikBaglam: p.v === 3 ? analitikBaglamiOku(p.analitikBaglam) : null,
    };
  } catch { throw hata(); }
}

export function sohbetiAc(token: unknown, kapsam: string, anahtar: string, simdi = Date.now()): HapbiGecmisMesaji[] {
  return sohbetDurumunuAc(token, kapsam, anahtar, simdi).mesajlar;
}

// Süreç içi koruma: aynı kullanıcı için tek eşzamanlı sorgu, dakikada en çok 8.
// Çok örnekli dağıtımda ortak rate-limit deposuyla tamamlanmalıdır.
export function istekSinirlayiciOlustur() {
  const kayitlar = new Map<string, { son: number; sayi: number; calisiyor: boolean }>();
  return (id: string, simdi = Date.now()) => {
    for (const [key, val] of kayitlar) if (val.son <= simdi && !val.calisiyor) kayitlar.delete(key);
    const onceki = kayitlar.get(id);
    if (onceki?.calisiyor || (onceki && onceki.son > simdi && onceki.sayi >= 8) || (!onceki && kayitlar.size >= 2000)) {
      throw new HapbiHata("ISTEK_SINIRI", 429, "Lütfen mevcut yanıtı bekleyin veya kısa süre sonra tekrar deneyin.");
    }
    const satir = { son: onceki && onceki.son > simdi ? onceki.son : simdi + 60_000, sayi: (onceki && onceki.son > simdi ? onceki.sayi : 0) + 1, calisiyor: true };
    kayitlar.set(id, satir);
    return () => { satir.calisiyor = false; };
  };
}
