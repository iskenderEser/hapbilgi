import type { SupabaseClient } from '@supabase/supabase-js';
import { getDavranisGirdisi, type UttDavranisGirdisi } from '@/lib/rapor/utt/getUttDavranis';
import { bmDavranisiniHesapla, TemsilciKapsamHatasi } from '@/lib/rapor/bm/getBmDavranis';
import { netPuanSatirlari, netPuanToplami } from '@/lib/rapor/paylasilan/netPuanToplami';
import { katkiYuzdesi } from '@/lib/rapor/paylasilan/oran';
import { TUKETICI_ROLLER } from '@/lib/utils/roller';
import type { UttKatki } from '@/lib/rapor/utt/getUttKatki';

interface Kisi { kullanici_id: string; ad: string; soyad: string; rol: string; bolge_id: string | null }
interface Kapsam { firma_id: string; takim_id: string }
interface TakimKaydi { zaman: number; bitis: string; girdi: UttDavranisGirdisi; puanlar: Map<string, number>; firmaPuani: number }
const onbellek = new Map<string, TakimKaydi>();

export async function getTmKarsilastirma(db: SupabaseClient, kullanici: Kapsam, baslangic: string, bitis: string, ilkBmId: string, ikinciBmId: string, yenile = false) {
  if (!ilkBmId || !ikinciBmId || ilkBmId === ikinciBmId) throw new TemsilciKapsamHatasi('Karşılaştırmak için iki farklı bölge müdürü seçiniz.');
  const takim = await getTmDavranis(db, kullanici, baslangic, bitis, '', '', yenile);
  if (![ilkBmId, ikinciBmId].every(id => takim.bmler.some(k => k.kullanici_id === id))) throw new TemsilciKapsamHatasi('Bu bölge müdürünün raporuna erişim yetkiniz yok.');
  const [ilk, ikinci] = await Promise.all([
    getTmDavranis(db, kullanici, takim.baslangic, takim.bitis, ilkBmId),
    getTmDavranis(db, kullanici, takim.baslangic, takim.bitis, ikinciBmId),
  ]);
  return { ...ilk, karsilastirma: ikinci };
}

export function tmRaporKapsami(kisiler: Kisi[], bmId: string, temsilciId: string) {
  const bmler = kisiler.filter(k => k.rol === 'bm' && k.bolge_id);
  const uttler = kisiler.filter(k => TUKETICI_ROLLER.includes(k.rol));
  const bm = bmId ? bmler.find(k => k.kullanici_id === bmId) : null;
  if (bmId && !bm) throw new TemsilciKapsamHatasi('Bu bölge müdürünün raporuna erişim yetkiniz yok.');
  if (temsilciId && !bm) throw new TemsilciKapsamHatasi('Önce bölge müdürünü seçiniz.');
  const bolgeUttleri = bm ? uttler.filter(k => k.bolge_id === bm.bolge_id) : [];
  if (temsilciId && !bolgeUttleri.some(k => k.kullanici_id === temsilciId)) throw new TemsilciKapsamHatasi('Bu temsilcinin raporuna erişim yetkiniz yok.');
  return { bm, bmler, uttler, bolgeUttleri, seciliIds: temsilciId ? [temsilciId] : bm ? bolgeUttleri.map(k => k.kullanici_id) : uttler.map(k => k.kullanici_id) };
}

