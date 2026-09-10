import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { tmKapsaminiCoz, tmKapsamPuaniniOku, tekHedef } from '../lib/bi/tmPuan.ts';
import { puanBaglaminiOku, UTT_PUAN_BASLIKLARI, BM_PUAN_BASLIKLARI, type PuanSorgusu } from '../lib/bi/puanSozlesmesi.ts';
import { nedirKatalogu } from '../lib/bi/nedir.ts';

const temel: PuanSorgusu = { olcut: 'toplam_net', zaman: 'ay', geriye: 0, karsilastir: false, hedef: { tur: 'takim', ad: '' } };
function ortam(hata = false) {
  const kisiler = [
    { kullanici_id: 'u1', ad: 'Berk', soyad: 'Kılıç', rol: 'utt', bolge_id: 'b1', takim_id: 't1', firma_id: 'f1', aktif_mi: true },
    { kullanici_id: 'u2', ad: 'Ali', soyad: 'Sert', rol: 'kd_utt', bolge_id: 'b2', takim_id: 't1', firma_id: 'f1', aktif_mi: true },
    { kullanici_id: 'm1', ad: 'Ayşe', soyad: 'Gez', rol: 'bm', bolge_id: 'b1', takim_id: 't1', firma_id: 'f1', aktif_mi: true },
    { kullanici_id: 'u3', ad: 'Yabancı', soyad: 'Kişi', rol: 'utt', bolge_id: 'b3', takim_id: 't2', firma_id: 'f1', aktif_mi: true },
  ];
  const okunan: string[] = [];
  const rpcCagrilari: Array<{ ad: string; params: Record<string, unknown> }> = [];
  const db = {
    from(tablo: string) {
      const filtreler: Record<string, unknown> = {};
      let roller: string[] = [];
      const q = {
        select() { return q; }, eq(k: string, v: unknown) { filtreler[k] = v; return q; },
        in(_k: string, v: string[]) { roller = v; return q; },
        order() { return q; }, gte() { return q; }, lte() { return q; },
        async maybeSingle() {
          if (tablo === 'kullanicilar') {
            assert.equal(filtreler.kullanici_id, 'tm1');
            assert.equal(filtreler.rol, 'tm');
            assert.equal(filtreler.aktif_mi, true);
            return { data: { firma_id: 'f1', takim_id: 't1' }, error: null };
          }
          assert.equal(filtreler.firma_id, 'f1');
          assert.equal(filtreler.takim_id, 't1');
          return { data: { takim_adi: 'Alfa' }, error: null };
        },
        async range() {
          if (hata) return { data: null, error: {} };
          if (tablo === 'bolgeler') {
            assert.equal(filtreler.takim_id, 't1');
            return { data: [{ bolge_id: 'b1', bolge_adi: 'Ankara' }, { bolge_id: 'b2', bolge_adi: 'İzmir' }], error: null };
          }
          if (tablo === 'kullanicilar') return { data: kisiler.filter(k =>
            Object.entries(filtreler).every(([alan, v]) => k[alan as keyof typeof k] === v) && roller.includes(k.rol)), error: null };
          if (tablo === 'eclub_utt_puanlari') return { data: [{ puan: 10 }], error: null };
          assert.equal(filtreler.bm_id ?? filtreler.kullanici_id, 'm1');
          return { data: tablo === 'cc_kazanilan_puanlar' ? [{ puan: 20 }] : [{ kaybedilen_puan: tablo === 'challenge_kayip_kayitlari' ? 0 : 2 }], error: null };
        },
      }; return q;
    },
    async rpc(_ad: string, p: { p_kullanici_id?: string; p_bm_id?: string; p_takim_id?: string; p_bolge_id?: string }) {
      if (hata) return { data: null, error: { message: 'rpc hatası' } };
      rpcCagrilari.push({ ad: _ad, params: p });
      if (_ad === 'get_bm_puan_ozet') {
        return {
          data: [{
            bm_id: p.p_bm_id,
            izleme_puani: 10,
            cevaplama_puani: 5,
            extra_puan: 5,
            cc_gonderme_puani: 0,
            cc_referral_puani: 0,
            ileri_sarma_kaybi: 2,
            yanlis_cevap_kaybi: 2,
            challenge_kaybi: 0,
            toplam_kazanc: 20,
            toplam_kayip: 4,
            toplam_net: 16,
          }],
          error: null,
        };
      }
      const satirUret = (kullanici_id: string) => {
        okunan.push(kullanici_id);
        const video_puani = 100;
        const soru_puani = 20;
        const extra_puan = 5;
        const oneri_puani = 10;
        const eclub_puani = 10;
        const ileri_sarma_kaybi = 3;
        const yanlis_cevap_kaybi = 2;
        const oneri_kaybi = 1;
        const toplam_kazanc = video_puani + soru_puani + extra_puan + oneri_puani + eclub_puani;
        const toplam_kayip = ileri_sarma_kaybi + yanlis_cevap_kaybi + oneri_kaybi;
        const toplam_net_puan = toplam_kazanc - toplam_kayip;
        return {
          kullanici_id,
          video_puani,
          soru_puani,
          extra_puan,
          oneri_puani,
          eclub_puani,
          ileri_sarma_kaybi,
          yanlis_cevap_kaybi,
          oneri_kaybi,
          toplam_net_puan,
        };
      };

      if (p.p_takim_id) {
        const eslesenler = kisiler.filter(k => k.takim_id === p.p_takim_id && ['utt', 'kd_utt'].includes(k.rol));
        return { data: eslesenler.map(k => satirUret(k.kullanici_id)), error: null };
      }
      if (p.p_bolge_id) {
        const eslesenler = kisiler.filter(k => k.bolge_id === p.p_bolge_id && ['utt', 'kd_utt'].includes(k.rol));
        return { data: eslesenler.map(k => satirUret(k.kullanici_id)), error: null };
      }
      if (p.p_kullanici_id) {
        return { data: [satirUret(p.p_kullanici_id)], error: null };
      }
      return { data: [], error: null };
    },
  } as unknown as SupabaseClient;
  return { db, okunan, rpcCagrilari };
}
test('TM takım ve bölge toplamı UTTlerden gelir; BM kişisel puanı ayrı kalır', async () => {
  for (const [hedef, puan, ids, beklenenOzetCagriSayisi] of [
    [{ tur: 'takim', ad: '' }, 278, ['u1','u2'], 1],
    [{ tur: 'bolge', ad: 'Ankara' }, 139, ['u1'], 1],
    [{ tur: 'utt', ad: 'Berk' }, 139, ['u1'], 1],
    [{ tur: 'bm', ad: 'Ayşe Gez' }, 16, [], 0],
    [{ tur: 'bm_toplam', ad: '' }, 16, [], 0],
  ] as const) {
    const { db, okunan, rpcCagrilari } = ortam();
    const sorgu = { ...temel, hedef };
    const kapsam = await tmKapsaminiCoz(db, 'tm1', sorgu);
    assert.equal((await tmKapsamPuaniniOku(db, kapsam, sorgu)).puan, puan);
    assert.deepEqual(okunan, ids);
    const ozetCagrilar = rpcCagrilari.filter(c => c.ad === 'get_kullanici_ozet');
    assert.equal(ozetCagrilar.length, beklenenOzetCagriSayisi, `Hedef ${hedef.tur} için get_kullanici_ozet çağrı sayısı ${beklenenOzetCagriSayisi} olmalı`);
  }
});
test('TM kapsam dışı ve belirsiz hedefleri reddeder, veri hatası sıfır olmaz', async () => {
  for (const hedef of [{ tur: 'utt', ad: 'Yabancı' }, { tur: 'bolge', ad: 'Bursa' }, { tur: 'takim', ad: 'Başka takım' }] as const) {
    await assert.rejects(tmKapsaminiCoz(ortam().db, 'tm1', { ...temel, hedef }), /HEDEF_YOK/);
  }
  assert.throws(() => tekHedef(['Ayşe Gez','Ayşe Gör'], 'Ayşe', s => s), /HEDEF_BELIRSIZ/);
  await assert.rejects(tmKapsaminiCoz(ortam(true).db, 'tm1', temel), /VERI_OKUNAMADI/);
});
test('TM 11 UTT ve 10 BM ölçütünü dört zamanda hedef bağlamıyla korur', () => {
  for (const tur of ['takim','bolge','utt','bm','bm_toplam'] as const) {
    const katalog = ['bm','bm_toplam'].includes(tur) ? BM_PUAN_BASLIKLARI : UTT_PUAN_BASLIKLARI;
    for (const olcut of Object.keys(katalog)) for (const zaman of ['hafta','ay','donem','yil']) {
      const s = { ...temel, olcut, zaman, hedef: { tur, ad: 'Örnek' } };
      assert.deepEqual(puanBaglaminiOku(s, 'tm'), s);
    }
  }
  assert.equal(puanBaglaminiOku({ ...temel, olcut: 'cc_gonderme' }, 'tm'), undefined);
  assert.equal(puanBaglaminiOku({ ...temel, olcut: 'oneri', hedef: { tur: 'bm', ad: 'Ayşe' } }, 'tm'), undefined);
  assert.equal(puanBaglaminiOku({ ...temel, hedef: { tur: 'firma', ad: '' } }, 'tm'), undefined);
  const tmKatalog = nedirKatalogu('tm');
  const bmKatalog = nedirKatalogu('bm');
  assert.equal(tmKatalog.length, bmKatalog.length);
  for (const tmKonu of tmKatalog) {
    const bmKonu = bmKatalog.find((k) => k.id === tmKonu.id);
    assert.ok(bmKonu, `${tmKonu.id} BM kataloğunda bulunmalı`);
    assert.equal(tmKonu.baslik, bmKonu.baslik);
    assert.equal(tmKonu.cevap, bmKonu.cevap);
    assert.deepEqual(tmKonu.adlar, bmKonu.adlar);
  }
  const tmStore = tmKatalog.find((k) => k.id === 'hbstore');
  assert.deepEqual(tmStore?.aksiyon, { etiket: 'Siparişler', url: '/store/siparisler' });

  const tmChallenge = tmKatalog.find((k) => k.id === 'challenge');
  assert.deepEqual(tmChallenge?.aksiyon, { etiket: 'C-Club Ligi', url: '/cc-ligi' });

  const tmEclub = tmKatalog.find((k) => k.id === 'eclub');
  assert.deepEqual(tmEclub?.aksiyon, { etiket: 'E-Club Takım Raporları', url: '/eclub/raporlar' });
});

