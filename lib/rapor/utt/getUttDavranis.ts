import type { SupabaseClient } from '@supabase/supabase-js';
import { ayBaslangici } from '@/lib/zaman/kontrol';
import { TUR_SIRA, isIcerikTuru, type IcerikTuru } from '@/lib/video/icerikTuru';
import type { OgrenmeAraciTuru } from '@/lib/ogrenmeAraci/tipler';

export const DAVRANIS_ARACLARI: OgrenmeAraciTuru[] = ['video', 'podcast', 'gorsel', 'flip_pdf'];
type Kayit = {
  kullanici_id?: string; oneren_id?: string; utt_id?: string;
  yayin_id?: string; izleme_id?: string; oneri_id?: string; kisi_id?: string;
  created_at?: string; izleme_baslangic?: string; izleme_bitis?: string;
  tamamlandi_mi?: boolean; gercek_oynatma_mi?: boolean; izleme_turu?: string;
  soru_index?: number; soru_hakki_var_mi?: boolean; soru_indeksleri?: number[]; dogru_mu?: boolean;
  oneri_baslangic?: string; oneri_bitis?: string; puan_turu?: string; puan?: number;
  kaybedilen_puan?: number; atlanan_sure?: number; video_suresi_saniye?: number;
};
export interface DavranisHucre {
  kategori: IcerikTuru; arac: OgrenmeAraciTuru | 'tumu'; degerler: Record<string, number>;
}
export interface UttDavranisGirdisi {
  izlemeler: Kayit[]; kazanclar: Kayit[]; cevaplar: Kayit[]; ileri: Kayit[];
  oneriler: Kayit[]; oneriKayiplari: Kayit[];
  eclubOneriler: Kayit[]; eclubIzlemeler: Kayit[]; eclubKazanclar: Kayit[];
  yayinlar: Array<{ yayin_id: string; icerik_turu: unknown; arac_turu: unknown }>;
  turler: Array<{ yayin_id: string; baslangic_tarihi: string }>;
  yanlisKayiplari?: Kayit[];
}

/** Olaylar dönem içinde; öneri durumları dönem içinde gönderilen kohorta aittir.
 * Extra aşaması ay × güncel tur kesişimidir. Kart puanları ilgili kazanç ve kayıp kayıtlarından toplanır. */
