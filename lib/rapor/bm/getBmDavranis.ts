import type { SupabaseClient } from '@supabase/supabase-js';
import { getDavranisGirdisi, uttDavranisiniHesapla, type UttDavranisGirdisi } from '@/lib/rapor/utt/getUttDavranis';
import { netPuanToplami } from '@/lib/rapor/paylasilan/netPuanToplami';
import { katkiYuzdesi } from '@/lib/rapor/paylasilan/oran';
import { TUKETICI_ROLLER } from '@/lib/utils/roller';
import type { UttKatki } from '@/lib/rapor/utt/getUttKatki';
import { getUttKatki } from '@/lib/rapor/utt/getUttKatki';
import { getUttDavranis } from '@/lib/rapor/utt/getUttDavranis';

interface BmKapsami { bolge_id: string; firma_id: string; takim_id: string | null }

/** Oturum ve yayın sayımları UTT bazında korunur; farklı üyeler bölge içinde tekilleştirilir. */
export function bmDavranisiniHesapla(g: UttDavranisGirdisi, kullaniciIds: string[], baslangic: string, bitis: string) {
  const hucreler = uttDavranisiniHesapla({ izlemeler: [], kazanclar: [], cevaplar: [], ileri: [], oneriler: [], oneriKayiplari: [], eclubOneriler: [], eclubIzlemeler: [], eclubKazanclar: [], yayinlar: [], turler: [] }, baslangic, bitis);
  const indeks = new Map(hucreler.map(h => [`${h.kategori}:${h.arac}`, h]));
  for (const id of new Set(kullaniciIds)) {
    const eclubOneriler = g.eclubOneriler.filter(k => k.oneren_id === id);
    const oneriIds = new Set(eclubOneriler.map(o => o.oneri_id));
    const kisisel: UttDavranisGirdisi = {
      yayinlar: g.yayinlar, turler: g.turler,
      izlemeler: g.izlemeler.filter(k => k.kullanici_id === id),
      kazanclar: g.kazanclar.filter(k => k.kullanici_id === id),
      cevaplar: g.cevaplar.filter(k => k.kullanici_id === id),
      ileri: g.ileri.filter(k => k.kullanici_id === id),
      oneriler: g.oneriler.filter(k => k.kullanici_id === id),
      oneriKayiplari: g.oneriKayiplari.filter(k => k.kullanici_id === id),
      yanlisKayiplari: g.yanlisKayiplari?.filter(k => k.kullanici_id === id),
      eclubOneriler, eclubIzlemeler: g.eclubIzlemeler.filter(k => oneriIds.has(k.oneri_id)),
      eclubKazanclar: g.eclubKazanclar.filter(k => k.utt_id === id),
    };
    for (const h of uttDavranisiniHesapla(kisisel, baslangic, bitis)) {
      const hedef = indeks.get(`${h.kategori}:${h.arac}`)!;
      for (const [key, value] of Object.entries(h.degerler)) {
        if (key !== 'eclub_uye') hedef.degerler[key] = (hedef.degerler[key] ?? 0) + value;
      }
    }
  }
  const sahipler = new Set(kullaniciIds);
  const yayinlar = new Map(g.yayinlar.map(y => [y.yayin_id, y]));
  const uyeler = new Map<string, Set<string>>();
  for (const o of g.eclubOneriler) {
    const zaman = Date.parse(o.created_at ?? '');
    if (!sahipler.has(o.oneren_id ?? '') || !o.kisi_id || !(zaman >= Date.parse(baslangic) && zaman <= Date.parse(bitis))) continue;
    const y = yayinlar.get(o.yayin_id!);
    if (!y) throw new Error('E-Club önerisinin yayını bulunamadı.');
    for (const arac of [y.arac_turu, 'tumu']) {
      const key = `${y.icerik_turu}:${arac}`;
      const set = uyeler.get(key) ?? new Set<string>();
      set.add(o.kisi_id); uyeler.set(key, set);
    }
  }
  for (const [key, h] of indeks) h.degerler.eclub_uye = uyeler.get(key)?.size ?? 0;
  return hucreler;
}

export class TemsilciKapsamHatasi extends Error {}

const bolgeOnbellegi = new Map<string, { zaman: number; bitis: string; girdi: UttDavranisGirdisi; katki: UttKatki }>();

export async function getBmKarsilastirma(db: SupabaseClient, kullanici: BmKapsami, baslangic: string, bitis: string, ilkId: string, ikinciId: string, yenile = false) {
  if (!ilkId || !ikinciId || ilkId === ikinciId) throw new TemsilciKapsamHatasi('Karşılaştırmak için iki farklı temsilci seçiniz.');
  const bolge = await getBmDavranis(db, kullanici, baslangic, bitis, '', yenile);
  if (![ilkId, ikinciId].every(id => bolge.temsilciler.some(k => k.kullanici_id === id))) throw new TemsilciKapsamHatasi('Bu temsilcinin raporuna erişim yetkiniz yok.');
  const [ilk, ikinci] = await Promise.all([
    getBmDavranis(db, kullanici, bolge.baslangic, bolge.bitis, ilkId),
    getBmDavranis(db, kullanici, bolge.baslangic, bolge.bitis, ikinciId),
  ]);
  return { ...ilk, karsilastirma: ikinci };
}

