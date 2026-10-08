import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getUttKatki } from '@/lib/rapor/utt/getUttKatki';

const kullanici = { kullanici_id: 'utt-1', bolge_id: 'bolge-1', takim_id: 'takim-1', firma_id: 'firma-1' };
const bas = '2026-10-01T00:00:00+03:00', bit = '2026-10-08T23:59:59+03:00';
function kaynak(satirlar: Record<string, number[]>, hata = false) {
  const cagrilar: Array<{ args: Record<string, string>; offset: number }> = [];
  const db = { rpc(ad: string, args: Record<string, string>) {
    assert.equal(ad, 'get_kullanici_ozet');
    const key = args.p_kullanici_id ? 'kisi' : args.p_bolge_id ? 'bolge' : args.p_takim_id ? 'takim' : 'firma';
    return { select() { return this; }, order() { return this; }, range(offset: number, son: number) {
      cagrilar.push({ args, offset });
      return Promise.resolve({ data: (satirlar[key] ?? []).slice(offset, son + 1).map(toplam_net_puan => ({ toplam_net_puan })), error: hata ? { message: 'RPC başarısız' } : null });
    } };
  } } as unknown as SupabaseClient;
  return { db, cagrilar };
}

test('Bölge, takım ve firma katkıları aynı dönemin net puanlarıyla hesaplanır', async () => {
  const { db, cagrilar } = kaynak({ kisi: [80], bolge: [80, 20], takim: [80, 70, 50], firma: [80, 70, 50, 200] });
  const sonuc = await getUttKatki(db, kullanici, bas, bit);
  assert.deepEqual(sonuc, { netPuan: 80, bolge: { toplam: 100, yuzde: 80 }, takim: { toplam: 200, yuzde: 40 }, firma: { toplam: 400, yuzde: 20 } });
  for (const { args } of cagrilar) {
    assert.equal(args.p_baslangic, bas);
    assert.equal(args.p_bitis, bit);
    assert.ok(args.p_kullanici_id || args.p_bolge_id || args.p_takim_id || args.p_firma_id);
    if (!args.p_kullanici_id) assert.equal(args.p_firma_id, kullanici.firma_id);
  }
});

test('Eksik hiyerarşi kapsamı genel bir puan sorgusuna dönüşmez', async () => {
  const { db, cagrilar } = kaynak({ kisi: [12] });
  const sonuc = await getUttKatki(db, { ...kullanici, bolge_id: null, takim_id: null, firma_id: null }, bas, bit);
  assert.deepEqual(sonuc, { netPuan: 12, bolge: null, takim: null, firma: null });
  assert.equal(cagrilar.length, 1);
  assert.equal(cagrilar[0].args.p_kullanici_id, 'utt-1');
});

test('Büyük firma toplamı ilk 500 kayıtta kesilmez', async () => {
  const { db, cagrilar } = kaynak({ kisi: [1], bolge: [1], takim: [1], firma: Array(1001).fill(1) });
  const sonuc = await getUttKatki(db, kullanici, bas, bit);
  assert.equal(sonuc.firma?.toplam, 1001);
  assert.deepEqual(cagrilar.filter(c => !c.args.p_kullanici_id && !c.args.p_bolge_id && !c.args.p_takim_id).map(c => c.offset), [0, 500, 1000]);
});

test('Sıfır ve negatif kapsam toplamlarında tanımsız oran, negatif kişisel puanda gerçek oran gösterilir', async () => {
  const { db } = kaynak({ kisi: [-10], bolge: [0], takim: [-20], firma: [100] });
  const sonuc = await getUttKatki(db, kullanici, bas, bit);
  assert.equal(sonuc.bolge?.yuzde, null);
  assert.equal(sonuc.takim?.yuzde, null);
  assert.equal(sonuc.firma?.yuzde, -10);
});

test('Kaynak hatası sıfır katkı olarak sunulmaz', async () => {
  const { db } = kaynak({}, true);
  await assert.rejects(getUttKatki(db, kullanici, bas, bit), /Katkı puanları alınamadı/);
});
