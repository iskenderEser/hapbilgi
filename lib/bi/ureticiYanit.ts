import { yonlendirmeYaniti } from '@/lib/bi/yonlendirme';
import type { SupabaseClient } from '@supabase/supabase-js';
import { geminiUreticiSorusunuCoz } from '@/lib/bi/geminiUretici';
import { ureticiSayisiniOku } from '@/lib/bi/ureticiVeri';
import { URETICI_OLCUTLERI } from '@/lib/bi/ureticiSozlesmesi';
import { talepTuruAdi, ureticiYetenegi } from '@/lib/uretici/yetenekler';
import { ogrenmeAraciMetinleri } from '@/lib/ogrenmeAraci/etiketler';

export async function ureticiYanitiniHazirla(db: SupabaseClient, id: string, rol: string, soru: string, baglam: unknown, signal?: AbortSignal) {
  const cozum = await geminiUreticiSorusunuCoz(soru, rol, baglam, signal);
  if (cozum.durum !== 'bulundu') return { status: 200, veri: await yonlendirmeYaniti(db, id, rol, cozum.yon) };
  const s = cozum.sorgu;
  const simdi = new Date();
  try {
    const sonuc = await ureticiSayisiniOku(db, id, rol, s, simdi);
    const filtre = [s.egitim === 'tumu' ? ureticiYetenegi(rol)!.acabilecegiTalepTurleri.map(talepTuruAdi).join(' ve ') : talepTuruAdi(s.egitim),
      s.arac === 'tumu' ? null : ogrenmeAraciMetinleri(s.arac).ad].filter(Boolean).join(' · ');
    const tarih = (v: string) => new Date(v).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
    const satir = (r: typeof sonuc) => `${r.donem.etiket} — ${URETICI_OLCUTLERI[s.olcut]}: **${r.adet.toLocaleString('tr-TR')} adet**.` +
      (s.zaman === 'simdi' ? '' : `\n${tarih(r.donem.baslangic)} – ${tarih(r.donem.bitis)}`);
    let cevap = filtre + '\n\n' + satir(sonuc);
    if (s.olcut === 'yayinda_arac_turu') {
      const adlar = Object.entries(sonuc.aracDagilimi).filter(([, adet]) => adet > 0)
        .map(([tur]) => ogrenmeAraciMetinleri(tur as Exclude<typeof s.arac, 'tumu'>).ad);
      cevap = filtre + '\n\n' + (adlar.length
        ? `Şu anda yayında **${sonuc.adet} öğrenme aracı türünüz var: ${adlar.join(', ')}**.`
        : 'Şu anda yayında öğrenme aracı türünüz bulunmuyor.');
    } else if (s.olcut === 'yayin_arac_dagilimi') {
      const satirlar = Object.entries(sonuc.aracDagilimi).map(([tur, adet]) =>
        `${ogrenmeAraciMetinleri(tur as Exclude<typeof s.arac, 'tumu'>).ad}: **${adet.toLocaleString('tr-TR')} yayın**`);
      cevap = filtre + '\n\nŞu anda yayındaki yayınlarınızın dağılımı:\n' + satirlar.join('\n') + `\nToplam: **${sonuc.adet.toLocaleString('tr-TR')} yayın**.`;
    }
    if (s.karsilastir) {
      const onceki = await ureticiSayisiniOku(db, id, rol, { ...s, geriye: s.geriye + 1, karsilastir: false }, simdi);
      const fark = sonuc.adet - onceki.adet;
      cevap += `\n\n${satir(onceki)}\n\nFark: **${fark > 0 ? '+' : ''}${fark.toLocaleString('tr-TR')} adet**.`;
    }
    const url = ['yayinda','yayinda_arac_turu','yayin_arac_dagilimi','planlanan','durdurulan','yayina_alinan','yayin_bekleyen'].includes(s.olcut) ? '/yayin-yonetimi' : '/yayin-takip';
    return { status: 200, veri: { cevap, baglam: { ...s, karsilastir: false },
      kaynaklar: [{ id: 'uretici_sayim', baslik: URETICI_OLCUTLERI[s.olcut], url, zaman: simdi.toISOString(), donem: sonuc.donem.etiket }],
      kullanim: { yol: 'kac', olcut: s.olcut } } };
  } catch {
    return { status: 200, veri: await yonlendirmeYaniti(db, id, rol, cozum.yon ?? 'kendi_uretim') };
  }
}
