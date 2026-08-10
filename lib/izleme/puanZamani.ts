import "server-only";

import { puanKazanilabilirMi } from "@/lib/zaman/kontrol";

/**
 * Yerel UTT izleme varyasyonlarını çalışma saatinden bağımsız sınamak için
 * geçici geliştirme bypass'ı. Production'da gerçek zaman kuralı daima geçerlidir.
 *
 * Testler tamamlandığında bu dosya kaldırılıp iki izleme route'u yeniden
 * `puanKazanilabilirMi` kullanmalıdır.
 */
export function izlemePuanZamaniAktifMi(tarih: Date): boolean {
  if (process.env.NODE_ENV === "development") return true;
  return puanKazanilabilirMi(tarih);
}
