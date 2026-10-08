import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { bmDavranisiniHesapla, getBmDavranis, getBmKarsilastirma } from '@/lib/rapor/bm/getBmDavranis';
import { getDavranisGirdisi, type UttDavranisGirdisi } from '@/lib/rapor/utt/getUttDavranis';
const bas = '2026-10-01T00:00:00+03:00', bit = '2026-10-08T23:59:59+03:00', zaman = '2026-10-06T12:00:00+03:00';
const bos = (): UttDavranisGirdisi => ({ izlemeler: [], kazanclar: [], cevaplar: [], ileri: [], oneriler: [], oneriKayiplari: [], eclubOneriler: [], eclubIzlemeler: [], eclubKazanclar: [], yanlisKayiplari: [], turler: [], yayinlar: [{ yayin_id: 'v', icerik_turu: 'urun', arac_turu: 'video' }, { yayin_id: 'p', icerik_turu: 'urun', arac_turu: 'podcast' }] });
const toplam = (g: UttDavranisGirdisi) => bmDavranisiniHesapla(g, ['u1','u2'], bas, bit).find(h => h.kategori === 'urun' && h.arac === 'tumu')!.degerler;

test('Bölge puanları kişisel kurallarla toplanır; dış bölge ve dönem dışı kayıtlar alınmaz', () => {
  const g = bos();
  g.kazanclar = [
    { kullanici_id: 'u1', yayin_id: 'v', puan_turu: 'izleme', puan: 40, created_at: zaman },
    { kullanici_id: 'u2', yayin_id: 'v', puan_turu: 'izleme', puan: 60, created_at: zaman },
    { kullanici_id: 'dis', yayin_id: 'v', puan_turu: 'izleme', puan: 999, created_at: zaman },
    { kullanici_id: 'u1', yayin_id: 'v', puan_turu: 'izleme', puan: 100, created_at: '2026-09-01' },
  ];
  g.oneriKayiplari = [{ kullanici_id: 'u1', yayin_id: 'v', kaybedilen_puan: 5, created_at: zaman }];
  const d = toplam(g);
  assert.equal(d.tamamlama_puani, 100); assert.equal(d.ilk_tamamlama, 2); assert.equal(d.oneri_kaybi, 5);
});

test('Extra aynı yayın için iki farklı UTT faaliyetini korur; tekrar aşamaları kişiye aittir', () => {
  const g = bos();
  g.izlemeler = ['u1','u2'].map(kullanici_id => ({ kullanici_id, izleme_id: kullanici_id, yayin_id: 'v', gercek_oynatma_mi: true, tamamlandi_mi: true, izleme_turu: 'extra', izleme_baslangic: zaman, izleme_bitis: zaman }));
  const d = toplam(g);
  assert.equal(d.extra_tamamlanan_yayin, 2); assert.equal(d.tekrar_asama_1, 2); assert.equal(d.tekrar_asama_2 ?? 0, 0);
});

test('Aynı E-Club üyesi kişiler ve yayın türleri arasında bölge toplamında tek sayılır', () => {
  const g = bos();
  g.eclubOneriler = [
    { oneren_id: 'u1', yayin_id: 'v', kisi_id: 'uye1', created_at: zaman },
    { oneren_id: 'u2', yayin_id: 'p', kisi_id: 'uye1', created_at: zaman },
    { oneren_id: 'u2', yayin_id: 'v', kisi_id: 'uye2', created_at: zaman },
    { oneren_id: 'dis', yayin_id: 'v', kisi_id: 'uye3', created_at: zaman },
  ];
  const h = bmDavranisiniHesapla(g, ['u1','u2'], bas, bit);
  assert.equal(h.find(c => c.kategori === 'urun' && c.arac === 'tumu')?.degerler.eclub_uye, 2);
  assert.equal(h.find(c => c.kategori === 'urun' && c.arac === 'video')?.degerler.eclub_uye, 2);
  assert.equal(h.find(c => c.kategori === 'urun' && c.arac === 'podcast')?.degerler.eclub_uye, 1);
});

