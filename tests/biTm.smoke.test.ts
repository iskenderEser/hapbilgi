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
          assert.equal(filtreler.bm_id, 'm1');
          return { data: tablo === 'cc_kazanilan_puanlar' ? [{ puan: 20 }] : [{ kaybedilen_puan: 2 }], error: null };
        },
      }; return q;
    },
    async rpc(_ad: string, p: { p_kullanici_id: string }) {
      okunan.push(p.p_kullanici_id);
      return { data: [{ video_puani: 100, soru_puani: 20, extra_puan: 5, oneri_puani: 10,
        ileri_sarma_kaybi: 3, yanlis_cevap_kaybi: 2, oneri_kaybi: 1 }], error: null };
    },
  } as unknown as SupabaseClient;
  return { db, okunan };
}
test('TM takım ve bölge toplamı UTTlerden gelir; BM kişisel puanı ayrı kalır', async () => {
  for (const [hedef, puan, ids] of [
    [{ tur: 'takim', ad: '' }, 278, ['u1','u2']],
    [{ tur: 'bolge', ad: 'Ankara' }, 139, ['u1']],
    [{ tur: 'utt', ad: 'Berk' }, 139, ['u1']],
    [{ tur: 'bm', ad: 'Ayşe Gez' }, 16, []],
    [{ tur: 'bm_toplam', ad: '' }, 16, []],
  ] as const) {
    const { db, okunan } = ortam();
    const sorgu = { ...temel, hedef };
    const kapsam = await tmKapsaminiCoz(db, 'tm1', sorgu);
    assert.equal((await tmKapsamPuaniniOku(db, kapsam, sorgu)).puan, puan);
    assert.deepEqual(okunan, ids);
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
  assert.deepEqual(nedirKatalogu('tm'), nedirKatalogu('bm'));
});