export async function getBmDavranis(db: SupabaseClient, kullanici: BmKapsami, baslangic: string, bitis: string, temsilciId = '', yenile = false) {
  if (!kullanici.bolge_id || !kullanici.firma_id) throw new Error('BM bölge veya firma bilgisi eksik.');
  const temsilciler: Array<{ kullanici_id: string; ad: string; soyad: string }> = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from('kullanicilar').select('kullanici_id,ad,soyad')
      .eq('aktif_mi', true).eq('firma_id', kullanici.firma_id).eq('bolge_id', kullanici.bolge_id)
      .in('rol', TUKETICI_ROLLER).order('kullanici_id').range(offset, offset + 499);
    if (error || !Array.isArray(data)) throw new Error('Bölge temsilcileri alınamadı.', { cause: error });
    temsilciler.push(...data);
    if (data.length < 500) break;
  }
  temsilciler.sort((a, b) => `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, 'tr'));
  const ids = temsilciler.map(k => k.kullanici_id);
  // Üyelik her istekte yeniden doğrulanır; önbellek yalnız bu kapsamın kayıtlarını taşır.
  const anahtar = JSON.stringify([kullanici.firma_id, kullanici.bolge_id, kullanici.takim_id, baslangic, ids]);
  if (yenile) bolgeOnbellegi.delete(anahtar);
  const kayit = bolgeOnbellegi.get(anahtar);
  const hazir = kayit && Date.now() - kayit.zaman < 30_000 ? kayit : null;
  if (temsilciId) {
    if (!ids.includes(temsilciId)) throw new TemsilciKapsamHatasi('Bu temsilcinin raporuna erişim yetkiniz yok.');
    if (hazir) {
      const netPuan = await netPuanToplami(db, { p_kullanici_id: temsilciId, p_firma_id: kullanici.firma_id, p_bolge_id: kullanici.bolge_id }, baslangic, hazir.bitis);
      const oran = (toplam: number | null) => toplam === null ? null : { toplam, yuzde: toplam > 0 ? katkiYuzdesi(netPuan, toplam) : null };
      return {
        hucreler: bmDavranisiniHesapla(hazir.girdi, [temsilciId], baslangic, hazir.bitis),
        katki: { netPuan, bolge: oran(hazir.katki.netPuan), takim: oran(hazir.katki.takim?.toplam ?? null), firma: oran(hazir.katki.firma?.toplam ?? null) },
        temsilciler, temsilciId, baslangic, bitis: hazir.bitis,
      };
    }
    const [davranis, katki] = await Promise.all([
      getUttDavranis(db, temsilciId, baslangic, bitis),
      getUttKatki(db, { ...kullanici, kullanici_id: temsilciId }, baslangic, bitis),
    ]);
    return { ...davranis, katki, temsilciler, temsilciId };
  }
  if (hazir) return { hucreler: bmDavranisiniHesapla(hazir.girdi, ids, baslangic, hazir.bitis), katki: hazir.katki, baslangic, bitis: hazir.bitis, temsilciler, temsilciId: '' };
  const katkiOku = async (): Promise<UttKatki> => {
    const [netPuan, takim, firma] = await Promise.all([
      netPuanToplami(db, { p_bolge_id: kullanici.bolge_id, p_firma_id: kullanici.firma_id }, baslangic, bitis),
      kullanici.takim_id ? netPuanToplami(db, { p_takim_id: kullanici.takim_id, p_firma_id: kullanici.firma_id }, baslangic, bitis) : null,
      netPuanToplami(db, { p_firma_id: kullanici.firma_id }, baslangic, bitis),
    ]);
    const katki = (toplam: number | null) => toplam === null ? null : { toplam, yuzde: toplam > 0 ? katkiYuzdesi(netPuan, toplam) : null };
    return { netPuan, bolge: { toplam: netPuan, yuzde: null }, takim: katki(takim), firma: katki(firma) };
  };
  const [girdi, katki] = await Promise.all([getDavranisGirdisi(db, ids, bitis), katkiOku()]);
  // Önce doğrula; hatalı veya eksik rapor önbelleğe alınmaz.
  const hucreler = bmDavranisiniHesapla(girdi, ids, baslangic, bitis);
  for (const [key, value] of bolgeOnbellegi) if (Date.now() - value.zaman >= 30_000) bolgeOnbellegi.delete(key);
  if (bolgeOnbellegi.size >= 20) bolgeOnbellegi.delete(bolgeOnbellegi.keys().next().value!);
  bolgeOnbellegi.set(anahtar, { zaman: Date.now(), bitis, girdi, katki });
  return { hucreler, katki, baslangic, bitis, temsilciler, temsilciId: '' };
}