export async function getTmDavranis(db: SupabaseClient, kullanici: Kapsam, baslangic: string, bitis: string, bmId = '', temsilciId = '', yenile = false) {
  if (!kullanici.firma_id || !kullanici.takim_id) throw new Error('TM firma veya takım bilgisi eksik.');
  const kisiler: Kisi[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from('kullanicilar').select('kullanici_id,ad,soyad,rol,bolge_id')
      .eq('aktif_mi', true).eq('firma_id', kullanici.firma_id).eq('takim_id', kullanici.takim_id)
      .in('rol', [...TUKETICI_ROLLER, 'bm']).order('kullanici_id').range(offset, offset + 499);
    if (error || !Array.isArray(data)) throw new Error('Takım kullanıcıları alınamadı.', { cause: error });
    kisiler.push(...data);
    if (data.length < 500) break;
  }
  kisiler.sort((a, b) => `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, 'tr'));
  // Yetki, önbellek okumasından önce her istekte güncel takım üyeliğiyle doğrulanır.
  const kapsam = tmRaporKapsami(kisiler, bmId, temsilciId);
  const bolgeAdlari = new Map<string, string>();
  const bolgeIds = [...new Set(kapsam.bmler.map(k => k.bolge_id!))];
  for (let i = 0; i < bolgeIds.length; i += 100) {
    const { data, error } = await db.from('bolgeler').select('bolge_id,bolge_adi')
      .eq('takim_id', kullanici.takim_id).in('bolge_id', bolgeIds.slice(i, i + 100));
    if (error || !Array.isArray(data)) throw new Error('Bölge adları alınamadı.', { cause: error });
    for (const b of data) bolgeAdlari.set(b.bolge_id, b.bolge_adi);
  }
  const anahtar = JSON.stringify([kullanici.firma_id, kullanici.takim_id, baslangic, kisiler.map(k => [k.kullanici_id,k.rol,k.bolge_id])]);
  if (yenile) onbellek.delete(anahtar);
  let kayit = onbellek.get(anahtar);
  if (!kayit || Date.now() - kayit.zaman >= 30_000) {
    const [girdi, puanSatirlari, firmaPuani] = await Promise.all([
      getDavranisGirdisi(db, kapsam.uttler.map(k => k.kullanici_id), bitis),
      netPuanSatirlari(db, { p_firma_id: kullanici.firma_id, p_takim_id: kullanici.takim_id }, baslangic, bitis),
      netPuanToplami(db, { p_firma_id: kullanici.firma_id }, baslangic, bitis),
    ]);
    const puanlar = new Map(puanSatirlari.map(k => [k.kullanici_id, k.toplam_net_puan]));
    if (kapsam.uttler.some(k => !puanlar.has(k.kullanici_id))) throw new Error('Takım net puan kayıtları eksik.');
    bmDavranisiniHesapla(girdi, kapsam.uttler.map(k => k.kullanici_id), baslangic, bitis);
    kayit = { zaman: Date.now(), bitis, girdi, puanlar, firmaPuani };
    for (const [key, value] of onbellek) if (Date.now() - value.zaman >= 30_000) onbellek.delete(key);
    if (onbellek.size >= 10) onbellek.delete(onbellek.keys().next().value!);
    onbellek.set(anahtar, kayit);
  }
  const hazir = kayit;
  const toplam = (ids: string[]) => ids.reduce((s, id) => s + (hazir.puanlar.get(id) ?? 0), 0);
  const netPuan = toplam(kapsam.seciliIds);
  const katki = (toplam: number) => ({ toplam, yuzde: toplam > 0 ? katkiYuzdesi(netPuan, toplam) : null });
  const katkilar: UttKatki = {
    netPuan,
    bolge: kapsam.bm ? temsilciId ? katki(toplam(kapsam.bolgeUttleri.map(k => k.kullanici_id))) : { toplam: netPuan, yuzde: null } : null,
    takim: katki(toplam(kapsam.uttler.map(k => k.kullanici_id))),
    firma: katki(hazir.firmaPuani),
  };
  const adSoyad = (k: Kisi) => ({ kullanici_id: k.kullanici_id, ad: k.ad, soyad: k.soyad });
  return {
    hucreler: bmDavranisiniHesapla(hazir.girdi, kapsam.seciliIds, baslangic, hazir.bitis),
    katki: katkilar, baslangic, bitis: hazir.bitis, bmId, temsilciId,
    temsilciSayisi: kapsam.seciliIds.length,
    kisiBasiNetPuan: kapsam.seciliIds.length ? netPuan / kapsam.seciliIds.length : null,
    bmler: kapsam.bmler.map(k => ({ ...adSoyad(k), altBilgi: bolgeAdlari.get(k.bolge_id!) ?? '—' })), temsilciler: kapsam.bolgeUttleri.map(adSoyad),
  };
}