export function uttDavranisiniHesapla(g: UttDavranisGirdisi, baslangic: string, bitis: string): DavranisHucre[] {
  const bas = Date.parse(baslangic), bit = Date.parse(bitis);
  const donemde = (t?: string) => !!t && Date.parse(t) >= bas && Date.parse(t) <= bit;
  const hucreler = TUR_SIRA.flatMap(kategori => DAVRANIS_ARACLARI.map(arac => ({ kategori, arac, degerler: {} as Record<string, number> })));
  const yayinlar = new Map(g.yayinlar.map(y => [y.yayin_id, y]));
  const hedef = (id?: string) => {
    const y = id ? yayinlar.get(id) : undefined;
    if (!y || !isIcerikTuru(y.icerik_turu) || !DAVRANIS_ARACLARI.includes(y.arac_turu as OgrenmeAraciTuru)) {
      throw new Error('Davranış kaydının eğitim kategorisi veya öğrenme aracı çözümlenemedi.');
    }
    return hucreler.find(h => h.kategori === y.icerik_turu && h.arac === y.arac_turu)!.degerler;
  };
  const ekle = (id: string | undefined, anahtar: string, sayi = 1) => {
    const d = hedef(id); d[anahtar] = (d[anahtar] ?? 0) + sayi;
  };
  const izlemeler = new Map(g.izlemeler.map(i => [i.izleme_id, i]));
  const sarilanlar = new Set(g.ileri.map(i => i.izleme_id));
  const tarihliTamam = (i: Kayit) => i.tamamlandi_mi && !!i.izleme_bitis && Date.parse(i.izleme_bitis) <= bit;
  const yanitlanan = new Map<string | undefined, Set<number>>();
  for (const c of g.cevaplar) {
    const indices = yanitlanan.get(c.izleme_id) ?? new Set<number>();
    // Her cevap satırı tek sorudur; şemadaki tekillik (izleme_id, soru_index).
    if (c.soru_index == null) throw new Error('Cevabın soru indeksi bulunamadı.');
    if (indices.has(c.soru_index)) continue;
    indices.add(c.soru_index); yanitlanan.set(c.izleme_id, indices);
    if (donemde(c.created_at)) {
      const i = izlemeler.get(c.izleme_id);
      if (!i) throw new Error('Cevabın öğrenme oturumu bulunamadı.');
      ekle(i.yayin_id, 'cevaplanan');
      ekle(i.yayin_id, c.dogru_mu ? 'dogru' : 'yanlis');
    }
  }
  const extraTamamlananYayinlar = new Set<string>();
  for (const i of g.izlemeler) {
    if (!i.gercek_oynatma_mi) continue;
    if (donemde(i.izleme_baslangic)) {
      ekle(i.yayin_id, 'baslayan');
      if (!tarihliTamam(i)) ekle(i.yayin_id, 'yarim');
    }
    if (tarihliTamam(i) && donemde(i.izleme_bitis)) {
      ekle(i.yayin_id, 'tamamlanan');
      if (i.izleme_turu === 'extra' && i.yayin_id) extraTamamlananYayinlar.add(i.yayin_id);
      if (i.soru_hakki_var_mi) {
        const eksik = (i.soru_indeksleri ?? []).filter(index => !yanitlanan.get(i.izleme_id)?.has(index)).length;
        ekle(i.yayin_id, 'cevapsiz_soru', eksik);
      }
    }
  }
  for (const yayinId of extraTamamlananYayinlar) ekle(yayinId, 'extra_tamamlanan_yayin');
  const extraPuanKazandiranYayinlar = new Set<string>();
  const puanAlanlari: Record<string, string> = {
    izleme: 'tamamlama_puani', cevaplama: 'cevaplama_puani', oneri: 'oneri_puani', extra: 'extra_puani',
  };
  for (const k of g.kazanclar.filter(k => donemde(k.created_at))) {
    const puanAlani = puanAlanlari[k.puan_turu ?? ''];
    if (puanAlani) {
      const puan = Number(k.puan);
      if (!Number.isFinite(puan)) throw new Error('Kazanılan puan okunamadı.');
      ekle(k.yayin_id, puanAlani, puan);
    }
    if (k.puan_turu === 'izleme') {
      ekle(k.yayin_id, 'ilk_tamamlama'); ekle(k.yayin_id, `tamamlama_agirlik_${k.puan}`);
    } else if (k.puan_turu === 'cevaplama') ekle(k.yayin_id, `dogru_agirlik_${k.puan}`);
    else if (k.puan_turu === 'extra' && k.yayin_id) extraPuanKazandiranYayinlar.add(k.yayin_id);
  }
  for (const yayinId of extraPuanKazandiranYayinlar) ekle(yayinId, 'extra_puan_kazandiran_yayin');
  const kayipPuaniEkle = (k: Kayit, alan: string) => {
    const puan = Number(k.kaybedilen_puan);
    if (!Number.isFinite(puan)) throw new Error('Kaybedilen puan okunamadı.');
    ekle(k.yayin_id, alan, puan);
  };
  const atlananOturumlar = new Set<string>();
  for (const k of g.ileri.filter(k => donemde(k.created_at))) {
    kayipPuaniEkle(k, 'ileri_sarma_kaybi');
    ekle(k.yayin_id, 'atlama'); ekle(k.yayin_id, 'atlanan_saniye', Number(k.atlanan_sure ?? 0));
    if (k.izleme_id && !atlananOturumlar.has(k.izleme_id)) {
      atlananOturumlar.add(k.izleme_id); ekle(k.yayin_id, 'sarilan_oturum');
      const sure = Number(izlemeler.get(k.izleme_id)?.video_suresi_saniye ?? 0);
      if (sure > 0) ekle(k.yayin_id, 'sarilan_arac_saniye', sure);
      else ekle(k.yayin_id, 'suresi_bilinmeyen_oturum');
    }
  }
  for (const k of (g.yanlisKayiplari ?? []).filter(k => donemde(k.created_at))) {
    kayipPuaniEkle(k, 'yanlis_cevap_kaybi');
    ekle(k.yayin_id, `yanlis_agirlik_${k.kaybedilen_puan}`);
  }
  for (const k of g.oneriKayiplari.filter(k => donemde(k.created_at))) {
    kayipPuaniEkle(k, 'oneri_kaybi');
    ekle(k.yayin_id, 'oneri_ceza');
  }
  const cohort = (oneriler: Kayit[], oturumlar: Kayit[], prefix: string) => {
    for (const o of oneriler.filter(o => donemde(o.created_at))) {
      ekle(o.yayin_id, `${prefix}_gelen`);
      const tamam = oturumlar.filter(i => i.oneri_id === o.oneri_id && tarihliTamam(i));
      const zamaninda = tamam.some(i => {
        // BM önerisinde başlangıç, E-Club önerisinde bitiş zamanı esas alınır.
        const zaman = Date.parse(prefix === 'oneri' ? i.izleme_baslangic! : i.izleme_bitis!);
        return zaman >= Date.parse(o.oneri_baslangic!) && zaman <= Date.parse(o.oneri_bitis!);
      });
      if (zamaninda) ekle(o.yayin_id, `${prefix}_zamaninda`);
      else if (tamam.length) ekle(o.yayin_id, `${prefix}_gec`);
      else if (Date.parse(o.oneri_bitis!) < bit) ekle(o.yayin_id, `${prefix}_doldu`);
      else ekle(o.yayin_id, `${prefix}_bekleyen`);
      if (prefix === 'oneri' && tamam.some(i => sarilanlar.has(i.izleme_id))) ekle(o.yayin_id, 'oneri_sarilan');
    }
  };
  cohort(g.oneriler, g.izlemeler, 'oneri');
  cohort(g.eclubOneriler, g.eclubIzlemeler, 'eclub');
  const uyeSetleri = new Map<Record<string, number>, Set<string>>();
  for (const o of g.eclubOneriler.filter(o => donemde(o.created_at))) {
    const d = hedef(o.yayin_id), uyeler = uyeSetleri.get(d) ?? new Set<string>();
    if (o.kisi_id) uyeler.add(o.kisi_id);
    uyeSetleri.set(d, uyeler); d.eclub_uye = uyeler.size;
  }
  for (const k of g.eclubKazanclar.filter(k => donemde(k.created_at))) ekle(k.yayin_id, 'eclub_kazanim');
  const turler = new Map<string, number>();
  for (const t of g.turler) turler.set(t.yayin_id, Math.max(turler.get(t.yayin_id) ?? 0, Date.parse(t.baslangic_tarihi)));
  const tekrarlar = new Map<string, number>();
  for (const i of g.izlemeler) {
    const alt = Math.max(ayBaslangici(new Date(bitis)).getTime(), turler.get(i.yayin_id!) ?? 0);
    if (i.izleme_turu === 'extra' && tarihliTamam(i) && Date.parse(i.izleme_baslangic!) >= alt) tekrarlar.set(i.yayin_id!, (tekrarlar.get(i.yayin_id!) ?? 0) + 1);
  }
  for (const [yayin, sayi] of tekrarlar) {
    // Güncel Extra döngüsündeki aşama; seçili zamanda tekrar tamamlanan yayınlar.
    if (extraTamamlananYayinlar.has(yayin) && (sayi === 1 || sayi === 2)) ekle(yayin, `tekrar_asama_${sayi}`);
  }
  const toplamlar: DavranisHucre[] = TUR_SIRA.map(kategori => {
    const degerler: Record<string, number> = {};
    const uyeler = new Set<string>();
    for (const h of hucreler.filter(h => h.kategori === kategori)) {
      for (const [k, v] of Object.entries(h.degerler)) degerler[k] = (degerler[k] ?? 0) + v;
      for (const uye of uyeSetleri.get(h.degerler) ?? []) uyeler.add(uye);
    }
    degerler.eclub_uye = uyeler.size;
    return { kategori, arac: 'tumu', degerler };
  });
  return [...hucreler, ...toplamlar];
}