test('TM çok bölgeli, E-Club kazanımlı, kayıplı, sıfır puanlı ve kapsam dışı kullanıcı senaryolarında eski ve yeni hesaplama birebir eşleşir ve RPC çağrısı azalır', async () => {
  const testKullanicilari = [
    { kullanici_id: 'u1', ad: 'Ayşe', soyad: 'Demir', rol: 'utt', bolge_id: 'b1', takim_id: 't1', firma_id: 'f1', aktif_mi: true },
    { kullanici_id: 'u2', ad: 'Burak', soyad: 'Sıfır', rol: 'kd_utt', bolge_id: 'b2', takim_id: 't1', firma_id: 'f1', aktif_mi: true },
    { kullanici_id: 'u3', ad: 'Cem', soyad: 'Kayıp', rol: 'utt', bolge_id: 'b2', takim_id: 't1', firma_id: 'f1', aktif_mi: true },
    { kullanici_id: 'u_dis', ad: 'Dış', soyad: 'Kullanıcı', rol: 'utt', bolge_id: 'b_baska', takim_id: 't1', firma_id: 'f1', aktif_mi: true },
    { kullanici_id: 'm1', ad: 'Mehmet', soyad: 'BM', rol: 'bm', bolge_id: 'b1', takim_id: 't1', firma_id: 'f1', aktif_mi: true },
    { kullanici_id: 'u_t2', ad: 'Farklı', soyad: 'Takım', rol: 'utt', bolge_id: 'b3', takim_id: 't2', firma_id: 'f1', aktif_mi: true },
  ];

  const puanVerileri: Record<string, Record<string, number>> = {
    u1: {
      video_puani: 100, soru_puani: 20, extra_puan: 10, oneri_puani: 10, eclub_puani: 50,
      ileri_sarma_kaybi: 5, yanlis_cevap_kaybi: 3, oneri_kaybi: 2, toplam_net_puan: 180,
    },
    u2: {
      video_puani: 0, soru_puani: 0, extra_puan: 0, oneri_puani: 0, eclub_puani: 0,
      ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 0, oneri_kaybi: 0, toplam_net_puan: 0,
    },
    u3: {
      video_puani: 80, soru_puani: 10, extra_puan: 0, oneri_puani: 0, eclub_puani: 0,
      ileri_sarma_kaybi: 10, yanlis_cevap_kaybi: 0, oneri_kaybi: 0, toplam_net_puan: 80,
    },
    u_dis: {
      video_puani: 500, soru_puani: 0, extra_puan: 0, oneri_puani: 0, eclub_puani: 0,
      ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 0, oneri_kaybi: 0, toplam_net_puan: 500,
    },
  };

  let rpcCagriSayisi = 0;
  const dbMock = {
    from(tablo: string) {
      const filtreler: Record<string, unknown> = {};
      let roller: string[] = [];
      const q = {
        select() { return q; },
        eq(k: string, v: unknown) { filtreler[k] = v; return q; },
        in(_k: string, v: string[]) { roller = v; return q; },
        order() { return q; },
        async maybeSingle() {
          if (tablo === 'kullanicilar') {
            return { data: { firma_id: 'f1', takim_id: 't1' }, error: null };
          }
          return { data: { takim_adi: 'Alfa Takımı' }, error: null };
        },
        async range() {
          if (tablo === 'bolgeler') {
            return {
              data: [
                { bolge_id: 'b1', bolge_adi: 'Ankara Bölgesi' },
                { bolge_id: 'b2', bolge_adi: 'İzmir Bölgesi' },
              ],
              error: null,
            };
          }
          if (tablo === 'kullanicilar') {
            return {
              data: testKullanicilari.filter(k =>
                Object.entries(filtreler).every(([alan, v]) => k[alan as keyof typeof k] === v) &&
                roller.includes(k.rol)),
              error: null,
            };
          }
          return { data: [], error: null };
        },
      };
      return q;
    },
    async rpc(_ad: string, p: { p_kullanici_id?: string; p_takim_id?: string; p_bolge_id?: string }) {
      rpcCagriSayisi++;
      if (p.p_takim_id) {
        const eslesenler = testKullanicilari.filter(k => k.takim_id === p.p_takim_id && ['utt', 'kd_utt'].includes(k.rol));
        return {
          data: eslesenler.map(k => ({
            kullanici_id: k.kullanici_id,
            ...(puanVerileri[k.kullanici_id] ?? {
              video_puani: 0, soru_puani: 0, extra_puan: 0, oneri_puani: 0, eclub_puani: 0,
              ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 0, oneri_kaybi: 0, toplam_net_puan: 0,
            }),
          })),
          error: null,
        };
      }
      if (p.p_bolge_id) {
        const eslesenler = testKullanicilari.filter(k => k.bolge_id === p.p_bolge_id && ['utt', 'kd_utt'].includes(k.rol));
        return {
          data: eslesenler.map(k => ({
            kullanici_id: k.kullanici_id,
            ...(puanVerileri[k.kullanici_id] ?? {
              video_puani: 0, soru_puani: 0, extra_puan: 0, oneri_puani: 0, eclub_puani: 0,
              ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 0, oneri_kaybi: 0, toplam_net_puan: 0,
            }),
          })),
          error: null,
        };
      }
      if (p.p_kullanici_id) {
        return {
          data: [{
            kullanici_id: p.p_kullanici_id,
            ...(puanVerileri[p.p_kullanici_id] ?? {
              video_puani: 0, soru_puani: 0, extra_puan: 0, oneri_puani: 0, eclub_puani: 0,
              ileri_sarma_kaybi: 0, yanlis_cevap_kaybi: 0, oneri_kaybi: 0, toplam_net_puan: 0,
            }),
          }],
          error: null,
        };
      }
      return { data: [], error: null };
    },
  } as unknown as SupabaseClient;

  // 1. Takım toplamı (toplam_net):
  // Beklenen: u1 (180) + u2 (0) + u3 (80) = 260 puan. u_dis (500) ve m1 dahil EDİLMEZ.
  const takimSorgusu: PuanSorgusu = { olcut: 'toplam_net', zaman: 'ay', geriye: 0, karsilastir: false, hedef: { tur: 'takim', ad: 'Alfa Takımı' } };
  const takimKapsam = await tmKapsaminiCoz(dbMock, 'tm1', takimSorgusu);
  rpcCagriSayisi = 0;
  const takimSonuc = await tmKapsamPuaniniOku(dbMock, takimKapsam, takimSorgusu);
  assert.equal(takimSonuc.puan, 260, 'Takım toplam puanı 260 olmalı');
  assert.equal(rpcCagriSayisi, 1, 'Toplu okuma ile get_kullanici_ozet yalnız 1 kez çağrılmalı (önceden 3 kezdi)');

  // 2. Takım toplam kazanç (toplam_kazanc):
  // Beklenen: u1 (190) + u2 (0) + u3 (90) = 280
  const takimKazancSorgusu: PuanSorgusu = { ...takimSorgusu, olcut: 'toplam_kazanc' };
  rpcCagriSayisi = 0;
  const takimKazancSonuc = await tmKapsamPuaniniOku(dbMock, takimKapsam, takimKazancSorgusu);
  assert.equal(takimKazancSonuc.puan, 280, 'Takım toplam kazancı 280 olmalı');
  assert.equal(rpcCagriSayisi, 1, 'Kazanç sorgusunda da yalnız 1 RPC çağrısı yapılmalı');

  // 3. Takım E-Club puanı (eclub):
  // Beklenen: u1 (50) + u2 (0) + u3 (0) = 50
  const takimEclubSorgusu: PuanSorgusu = { ...takimSorgusu, olcut: 'eclub' };
  rpcCagriSayisi = 0;
  const takimEclubSonuc = await tmKapsamPuaniniOku(dbMock, takimKapsam, takimEclubSorgusu);
  assert.equal(takimEclubSonuc.puan, 50, 'Takım E-Club puanı 50 olmalı');
  assert.equal(rpcCagriSayisi, 1, 'E-Club sorgusunda yalnız 1 RPC çağrısı yapılmalı');

  // 4. Takım toplam kayıp (toplam_kayip):
  // Beklenen: u1 (10) + u2 (0) + u3 (10) = 20
  const takimKayipSorgusu: PuanSorgusu = { ...takimSorgusu, olcut: 'toplam_kayip' };
  rpcCagriSayisi = 0;
  const takimKayipSonuc = await tmKapsamPuaniniOku(dbMock, takimKapsam, takimKayipSorgusu);
  assert.equal(takimKayipSonuc.puan, 20, 'Takım toplam kaybı 20 olmalı');
  assert.equal(rpcCagriSayisi, 1, 'Kayıp sorgusunda yalnız 1 RPC çağrısı yapılmalı');

  // 5. Bölge toplamı (Ankara Bölgesi):
  // Beklenen: u1 (180).
  const bolge1Sorgusu: PuanSorgusu = { olcut: 'toplam_net', zaman: 'ay', geriye: 0, karsilastir: false, hedef: { tur: 'bolge', ad: 'Ankara Bölgesi' } };
  const bolge1Kapsam = await tmKapsaminiCoz(dbMock, 'tm1', bolge1Sorgusu);
  rpcCagriSayisi = 0;
  const bolge1Sonuc = await tmKapsamPuaniniOku(dbMock, bolge1Kapsam, bolge1Sorgusu);
  assert.equal(bolge1Sonuc.puan, 180, 'Ankara bölgesi net puanı 180 olmalı');
  assert.equal(rpcCagriSayisi, 1, 'Bölge sorgusunda yalnız 1 RPC çağrısı yapılmalı');

  // 6. Bölge toplamı (İzmir Bölgesi):
  // Beklenen: u2 (0) + u3 (80) = 80.
  const bolge2Sorgusu: PuanSorgusu = { olcut: 'toplam_net', zaman: 'ay', geriye: 0, karsilastir: false, hedef: { tur: 'bolge', ad: 'İzmir Bölgesi' } };
  const bolge2Kapsam = await tmKapsaminiCoz(dbMock, 'tm1', bolge2Sorgusu);
  rpcCagriSayisi = 0;
  const bolge2Sonuc = await tmKapsamPuaniniOku(dbMock, bolge2Kapsam, bolge2Sorgusu);
  assert.equal(bolge2Sonuc.puan, 80, 'İzmir bölgesi net puanı 80 olmalı (sıfır puanlı kullanıcı dahil)');
  assert.equal(rpcCagriSayisi, 1, 'Bölge sorgusunda yalnız 1 RPC çağrısı yapılmalı');
});

