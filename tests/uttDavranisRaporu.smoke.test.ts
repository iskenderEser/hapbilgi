import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getUttDavranis, uttDavranisiniHesapla, type UttDavranisGirdisi } from '@/lib/rapor/utt/getUttDavranis';

const bas = '2026-10-01T00:00:00+03:00';
const bit = '2026-10-08T10:00:00+03:00';
const zaman = '2026-10-06T12:00:00+03:00';
const bos = (): UttDavranisGirdisi => ({
  izlemeler: [], kazanclar: [], cevaplar: [], ileri: [], oneriler: [], oneriKayiplari: [],
  eclubOneriler: [], eclubIzlemeler: [], eclubKazanclar: [], turler: [],
  yayinlar: [{ yayin_id: 'v', icerik_turu: 'urun', arac_turu: 'video' }, { yayin_id: 'p', icerik_turu: 'urun', arac_turu: 'podcast' }],
});
const toplam = (g: UttDavranisGirdisi) => uttDavranisiniHesapla(g, bas, bit).find(h => h.kategori === 'urun' && h.arac === 'tumu')!.degerler;

test('Oturum bitişi ve puan olayı ayrı sayılır; dönem dışındaki kazanım taşınmaz', () => {
  const g = bos();
  g.izlemeler = [
    { izleme_id: '1', yayin_id: 'v', gercek_oynatma_mi: true, tamamlandi_mi: true, izleme_baslangic: '2026-09-30T12:00:00+03:00', izleme_bitis: bas },
    { izleme_id: '2', yayin_id: 'v', gercek_oynatma_mi: true, tamamlandi_mi: false, izleme_baslangic: bit },
    { izleme_id: '3', yayin_id: 'v', gercek_oynatma_mi: false, tamamlandi_mi: true, izleme_baslangic: zaman, izleme_bitis: zaman },
  ];
  g.kazanclar = [{ yayin_id: 'v', puan_turu: 'izleme', puan: 40, created_at: '2026-09-30T20:00:00Z' }];
  const d = toplam(g);
  assert.equal(d.tamamlanan, 1); assert.equal(d.baslayan, 1); assert.equal(d.yarim, 1);
  assert.equal(d.ilk_tamamlama ?? 0, 0);
});

test('Yayın tamamlama puanı yalnız ilgili kazançlardan, dönem × kategori × araç kapsamında toplanır', () => {
  const g = bos();
  g.yayinlar.push({ yayin_id: 'm', icerik_turu: 'medikal', arac_turu: 'video' });
  g.kazanclar = [
    { yayin_id: 'v', puan_turu: 'izleme', puan: 40, created_at: bas },
    { yayin_id: 'v', puan_turu: 'izleme', puan: 50, created_at: bit },
    { yayin_id: 'p', puan_turu: 'izleme', puan: 60, created_at: zaman },
    { yayin_id: 'm', puan_turu: 'izleme', puan: 70, created_at: zaman },
    { yayin_id: 'v', puan_turu: 'extra', puan: 10, created_at: zaman },
    { yayin_id: 'v', puan_turu: 'cevaplama', puan: 5, created_at: zaman },
    { yayin_id: 'v', puan_turu: 'oneri', puan: 10, created_at: zaman },
    { yayin_id: 'v', puan_turu: 'izleme', puan: 100, created_at: '2026-09-30T20:00:00Z' },
  ];
  const h = uttDavranisiniHesapla(g, bas, bit);
  const puan = (kategori: string, arac: string) => h.find(x => x.kategori === kategori && x.arac === arac)?.degerler.tamamlama_puani;
  assert.equal(puan('urun', 'tumu'), 150);
  assert.equal(puan('urun', 'video'), 90);
  assert.equal(puan('urun', 'podcast'), 60);
  assert.equal(puan('medikal', 'tumu'), 70);
  assert.equal(toplam(g).ilk_tamamlama, 3);
});

