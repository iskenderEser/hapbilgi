import { createHmac, timingSafeEqual } from "node:crypto";
import { HapbiHata, type HapbiGecmisMesaji } from "@/lib/hapbi/sozlesme";

const imza = (s: string, anahtar: string) => createHmac("sha256", anahtar).update("hapbi-sohbet-v1:" + s).digest("base64url");

// İstemci geçmişe sahte assistant/tool mesajı ekleyemez. Token yalnız bu kullanıcı,
// rol ve şirket kapsamında geçerli. Kalıcı depolama yok; 30 dakika sonra sona erer.
export function sohbetiPaketle(gecmis: HapbiGecmisMesaji[], kapsam: string, anahtar: string, simdi = Date.now()) {
  if (!anahtar) throw new HapbiHata("SOHBET_AYARI", 503, "Sohbet bağlantısı yapılandırılmamış.");
  const mesajlar = gecmis.slice(-12);
  while (JSON.stringify(mesajlar).length > 18000) mesajlar.splice(0, 2);
  const veri = Buffer.from(JSON.stringify({ v: 1, kapsam, son: simdi + 30 * 60_000, mesajlar })).toString("base64url");
  return `${veri}.${imza(veri, anahtar)}`;
}

export function sohbetiAc(token: unknown, kapsam: string, anahtar: string, simdi = Date.now()): HapbiGecmisMesaji[] {
  if (!token) return [];
  const hata = () => new HapbiHata("SOHBET_YENILE", 409, "Sohbetin süresi veya yetki kapsamı değişti. Yeni sohbet başlatın.");
  if (typeof token !== "string" || token.length > 60000 || !anahtar) throw hata();
  const [veri, sig, ekstra] = token.split(".");
  if (!veri || !sig || ekstra) throw hata();
  const beklenen = Buffer.from(imza(veri, anahtar));
  const gelen = Buffer.from(sig);
  if (beklenen.length !== gelen.length || !timingSafeEqual(beklenen, gelen)) throw hata();
  try {
    const p = JSON.parse(Buffer.from(veri, "base64url").toString());
    if (p.v !== 1 || p.kapsam !== kapsam || p.son <= simdi || !Array.isArray(p.mesajlar) || p.mesajlar.length > 12) throw hata();
    return p.mesajlar;
  } catch { throw hata(); }
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