test('TM 500den fazla kullanıcı içeren sayfalı RPC sonucunda tüm kullanıcıları tam bir kez toplar ve order(kullanici_id) uygular', async () => {
  const toplamKisiSayisi = 550;
  const kisiler = Array.from({ length: toplamKisiSayisi }, (_, i) => ({
    kullanici_id: `u_${String(i + 1).padStart(4, '0')}`,
    ad: `Ad_${i + 1}`,
    soyad: `Soyad_${i + 1}`,
    rol: 'utt',
    bolge_id: 'b1',
    takim_id: 't1',
    firma_id: 'f1',
    aktif_mi: true,
  }));

  const siraKontrolleri: string[] = [];
  const sayfaAraliklari: Array<{ bas: number; son: number }> = [];

  const dbMock = {
    from(tablo: string) {
      const q = {
        select() { return q; },
        eq() { return q; },
        in() { return q; },
        order() { return q; },
        async maybeSingle() {
          return { data: tablo === 'kullanicilar' ? { firma_id: 'f1', takim_id: 't1' } : { takim_adi: 'Büyük Takım' }, error: null };
        },
        async range(bas: number, son: number) {
          if (tablo === 'bolgeler') return { data: [{ bolge_id: 'b1', bolge_adi: 'Bölge 1' }], error: null };
          return { data: kisiler.slice(bas, son + 1), error: null };
        },
      };
      return q;
    },
    rpc(_ad: string, _p: Record<string, unknown>) {
      const builder = {
        order(kolon: string) {
          siraKontrolleri.push(kolon);
          return builder;
        },
        async range(bas: number, son: number) {
          sayfaAraliklari.push({ bas, son });
          const dilim = kisiler.slice(bas, son + 1);
          return {
            data: dilim.map(k => ({
              kullanici_id: k.kullanici_id,
              toplam_net_puan: 10,
              video_puani: 10,
              soru_puani: 0,
              extra_puan: 0,
              oneri_puani: 0,
              eclub_puani: 0,
              ileri_sarma_kaybi: 0,
              yanlis_cevap_kaybi: 0,
              oneri_kaybi: 0,
            })),
            error: null,
          };
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;

  const sorgu: PuanSorgusu = { olcut: 'toplam_net', zaman: 'ay', geriye: 0, karsilastir: false, hedef: { tur: 'takim', ad: 'Büyük Takım' } };
  const kapsam = await tmKapsaminiCoz(dbMock, 'tm1', sorgu);
  assert.equal(kapsam.kisiler.length, 550);

  const sonuc = await tmKapsamPuaniniOku(dbMock, kapsam, sorgu);
  assert.equal(sonuc.puan, 550 * 10, '550 kullanıcının her biri tam bir kez 10 puan olarak toplanmalı (toplam 5500)');
  assert.deepEqual(siraKontrolleri, ['kullanici_id', 'kullanici_id'], 'Her sayfalama çağrısında order(kullanici_id) çağrılmalı');
  assert.deepEqual(sayfaAraliklari, [{ bas: 0, son: 499 }, { bas: 500, son: 999 }], 'Sayfalama 500lük paketlerle yapılmalı');
});

test('TM RPC sonucunda kullanici_id eksikse VERI_EKSIK hatası verir, kapsam dışı kullanıcı toplama katılmaz', async () => {
  const kapsam = {
    kisiler: [
      { kullanici_id: 'u1', ad: 'Ali', soyad: 'A', rol: 'utt', bolge_id: 'b1' },
      { kullanici_id: 'u2', ad: 'Veli', soyad: 'V', rol: 'utt', bolge_id: 'b1' },
    ],
    etiket: 'Test Takım',
    takimId: 't1',
    firmaId: 'f1',
    bolgeId: undefined,
  };
  const sorgu: PuanSorgusu = { olcut: 'toplam_net', zaman: 'ay', geriye: 0, karsilastir: false, hedef: { tur: 'takim', ad: 'Test Takım' } };

  // 1. kullanici_id eksik olan satır:
  const dbEksikId = {
    rpc: async () => ({
      data: [
        { kullanici_id: 'u1', toplam_net_puan: 100 },
        { toplam_net_puan: 50 },
      ],
      error: null,
    }),
  } as unknown as SupabaseClient;

  await assert.rejects(
    () => tmKapsamPuaniniOku(dbEksikId, kapsam, sorgu),
    /VERI_EKSIK/,
    'RPC satırında kullanici_id eksikse VERI_EKSIK fırlatılmalı'
  );

  // 2. kullanici_id null olan satır:
  const dbNullId = {
    rpc: async () => ({
      data: [
        { kullanici_id: 'u1', toplam_net_puan: 100 },
        { kullanici_id: null, toplam_net_puan: 50 },
      ],
      error: null,
    }),
  } as unknown as SupabaseClient;

  await assert.rejects(
    () => tmKapsamPuaniniOku(dbNullId, kapsam, sorgu),
    /VERI_EKSIK/,
    'RPC satırında kullanici_id null ise VERI_EKSIK fırlatılmalı'
  );

  // 3. Kapsam dışı kullanıcı içeren satırlar:
  const dbKapsamDisi = {
    rpc: async () => ({
      data: [
        { kullanici_id: 'u1', toplam_net_puan: 100 },
        { kullanici_id: 'u2', toplam_net_puan: 150 },
        { kullanici_id: 'u_haric', toplam_net_puan: 9999 },
      ],
      error: null,
    }),
  } as unknown as SupabaseClient;

  const sonuc = await tmKapsamPuaniniOku(dbKapsamDisi, kapsam, sorgu);
  assert.equal(sonuc.puan, 250, 'Kapsam dışı kullanıcının puanı (9999) toplama dahil edilmemeli, sadece u1(100) + u2(150) = 250 toplanmalı');
});