test('Cevaplama, öneri ve Extra puanları kendi kazançlarından ve seçili kapsamdan hesaplanır', () => {
  const g = bos();
  g.yayinlar.push({ yayin_id: 'm', icerik_turu: 'medikal', arac_turu: 'video' });
  g.kazanclar = [
    { yayin_id: 'v', puan_turu: 'cevaplama', puan: 3, created_at: bas },
    { yayin_id: 'p', puan_turu: 'cevaplama', puan: 5, created_at: bit },
    { yayin_id: 'v', puan_turu: 'oneri', puan: 10, created_at: zaman },
    { yayin_id: 'p', puan_turu: 'oneri', puan: 15, created_at: zaman },
    { yayin_id: 'v', puan_turu: 'extra', puan: 7, created_at: zaman },
    { yayin_id: 'v', puan_turu: 'extra', puan: 10, created_at: zaman },
    { yayin_id: 'm', puan_turu: 'extra', puan: 8, created_at: zaman },
    { yayin_id: 'v', puan_turu: 'cevaplama', puan: 100, created_at: '2026-09-30T20:00:00Z' },
    { yayin_id: 'v', puan_turu: 'oneri', puan: 100, created_at: '2026-10-09T00:00:00Z' },
    { yayin_id: 'v', puan_turu: 'izleme', puan: 40, created_at: zaman },
  ];
  g.yanlisKayiplari = [{ yayin_id: 'v', kaybedilen_puan: 3, created_at: zaman }];
  const h = uttDavranisiniHesapla(g, bas, bit);
  const urun = h.find(x => x.kategori === 'urun' && x.arac === 'tumu')!.degerler;
  const video = h.find(x => x.kategori === 'urun' && x.arac === 'video')!.degerler;
  assert.equal(urun.cevaplama_puani, 8);
  assert.equal(urun.oneri_puani, 25);
  assert.equal(urun.extra_puani, 17);
  assert.equal(urun.extra_puan_kazandiran_yayin, 1);
  assert.equal(video.cevaplama_puani, 3);
  assert.equal(video.oneri_puani, 10);
  assert.equal(h.find(x => x.kategori === 'medikal' && x.arac === 'tumu')!.degerler.extra_puani, 8);
});

test('Soru indeksi tekilleştirilir ve boş soru yanlış cevap sayılmaz', () => {
  const g = bos();
  g.izlemeler = [{ izleme_id: '1', yayin_id: 'v', gercek_oynatma_mi: true, tamamlandi_mi: true, izleme_bitis: zaman, soru_hakki_var_mi: true, soru_indeksleri: [0, 2] }];
  g.cevaplar = [{ izleme_id: '1', soru_index: 0, dogru_mu: true, created_at: zaman }, { izleme_id: '1', soru_index: 0, dogru_mu: true, created_at: zaman }];
  const d = toplam(g);
  assert.equal(d.cevaplanan, 1); assert.equal(d.dogru, 1); assert.equal(d.cevapsiz_soru, 1); assert.equal(d.yanlis ?? 0, 0);
});

test('BM önerisi başlangıç, E-Club önerisi bitiş koşuluyla değerlendirilir; kazanım olayı ayrı kalır', () => {
  const g = bos();
  const o = { oneri_id: 'o', yayin_id: 'v', created_at: zaman, oneri_baslangic: zaman, oneri_bitis: '2026-10-07T20:30:00+03:00' };
  const i = { oneri_id: 'o', yayin_id: 'v', tamamlandi_mi: true, izleme_baslangic: o.oneri_bitis, izleme_bitis: '2026-10-08T08:00:00+03:00' };
  g.oneriler = [o]; g.eclubOneriler = [o]; g.izlemeler = [i]; g.eclubIzlemeler = [i];
  const d = toplam(g);
  assert.equal(d.oneri_zamaninda, 1); assert.equal(d.eclub_gec, 1);
  assert.equal(d.eclub_kazanim ?? 0, 0); assert.equal(d.oneri_ceza ?? 0, 0);
});

test('Tümü seçiminde farklı araçlara öneri gönderilen aynı üye bir kez sayılır', () => {
  const g = bos();
  g.eclubOneriler = [{ yayin_id: 'v', kisi_id: 'u', created_at: zaman }, { yayin_id: 'p', kisi_id: 'u', created_at: zaman }];
  const d = toplam(g);
  assert.equal(d.eclub_gelen, 2); assert.equal(d.eclub_uye, 1);
});

