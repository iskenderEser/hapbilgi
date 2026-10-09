import type { SupabaseClient } from '@supabase/supabase-js';
import { getTmDavranis, getTmKarsilastirma } from '@/lib/rapor/tm/getTmDavranis';
import { TemsilciKapsamHatasi } from '@/lib/rapor/bm/getBmDavranis';

/** Yönetici takım seçimini oturum firmasına doğrular; rapor hesabı TM ile ortaktır. */
export async function getYoneticiDavranis(
  db: SupabaseClient, kullanici: { firma_id: string }, baslangic: string, bitis: string,
  takimId = '', bmId = '', temsilciId = '', ikinciBmId = '', yenile = false,
) {
  if (!kullanici.firma_id) throw new Error('Yönetici firma bilgisi eksik.');
  const takimlar: Array<{ id: string; ad: string }> = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from('takimlar').select('takim_id,takim_adi')
      .eq('firma_id', kullanici.firma_id).order('takim_id').range(offset, offset + 499);
    if (error || !Array.isArray(data)) throw new Error('Firma takımları alınamadı.', { cause: error });
    takimlar.push(...data.map(t => ({ id: String(t.takim_id), ad: String(t.takim_adi) })));
    if (data.length < 500) break;
  }
  takimlar.sort((a, b) => a.ad.localeCompare(b.ad, 'tr') || a.id.localeCompare(b.id));
  const seciliTakim = takimId ? takimlar.find(t => t.id === takimId) : takimlar[0];
  if ((takimId || bmId || temsilciId || ikinciBmId) && !seciliTakim) {
    throw new TemsilciKapsamHatasi('Bu takımın raporuna erişim yetkiniz yok.');
  }
  if (!seciliTakim) return {
    hucreler: [], katki: { netPuan: 0, bolge: null, takim: null, firma: null },
    baslangic, bitis, bmId: '', temsilciId: '', temsilciSayisi: 0, kisiBasiNetPuan: null,
    bmler: [], temsilciler: [], takimlar, takimId: '',
  };
  const kapsam = { firma_id: kullanici.firma_id, takim_id: seciliTakim.id };
  const rapor = ikinciBmId
    ? await getTmKarsilastirma(db, kapsam, baslangic, bitis, bmId, ikinciBmId, yenile)
    : await getTmDavranis(db, kapsam, baslangic, bitis, bmId, temsilciId, yenile);
  return { ...rapor, takimlar, takimId: seciliTakim.id };
}