test('Bölge oranlarının pay ve paydası kişisel oran ortalaması yerine toplamları taşır', () => {
  const g = bos();
  g.izlemeler = ['u1','u2'].map(kullanici_id => ({ kullanici_id, izleme_id: kullanici_id, yayin_id: 'v' }));
  g.cevaplar = [{ kullanici_id: 'u1', izleme_id: 'u1', soru_index: 0, dogru_mu: true, created_at: zaman }, ...Array.from({length:9}, (_, soru_index) => ({ kullanici_id: 'u2', izleme_id: 'u2', soru_index, dogru_mu: false, created_at: zaman }))];
  const d = toplam(g); assert.equal(d.dogru, 1); assert.equal(d.cevaplanan, 10); assert.equal(d.dogru / d.cevaplanan * 100, 10);
});

function veriTabani(temsilciSayisi = 0, hata = false) {
  const sorgular: Array<{ tablo: string; filters: Record<string, unknown>; offset?: number }> = [];
  const db = { from(tablo: string) {
    const q = { tablo, filters: {} } as typeof sorgular[number]; sorgular.push(q);
    const c = { select() { return c; }, eq(k: string, v: unknown) { q.filters[k] = v; return c; }, in(k: string,v: unknown) { q.filters[k] = v; return c; }, lte() { return c; }, order() { return c; }, range(a: number,b: number) { q.offset = a; return Promise.resolve(result(a,b)); }, then(resolve: (v: unknown) => void) { return Promise.resolve(result()).then(resolve); } };
    function result(a = 0,b = 499) { return { data: tablo === 'kullanicilar' ? Array.from({length:temsilciSayisi}, (_,i) => ({ kullanici_id: `u${i}` })).slice(a,b+1) : [], error: hata && tablo === 'kullanicilar' ? { message: 'kesildi' } : null }; }
    return c;
  }, rpc(_ad: string, args: Record<string, string>) {
    sorgular.push({ tablo: 'rpc', filters: args });
    const c = { select() { return c; }, order() { return c; }, range() { return Promise.resolve({ data: [{ toplam_net_puan: args.p_bolge_id ? 100 : args.p_takim_id ? 200 : 400 }], error: null }); } }; return c;
  } } as unknown as SupabaseClient;
  return { db, sorgular };
}

test('Bölge sorgusu firma, bölge, aktif UTT rollerini sınırlar; katkılar aynı dönemden gelir', async () => {
  const { db, sorgular } = veriTabani(1001);
  const r = await getBmDavranis(db, { bolge_id: 'b', firma_id: 'f', takim_id: 't' }, bas, bit);
  assert.equal(r.katki.netPuan, 100); assert.equal(r.katki.takim?.yuzde, 50); assert.equal(r.katki.firma?.yuzde, 25);
  const users = sorgular.filter(q => q.tablo === 'kullanicilar');
  assert.deepEqual(users.map(q => q.offset), [0,500,1000]);
  for (const q of users) assert.deepEqual(q.filters, { aktif_mi: true, firma_id: 'f', bolge_id: 'b', rol: ['utt','kd_utt'] });
  for (const q of sorgular.filter(q => q.tablo === 'rpc')) { assert.equal(q.filters.p_firma_id, 'f'); assert.equal(q.filters.p_baslangic, bas); assert.equal(q.filters.p_bitis, bit); }
  for (const q of sorgular.filter(q => q.tablo === 'izleme_kayitlari')) { assert.ok(Array.isArray(q.filters.kullanici_id)); assert.ok((q.filters.kullanici_id as string[]).length <= 100); }
});

test('Boş bölge kişisel kaynakları genel sorgulamaz; eksik kapsam ve kaynak hatası durdurulur', async () => {
  const { db, sorgular } = veriTabani();
  await getDavranisGirdisi(db, [], bit); assert.equal(sorgular.length, 0);
  await assert.rejects(getBmDavranis(db, { bolge_id: '', firma_id: 'f', takim_id: 't' }, bas, bit), /bilgisi eksik/);
  await assert.rejects(getBmDavranis(veriTabani(0,true).db, { bolge_id: 'b', firma_id: 'f', takim_id: 't' }, bas, bit), /temsilcileri alınamadı/);
});

