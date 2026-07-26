// lib/video/enBoyOrani.ts
//
// VİDEO EN-BOY ORANI — tek hesap yeri (26.07).
//
// Neden: sistemde sekiz oynatıcı yüzeyi var ve hepsi videoyu sabit yükseklikli
// bir kutuya sokuyordu (height="400" | "450" | "360" | "320"). Dikey video
// kaybolmuyordu ama yatay kutunun ortasında avuç içi kadar kalıyordu. Oranı
// hesaplayan mantık sekiz yere dağılmasın diye kural burada durur; ekranlar
// ölçüyü verir, oranı alır.
//
// TASARIM KARARI — HAM ÖLÇÜ, YÖN DEĞİL:
// "portrait/landscape" gibi bir yön alanı tutmak cazip ama yetersizdir: elde
// sayı olmayınca aspect-ratio kurulamaz, zorunlu olarak 9:16 varsayılır ve 3:4
// ya da 4:5 çekilmiş bir dikey video yine bantlanır. Bu yüzden hesap ham
// genişlik/yükseklikten yapılır; yön ondan TÜRETİLİR, tersi değil.
//
// YEDEK ZİNCİRİ: eksik, sıfır, negatif ya da sonsuz her girdi 16/9'a düşer.
// Sistemdeki mevcut videoların tamamı yataydır ve ölçüleri bilinmemektedir;
// yedek, onların bugünkü görünümünü birebir korur.

/** Ölçü bilinmediğinde kullanılan oran — bugünkü tüm yüzeylerin davranışı. */
export const VARSAYILAN_ORAN = 16 / 9;

/**
 * Kare ile dikey arasındaki sınır. Tam 1.0 yerine hafif pay bırakılır:
 * encode sonrası 1080×1082 gibi bir piksel sapması videoyu dikey saydırıp
 * gereksiz yere yükseklik tavanına sokmasın.
 */
export const DIKEY_ESIGI = 0.98;

/**
 * Genişlik/yükseklikten en-boy oranı.
 *
 * Sıfır kontrolü şart: `genislik / 0` → Infinity → `aspectRatio: Infinity` →
 * kutu sıfır yükseklikte çizilir ve video görünmez olur. Sessiz, teşhisi zor
 * bir arıza; girdi güvenilmez olduğu için burada kapatılır.
 */
export function enBoyOrani(genislik?: number | null, yukseklik?: number | null): number {
  if (typeof genislik !== "number" || typeof yukseklik !== "number") return VARSAYILAN_ORAN;
  if (!Number.isFinite(genislik) || !Number.isFinite(yukseklik)) return VARSAYILAN_ORAN;
  if (genislik <= 0 || yukseklik <= 0) return VARSAYILAN_ORAN;
  return genislik / yukseklik;
}

/**
 * Bu oran dikey mi? Yalnız dikey videoda yükseklik tavanı ve ortalama uygulanır;
 * yatay ve kare video bugünkü tam genişlik davranışını korur.
 */
export function dikeyMi(oran: number): boolean {
  return oran < DIKEY_ESIGI;
}