export async function getDavranisGirdisi(db: SupabaseClient, kullaniciId: string | string[], bitis: string): Promise<UttDavranisGirdisi> {
  // Sahiplik her kaynakta zorunlu; sayfalama Supabase'in 1000 satır sınırını aşar.
  const oku = async (tablo: string, kolonlar: string, sahipKolon: string, pk: string) => {
    const sonuc: Kayit[] = [];
    const gruplar = typeof kullaniciId === 'string' ? [kullaniciId] : Array.from({ length: Math.ceil(kullaniciId.length / 100) }, (_, i) => kullaniciId.slice(i * 100, i * 100 + 100));
    for (const grup of gruplar) {
    for (let offset = 0; ; offset += 500) {
      const sorgu = db.from(tablo).select(`${sahipKolon},${kolonlar}`);
      const sahipli = typeof grup === 'string' ? sorgu.eq(sahipKolon, grup) : sorgu.in(sahipKolon, grup);
      const { data, error } = await sahipli.lte('created_at', bitis).order(pk).range(offset, offset + 499);
      if (error) throw new Error(`${tablo} davranış verisi alınamadı: ${error.message}`);
      sonuc.push(...(data ?? []) as unknown as Kayit[]);
      if ((data ?? []).length < 500) break;
    }
    }
    return sonuc;
  };
  const [izlemeler, kazanclar, cevaplar, ileri, oneriler, oneriKayiplari, eclubOneriler, eclubKazanclar, yanlis] = await Promise.all([
    oku('izleme_kayitlari', 'izleme_id,yayin_id,oneri_id,izleme_baslangic,izleme_bitis,tamamlandi_mi,gercek_oynatma_mi,izleme_turu,soru_hakki_var_mi,soru_indeksleri,video_suresi_saniye', 'kullanici_id', 'izleme_id'),
    oku('kazanilan_puanlar', 'yayin_id,izleme_id,puan_turu,puan,created_at', 'kullanici_id', 'kazanilan_puan_id'),
    oku('soru_cevaplari', 'izleme_id,soru_index,dogru_mu,created_at', 'kullanici_id', 'soru_cevap_id'),
    oku('ileri_sarma_kayitlari', 'yayin_id,izleme_id,atlanan_sure,kaybedilen_puan,created_at', 'kullanici_id', 'kayit_id'),
    oku('oneri_kayitlari', 'oneri_id,yayin_id,oneri_baslangic,oneri_bitis,created_at', 'kullanici_id', 'oneri_id'),
    oku('oneri_kayip_kayitlari', 'yayin_id,oneri_id,kaybedilen_puan,created_at', 'kullanici_id', 'kayit_id'),
    oku('eclub_oneri_kayitlari', 'oneri_id,yayin_id,kisi_id,oneri_baslangic,oneri_bitis,created_at', 'oneren_id', 'oneri_id'),
    oku('eclub_utt_puanlari', 'yayin_id,oneri_id,created_at', 'utt_id', 'utt_puan_id'),
    oku('yanlis_cevap_kayitlari', 'yayin_id,kaybedilen_puan,created_at', 'kullanici_id', 'kayit_id'),
  ]);
  const eclubIzlemeler: Kayit[] = [];
  for (let start = 0; start < eclubOneriler.length; start += 100) {
    const ids = eclubOneriler.slice(start, start + 100).map(o => o.oneri_id!);
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from('eclub_izleme_kayitlari')
        .select('izleme_id,oneri_id,yayin_id,tamamlandi_mi,izleme_bitis').in('oneri_id', ids)
        .lte('created_at', bitis).order('izleme_id').range(offset, offset + 499);
      if (error) throw new Error(`E-Club tamamlama verisi alınamadı: ${error.message}`);
      eclubIzlemeler.push(...(data ?? []));
      if ((data ?? []).length < 500) break;
    }
  }
  const ids = [...new Set([...izlemeler, ...kazanclar, ...ileri, ...oneriler, ...oneriKayiplari, ...eclubOneriler, ...eclubKazanclar, ...yanlis].map(k => k.yayin_id!))];
  const yayinlar: UttDavranisGirdisi['yayinlar'] = [], turler: UttDavranisGirdisi['turler'] = [];
  for (let start = 0; start < ids.length; start += 100) {
    const batch = ids.slice(start, start + 100);
    const { data, error } = await db.from('v_yayin_kunye').select('yayin_id,icerik_turu,arac_turu').in('yayin_id', batch);
    if (error) throw new Error(`Yayın kategorileri alınamadı: ${error.message}`);
    yayinlar.push(...(data ?? []));
    const periyotRes = await db.from('yayin_yonetimi').select('yayin_id,tekrar_periyot_gun').in('yayin_id', batch);
    if (periyotRes.error) throw new Error(`Yayın tekrar periyotları alınamadı: ${periyotRes.error.message}`);
    const periyotlar = new Map((periyotRes.data ?? []).map(y => [y.yayin_id, y.tekrar_periyot_gun as number | null]));
    const sonTurler = new Map<string, { yayin_id: string; tur_no: number; baslangic_tarihi: string }>();
    for (let offset = 0; ; offset += 500) {
      const r = await db.from('yayin_tekrar_kayitlari').select('yayin_id,tur_no,baslangic_tarihi').in('yayin_id', batch)
        .lte('baslangic_tarihi', bitis).order('tekrar_id').range(offset, offset + 499);
      if (r.error) throw new Error(`Yayın turu alınamadı: ${r.error.message}`);
      for (const t of r.data ?? []) {
        if (t.tur_no > (sonTurler.get(t.yayin_id)?.tur_no ?? 0)) sonTurler.set(t.yayin_id, t);
      }
      if ((r.data ?? []).length < 500) break;
    }
    // Puan motorundaki takvim hizası: henüz DB satırı açılmamış tur da hesaba katılır.
    for (const t of sonTurler.values()) {
      const periyot = periyotlar.get(t.yayin_id);
      const bas = Date.parse(t.baslangic_tarihi);
      const gunMs = 86400000;
      const gecen = periyot && periyot > 0 ? Math.max(0, Math.floor((Date.parse(bitis) - bas) / (periyot * gunMs))) : 0;
      turler.push({ yayin_id: t.yayin_id, baslangic_tarihi: new Date(bas + gecen * (periyot ?? 0) * gunMs).toISOString() });
    }
  }
  return { izlemeler, kazanclar, cevaplar, ileri, oneriler, oneriKayiplari, eclubOneriler, eclubIzlemeler, eclubKazanclar, yayinlar, turler, yanlisKayiplari: yanlis };
}

export async function getUttDavranis(db: SupabaseClient, kullaniciId: string, baslangic: string, bitis: string) {
  const girdi = await getDavranisGirdisi(db, kullaniciId, bitis);
  return { hucreler: uttDavranisiniHesapla(girdi, baslangic, bitis), baslangic, bitis };
}