test('Extra aşaması ay ve tur kesişimine göre, dönem seçimine rağmen güncel kapsamda kalır', () => {
  const g = bos();
  g.turler = [{ yayin_id: 'v', baslangic_tarihi: '2026-10-05T00:00:00+03:00' }];
  g.izlemeler = ['2026-09-30', '2026-10-03', '2026-10-06', '2026-10-07'].map((gun, index) => ({
    izleme_id: `${index}`, yayin_id: 'v', gercek_oynatma_mi: true, tamamlandi_mi: true, izleme_turu: 'extra',
    izleme_baslangic: `${gun}T12:00:00+03:00`, izleme_bitis: `${gun}T12:05:00+03:00`,
  }));
  const d = toplam(g);
  assert.equal(d.extra_tamamlanan_yayin, 1); assert.equal(d.tekrar_asama_2, 1);
  assert.equal(d.extra_puan_kazandiran_yayin ?? 0, 0);
});

test('Extra kartı tekrar ve kazanım olayları yerine yayınları sayar; bir ve iki tekrar aşamalarını ayırır', () => {
  const g = bos();
  g.yayinlar.push({ yayin_id: 'uc', icerik_turu: 'urun', arac_turu: 'video' });
  g.izlemeler = [['v', 2], ['p', 1], ['uc', 4]].flatMap(([id, sayi]) =>
    Array.from({ length: Number(sayi) }, (_, index) => ({
      yayin_id: String(id), izleme_id: `${id}-${index}`, gercek_oynatma_mi: true,
      tamamlandi_mi: true, izleme_turu: 'extra', izleme_baslangic: zaman, izleme_bitis: zaman,
    })));
  g.kazanclar = [
    { yayin_id: 'uc', puan_turu: 'extra', puan: 10, created_at: zaman },
    { yayin_id: 'uc', puan_turu: 'extra', puan: 10, created_at: zaman },
    { yayin_id: 'v', puan_turu: 'izleme', puan: 40, created_at: zaman },
    { yayin_id: 'p', puan_turu: 'extra', puan: 10, created_at: '2026-09-30T20:00:00Z' },
  ];
  const d = toplam(g);
  assert.equal(d.extra_tamamlanan_yayin, 3);
  assert.equal(d.extra_puan_kazandiran_yayin, 1);
  assert.equal(d.tekrar_asama_2, 1);
  assert.equal(d.tekrar_asama_1, 1);
  const video = uttDavranisiniHesapla(g, bas, bit).find(h => h.kategori === 'urun' && h.arac === 'video')!.degerler;
  assert.equal(video.extra_tamamlanan_yayin, 2);
  assert.equal(video.tekrar_asama_1 ?? 0, 0);
});

test('Bir oturumdaki iki atlama olayında araç süresi iki kez sayılmaz', () => {
  const g = bos();
  g.izlemeler = [{ yayin_id: 'v', izleme_id: '1', video_suresi_saniye: 60 }];
  g.ileri = [10, 20].map(atlanan_sure => ({ yayin_id: 'v', izleme_id: '1', created_at: zaman, atlanan_sure, kaybedilen_puan: 1 }));
  const d = toplam(g);
  assert.equal(d.atlama, 2); assert.equal(d.sarilan_oturum, 1);
  assert.equal(d.atlanan_saniye, 30); assert.equal(d.sarilan_arac_saniye, 60);
});

test('Eksik araç süresi oran paydasını eksik hesaplatmaz', () => {
  const g = bos();
  g.izlemeler = [{ yayin_id: 'v', izleme_id: '1', video_suresi_saniye: 60 }, { yayin_id: 'v', izleme_id: '2' }];
  g.ileri = ['1', '2'].map(izleme_id => ({ yayin_id: 'v', izleme_id, created_at: zaman, atlanan_sure: 30, kaybedilen_puan: 1 }));
  const d = toplam(g);
  assert.equal(d.suresi_bilinmeyen_oturum, 1);
  assert.equal(d.atlanan_saniye, 60);
});