test('Bölge dışı temsilciye erişim kişisel veri sorgusu başlamadan reddedilir', async () => {
  const { db, sorgular } = veriTabani(2);
  await assert.rejects(getBmDavranis(db, { bolge_id: 'b', firma_id: 'f', takim_id: 't' }, bas, bit, 'dis'), /erişim yetkiniz yok/);
  assert.ok(sorgular.every(q => q.tablo === 'kullanicilar'));
});

test('Seçili temsilcinin verileri aynı UTT hesabıyla, kapsam katkılarıyla birlikte döner', async () => {
  const { db, sorgular } = veriTabani(2);
  const r = await getBmDavranis(db, { bolge_id: 'b', firma_id: 'f', takim_id: 't' }, bas, bit, 'u1');
  assert.equal(r.temsilciId, 'u1'); assert.equal(r.temsilciler.length, 2);
  assert.equal(r.katki.netPuan, 400); assert.equal(r.katki.bolge?.toplam, 100);
  const kisiSorgulari = sorgular.filter(q => ['izleme_kayitlari','kazanilan_puanlar','soru_cevaplari','ileri_sarma_kayitlari','oneri_kayitlari','oneri_kayip_kayitlari','yanlis_cevap_kayitlari'].includes(q.tablo));
  assert.equal(kisiSorgulari.length, 7);
  for (const q of kisiSorgulari) assert.equal(q.filters.kullanici_id, 'u1');
  assert.ok(sorgular.some(q => q.tablo === 'rpc' && q.filters.p_kullanici_id === 'u1'));
});

test('Bölge kayıtları kişi seçiminde tekrar çekilmez; üyelik kontrolü ve Yenile korunur', async () => {
  const { db, sorgular } = veriTabani(2);
  const kapsam = { bolge_id: 'hiz-bolge', firma_id: 'hiz-firma', takim_id: 'hiz-takim' };
  await getBmDavranis(db, kapsam, bas, bit, '', true);
  sorgular.length = 0;
  await getBmDavranis(db, kapsam, bas, bit, 'u1');
  assert.ok(sorgular.some(q => q.tablo === 'kullanicilar'));
  assert.equal(sorgular.filter(q => q.tablo === 'rpc').length, 1);
  assert.equal(sorgular.filter(q => q.tablo === 'izleme_kayitlari').length, 0);
  sorgular.length = 0;
  await getBmDavranis(db, kapsam, bas, bit, 'u1', true);
  assert.ok(sorgular.some(q => q.tablo === 'izleme_kayitlari'));
  assert.equal(sorgular.filter(q => q.tablo === 'rpc').length, 4);
});


test('BM karşılaştırması iki farklı bölge temsilcisini aynı tarih aralığında okur', async () => {
  const { db, sorgular } = veriTabani(2);
  const r = await getBmKarsilastirma(db, { firma_id: 'kiyas-f', bolge_id: 'kiyas-b', takim_id: 'kiyas-t' }, bas, bit, 'u0', 'u1', true);
  assert.equal(r.temsilciId, 'u0'); assert.equal(r.karsilastirma.temsilciId, 'u1');
  assert.equal(r.baslangic, r.karsilastirma.baslangic); assert.equal(r.bitis, r.karsilastirma.bitis);
  const kisiRpc = sorgular.filter(q => q.tablo === 'rpc' && q.filters.p_kullanici_id);
  assert.deepEqual(kisiRpc.map(q => q.filters.p_kullanici_id).sort(), ['u0','u1']);
  for (const q of kisiRpc) { assert.equal(q.filters.p_firma_id, 'kiyas-f'); assert.equal(q.filters.p_bolge_id, 'kiyas-b'); assert.equal(q.filters.p_bitis, r.bitis); }
});

test('BM karşılaştırması aynı kişiyi ve bölge dışı ikinci kişiyi reddeder', async () => {
  const { db, sorgular } = veriTabani(2);
  const k = { firma_id: 'kiyas-red-f', bolge_id: 'kiyas-red-b', takim_id: 'kiyas-red-t' };
  await assert.rejects(getBmKarsilastirma(db, k, bas, bit, 'u1', 'u1'), /iki farklı/);
  assert.equal(sorgular.length, 0);
  await assert.rejects(getBmKarsilastirma(db, k, bas, bit, 'u0', 'dis'), /erişim/);
  assert.ok(!sorgular.some(q => q.tablo === 'rpc' && q.filters.p_kullanici_id));
});
