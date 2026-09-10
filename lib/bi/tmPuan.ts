import { TUKETICI_ROLLER } from '@/lib/utils/roller';
import type { SupabaseClient } from '@supabase/supabase-js';
import { puanBaglaminiOku, puanDonemi, type PuanSorgusu } from '@/lib/bi/puanSozlesmesi';
import { uttSatirPuani } from '@/lib/bi/uttPuan';
import { bmPuaniniOku } from '@/lib/bi/bmPuan';

type Kisi = { kullanici_id: string; ad: string; soyad: string; rol: string; bolge_id: string };
type Bolge = { bolge_id: string; bolge_adi: string };
const katla = (s: string) => s.toLocaleLowerCase('tr-TR').normalize('NFD')
  .replace(/\p{M}/gu, '').replace(/ı/g, 'i').replace(/\s+/g, ' ').trim();

export function tekHedef<T>(satirlar: T[], ad: string, isim: (s: T) => string): T {
  const aranan = katla(ad);
  const tam = satirlar.filter(s => katla(isim(s)) === aranan);
  const adaylar = tam.length ? tam : satirlar.filter(s => katla(isim(s)).split(' ').slice(0, aranan.split(' ').length).join(' ') === aranan);
  if (!adaylar.length) throw new Error('HEDEF_YOK');
  if (adaylar.length !== 1) throw new Error('HEDEF_BELIRSIZ');
  return adaylar[0];
}

// Hedef adları yetki kaynağı değildir; her istekte TM'nin kayıtlı takımından çözülür.
export async function tmKapsaminiCoz(db: SupabaseClient, id: string, s: PuanSorgusu) {
  if (!puanBaglaminiOku(s, 'tm') || !s.hedef) throw new Error('ROL_DESTEKLENMIYOR');
  const { data: tm, error } = await db.from('kullanicilar')
    .select('firma_id,takim_id').eq('kullanici_id', id).eq('rol', 'tm').eq('aktif_mi', true).maybeSingle();
  if (error || !tm?.firma_id || !tm.takim_id) throw new Error('KAPSAM_YOK');
  const { data: takim, error: takimHata } = await db.from('takimlar').select('takim_adi')
    .eq('takim_id', tm.takim_id).eq('firma_id', tm.firma_id).maybeSingle();
  if (takimHata || !takim) throw new Error('KAPSAM_YOK');
  const bolgeler: Bolge[] = [];
  const kisiler: Kisi[] = [];
  for (let offset = 0; ; offset += 500) {
    const r = await db.from('bolgeler').select('bolge_id,bolge_adi').eq('takim_id', tm.takim_id)
      .order('bolge_id').range(offset, offset + 499);
    if (r.error || !Array.isArray(r.data)) throw new Error('VERI_OKUNAMADI');
    bolgeler.push(...r.data);
    if (r.data.length < 500) break;
  }
  const bm = ['bm', 'bm_toplam'].includes(s.hedef.tur);
  for (let offset = 0; ; offset += 500) {
    const r = await db.from('kullanicilar').select('kullanici_id,ad,soyad,rol,bolge_id')
      .eq('firma_id', tm.firma_id).eq('takim_id', tm.takim_id).eq('aktif_mi', true)
      .in('rol', bm ? ['bm'] : TUKETICI_ROLLER).order('kullanici_id').range(offset, offset + 499);
    if (r.error || !Array.isArray(r.data)) throw new Error('VERI_OKUNAMADI');
    kisiler.push(...r.data);
    if (r.data.length < 500) break;
  }
  const bolgeIdleri = new Set(bolgeler.map(b => b.bolge_id));
  let secilen = kisiler.filter(k => bolgeIdleri.has(k.bolge_id));
  let etiket = bm ? takim.takim_adi + ' — BM kişisel puanları toplamı' : takim.takim_adi + ' — UTT toplamı';
  let bolgeId: string | undefined;
  if (s.hedef.tur === 'bolge') {
    const b = tekHedef(bolgeler, s.hedef.ad, b => b.bolge_adi);
    secilen = secilen.filter(k => k.bolge_id === b.bolge_id);
    etiket = b.bolge_adi + ' — UTT toplamı';
    bolgeId = b.bolge_id;
  } else if (s.hedef.tur === 'utt' || s.hedef.tur === 'bm') {
    const k = tekHedef(secilen, s.hedef.ad, k => k.ad + ' ' + k.soyad);
    secilen = [k];
    etiket = k.ad + ' ' + k.soyad + (bm ? ' — BM kişisel puanı' : '');
  } else if (s.hedef.ad && katla(s.hedef.ad) !== katla(takim.takim_adi)) {
    throw new Error('HEDEF_YOK');
  }
  return { kisiler: secilen, etiket, takimId: tm.takim_id, firmaId: tm.firma_id, bolgeId };
}

