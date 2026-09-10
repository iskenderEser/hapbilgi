import type { SupabaseClient } from '@supabase/supabase-js';
import { yonLinkleri } from '@/lib/bi/sayfalar';
import { yonlendirmeMetni } from '@/lib/bi/cevapKatalogu';
export { yonLinkleri } from '@/lib/bi/sayfalar';
export { KAPSAM_DISI_MESAJ } from '@/lib/bi/cevapKatalogu';

export const YON_KONULARI = ['genel', 'platform_disi', 'tclub', 'tclub_ligi', 'cclub', 'cclub_ligi', 'eclub', 'eclub_ligi', 'kendi_uretim', 'firma_uretim', 'talepler', 'yayinlar'] as const;
export type YonKonusu = typeof YON_KONULARI[number];
export const YON_TALIMATI = `
Hazır yanıt paketi sınırlıdır; sayı sorgusu desteklenmese bile yönlendirme konusunu anlamından belirle.
yon: genel=HapBilgi konusu belirsiz; platform_disi=HapBilgi dışı sohbet/spor/tahmin;
tclub=saha/UTT/bölge/takım performansı ve ürün puanı; tclub_ligi=T-Club ligine ulaşma veya sıralama;
cclub=BM kişisel puan/challenge işleri; cclub_ligi=C-Club sıralama veya ligine ulaşma;
eclub=eczane/E-Club performansı; eclub_ligi=E-Club sıralama veya ligine ulaşma;
kendi_uretim=kendi üretim özeti; firma_uretim=firma içerik üretimi ve etkisi;
talepler=talep/onay/revizyon işlerine ulaşma; yayinlar=yayın yönetimi/durumları.
BM'nin kişisel puanı cclub, bölgesindeki UTT puanı tclub. İK saha sorusu tclub, üretim sorusu kendi_uretim/firma_uretim.
Soru KAÇ olmasa da (nasıl ulaşırım, göremiyorum, detay istiyorum) uygun yon seç. Bir kavramın tanım sorusunu sırf üretimle ilgili diye üretim raporuna yönlendirme. Gerçekten karşılığı olmayan veya belirsiz konuda genel seç; genel için bağlantı önerilmez. URL veya cevap üretme.`;
export function yonKonusunuOku(v: unknown): YonKonusu {
  return YON_KONULARI.includes(v as YonKonusu) ? v as YonKonusu : 'genel';
}
export async function yonlendirmeYaniti(db: SupabaseClient, id: string, rol: string, konu: YonKonusu = 'genel') {
  let cc = false, eclub = false;
  if (['cclub', 'cclub_ligi', 'eclub', 'eclub_ligi'].includes(konu)) {
    try {
      const kisi = await db.from('kullanicilar').select('firma_id').eq('kullanici_id', id).maybeSingle();
      if (!kisi.error && kisi.data?.firma_id) {
        const firma = await db.from('firmalar').select('aktif, cc_aktif, eclub_aktif').eq('firma_id', kisi.data.firma_id).maybeSingle();
        cc = !firma.error && firma.data?.aktif === true && firma.data?.cc_aktif === true;
        eclub = !firma.error && firma.data?.aktif === true && firma.data?.eclub_aktif === true;
      }
    } catch { /* Doğrulanamayan modül için bağlantı önerilmez. */ }
  }
  const yonlendirmeler = yonLinkleri(rol, konu, cc, eclub);
  const cevap = yonlendirmeMetni(yonlendirmeler.map(l => l.etiket));
  return { cevap, yonlendirmeler, kaynaklar: [], kullanim: { yol: 'yonlendirme', konu } };
}