test('Üç kayıp puanı yalnız kendi kayıtlarından ve seçili dönem, kategori ve araç kapsamında toplanır', () => {
  const g = bos();
  g.yayinlar.push({ yayin_id: 'm', icerik_turu: 'medikal', arac_turu: 'video' });
  g.ileri = [
    { yayin_id: 'v', kaybedilen_puan: 12, created_at: bas },
    { yayin_id: 'v', kaybedilen_puan: 8, created_at: bit },
    { yayin_id: 'm', kaybedilen_puan: 99, created_at: zaman },
    { yayin_id: 'v', kaybedilen_puan: 50, created_at: '2026-09-30T20:00:00Z' },
  ];
  g.yanlisKayiplari = [
    { yayin_id: 'v', kaybedilen_puan: 3, created_at: zaman },
    { yayin_id: 'p', kaybedilen_puan: 5, created_at: zaman },
    { yayin_id: 'v', kaybedilen_puan: 7, created_at: '2026-10-09T00:00:00Z' },
  ];
  g.oneriKayiplari = [
    { yayin_id: 'v', kaybedilen_puan: 10, created_at: zaman },
    { yayin_id: 'p', kaybedilen_puan: 15, created_at: zaman },
  ];
  const h = uttDavranisiniHesapla(g, bas, bit);
  const d = toplam(g);
  assert.equal(d.ileri_sarma_kaybi, 20);
  assert.equal(d.yanlis_cevap_kaybi, 8);
  assert.equal(d.oneri_kaybi, 25);
  assert.equal(d.oneri_ceza, 2);
  const video = h.find(x => x.kategori === 'urun' && x.arac === 'video')!.degerler;
  assert.equal(video.yanlis_cevap_kaybi, 3);
  assert.equal(video.oneri_kaybi, 10);
  assert.equal(h.find(x => x.kategori === 'medikal' && x.arac === 'tumu')!.degerler.ileri_sarma_kaybi, 99);
});

test('Kategori çözümlenemiyorsa kayıt sıfırmış gibi sunulmaz', () => {
  const g = bos(); g.kazanclar = [{ yayin_id: 'olmayan', puan_turu: 'extra', puan: 10, created_at: zaman }];
  assert.throws(() => toplam(g), /çözümlenemedi/);
});

test('Loader tüm kişisel kaynakları oturum sahibine bağlar, 1000 üstü kaydı sayfalar ve kaynak hatasını taşır', async () => {
  const sahipler: Record<string, string> = {
    izleme_kayitlari: 'kullanici_id', kazanilan_puanlar: 'kullanici_id', soru_cevaplari: 'kullanici_id',
    ileri_sarma_kayitlari: 'kullanici_id', oneri_kayitlari: 'kullanici_id', oneri_kayip_kayitlari: 'kullanici_id',
    eclub_oneri_kayitlari: 'oneren_id', eclub_utt_puanlari: 'utt_id', yanlis_cevap_kayitlari: 'kullanici_id',
  };
  const ledger = Array.from({ length: 1001 }, () => ({ yayin_id: 'v', puan_turu: 'izleme', puan: 40, created_at: zaman }));
  const sorgular: Array<{ tablo: string; sahip?: string; id?: string; offset?: number; cutoff?: string }> = [];
  let hata = false;
  const db = { from(tablo: string) {
    const q = { tablo } as typeof sorgular[number]; sorgular.push(q);
    const chain = {
      select() { return chain; }, eq(k: string, v: string) { q.sahip = k; q.id = v; return chain; },
      lte(_k: string, v: string) { q.cutoff = v; return chain; }, order() { return chain; }, in() { return chain; },
      range(a: number, b: number) { q.offset = a; return Promise.resolve(result(a, b)); },
      then(resolve: (v: unknown) => void) { return Promise.resolve(result()).then(resolve); },
    };
    function result(a = 0, b = 499) {
      if (hata && tablo === 'soru_cevaplari') return { data: null, error: { message: 'kesildi' } };
      const data = tablo === 'kazanilan_puanlar' ? ledger.slice(a, b + 1) : tablo === 'v_yayin_kunye' ? bos().yayinlar.slice(0, 1) : [];
      return { data, error: null };
    }
    return chain;
  } } as unknown as SupabaseClient;
  const r = await getUttDavranis(db, 'ben', bas, bit);
  assert.equal(r.hucreler.find(h => h.kategori === 'urun' && h.arac === 'tumu')?.degerler.ilk_tamamlama, 1001);
  assert.deepEqual(sorgular.filter(q => q.tablo === 'kazanilan_puanlar').map(q => q.offset), [0, 500, 1000]);
  for (const q of sorgular.filter(q => q.tablo in sahipler)) {
    assert.equal(q.sahip, sahipler[q.tablo]); assert.equal(q.id, 'ben'); assert.equal(q.cutoff, bit);
  }
  hata = true;
  await assert.rejects(() => getUttDavranis(db, 'ben', bas, bit), /soru_cevaplari.*kesildi/);
});