export async function tmKapsamPuaniniOku(db: SupabaseClient, kapsam: Awaited<ReturnType<typeof tmKapsaminiCoz>>,
  s: PuanSorgusu, simdi = new Date()) {
  const donem = puanDonemi(s, simdi);
  if (donem.bitis < donem.baslangic) throw new Error('KAYIT_YOK');
  if (!kapsam.kisiler.length) return { puan: 0, donem };

  const bm = ['bm', 'bm_toplam'].includes(s.hedef?.tur ?? '') || kapsam.kisiler[0].rol === 'bm';
  if (bm) {
    let puan = 0;
    // BM kişisel C-Club puanı UTT saha toplamına katılmaz; ortak get_bm_puan_ozet hesabını korur.
    for (let i = 0; i < kapsam.kisiler.length; i += 8) {
      const sonuclar = await Promise.all(kapsam.kisiler.slice(i, i + 8).map(k =>
        bmPuaniniOku(db, k.kullanici_id, k.rol, s, simdi)));
      puan += sonuclar.reduce((toplam, r) => toplam + r.puan, 0);
    }
    return { puan, donem };
  }

  // UTT için toplu sorgu: Tek tek dolaşmak yerine get_kullanici_ozet RPC'sine kapsam filtresi verilir.
  const rpcParams: Record<string, unknown> = {
    p_baslangic: donem.baslangic,
    p_bitis: donem.bitis,
  };

  if (s.hedef?.tur === 'utt' || (kapsam.kisiler.length === 1 && !kapsam.bolgeId && !kapsam.takimId)) {
    rpcParams.p_kullanici_id = kapsam.kisiler[0].kullanici_id;
  } else if (s.hedef?.tur === 'bolge' && kapsam.bolgeId) {
    rpcParams.p_bolge_id = kapsam.bolgeId;
  } else if (s.hedef?.tur === 'takim' && kapsam.takimId) {
    rpcParams.p_takim_id = kapsam.takimId;
  } else if (kapsam.takimId) {
    rpcParams.p_takim_id = kapsam.takimId;
  } else if (kapsam.kisiler.length === 1) {
    rpcParams.p_kullanici_id = kapsam.kisiler[0].kullanici_id;
  }

  const satirlar: Record<string, unknown>[] = [];
  const req = db.rpc('get_kullanici_ozet', rpcParams);
  if (req && typeof req.range === 'function') {
    for (let offset = 0; ; offset += 500) {
      const q = db.rpc('get_kullanici_ozet', rpcParams);
      const sirali = typeof q.order === 'function' ? q.order('kullanici_id') : q;
      const { data, error } = await sirali.range(offset, offset + 499);
      if (error) throw new Error('VERI_OKUNAMADI');
      if (!Array.isArray(data)) throw new Error('VERI_OKUNAMADI');
      satirlar.push(...(data as Record<string, unknown>[]));
      if (data.length < 500) break;
    }
  } else {
    const { data, error } = await req;
    if (error) throw new Error('VERI_OKUNAMADI');
    if (!Array.isArray(data)) throw new Error('VERI_OKUNAMADI');
    satirlar.push(...(data as Record<string, unknown>[]));
  }

  if (!satirlar.length) throw new Error('KAYIT_YOK');

  const satirHaritasi = new Map<string, Record<string, unknown>>();
  for (const satir of satirlar) {
    const kid = satir.kullanici_id;
    if (kid === null || kid === undefined || kid === '' || typeof kid !== 'string') {
      throw new Error('VERI_EKSIK');
    }
    satirHaritasi.set(kid, satir);
  }

  let puan = 0;
  for (const kisi of kapsam.kisiler) {
    const satir = satirHaritasi.get(kisi.kullanici_id);
    if (!satir) throw new Error('KAYIT_YOK');
    puan += uttSatirPuani(satir, s.olcut);
  }

  return { puan, donem };
}


