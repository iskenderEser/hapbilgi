import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getYoneticiDavranis } from '@/lib/rapor/yonetici/getYoneticiDavranis';

const bas = '2026-10-01T00:00:00+03:00', bit = '2026-10-08T23:59:59+03:00';
const takimlar = [
  { firma_id: 'f1', takim_id: 't1', takim_adi: 'Şimşek' },
  { firma_id: 'f1', takim_id: 't2', takim_adi: 'Yıldız' },
  { firma_id: 'f1', takim_id: 't0', takim_adi: 'Zirve' },
  { firma_id: 'f2', takim_id: 'dis', takim_adi: 'Başka Firma' },
];
const kisi = (id: string, firma: string, takim: string, bolge: string, rol: string, puan = 0) => ({
  kullanici_id: id, ad: id, soyad: rol, firma_id: firma, takim_id: takim, bolge_id: bolge, rol, aktif_mi: true, toplam_net_puan: puan,
});
const kisiler = [
  kisi('bm1', 'f1', 't1', 'b1', 'bm'), kisi('bm2', 'f1', 't1', 'b2', 'bm'),
  kisi('bm3', 'f1', 't2', 'b3', 'bm'), kisi('dis-bm', 'f2', 'dis', 'dis-b', 'bm'),
  kisi('u1', 'f1', 't1', 'b1', 'utt', 100), kisi('u2', 'f1', 't1', 'b2', 'kd_utt', 50),
  kisi('u3', 'f1', 't2', 'b3', 'utt', 50), kisi('dis-u', 'f2', 'dis', 'dis-b', 'utt', 999),
];
function veriTabani(bos = false) {
  const sorgular: Array<{ tablo: string; filtreler: Record<string, unknown> }> = [];
  const db = {
    from(tablo: string) {
      const sorgu = { tablo, filtreler: {} as Record<string, unknown> }; sorgular.push(sorgu);
      const c = {
        select() { return c; }, order() { return c; }, lte() { return c; },
        eq(k: string, v: unknown) { sorgu.filtreler[k] = v; return c; },
        in(k: string, v: unknown[]) { sorgu.filtreler[k] = v; return c; },
        range(a: number, b: number) {
          const rows = tablo === 'takimlar' ? (bos ? [] : takimlar) : tablo === 'kullanicilar' ? kisiler : [];
          return Promise.resolve({ data: rows.filter(r => Object.entries(sorgu.filtreler).every(([k, v]) => Array.isArray(v) ? v.includes((r as Record<string, unknown>)[k]) : (r as Record<string, unknown>)[k] === v)).slice(a, b + 1), error: null });
        },
        then(resolve: (v: unknown) => unknown) { return c.range(0, 499).then(resolve); },
      };
      return c;
    },
    rpc(_ad: string, args: Record<string, string>) {
      sorgular.push({ tablo: 'rpc', filtreler: args });
      const c = { select() { return c; }, order() { return c; }, range(a: number, b: number) {
        return Promise.resolve({ data: kisiler.filter(k => k.rol !== 'bm' && k.firma_id === args.p_firma_id && (!args.p_takim_id || k.takim_id === args.p_takim_id)).slice(a, b + 1), error: null });
      } };
      return c;
    },
  } as unknown as SupabaseClient;
  return { db, sorgular };
}

test('Yönetici firma takımlarını gerçek adlarıyla alır; varsayılan takım raporu TM hesabıyla aynıdır', async () => {
  const { db } = veriTabani();
  const r = await getYoneticiDavranis(db, { firma_id: 'f1' }, bas, bit, '', '', '', '', true);
  assert.deepEqual(r.takimlar, [{ id: 't1', ad: 'Şimşek' }, { id: 't2', ad: 'Yıldız' }, { id: 't0', ad: 'Zirve' }]);
  assert.equal(r.takimId, 't1'); assert.equal(r.katki.netPuan, 150); assert.equal(r.katki.firma?.yuzde, 75);
  assert.deepEqual(r.bmler.map(k => k.kullanici_id), ['bm1', 'bm2']);
  assert.equal(JSON.stringify(r).includes('dis-u'), false);
});

test('Yönetici takım → BM → UTT kapsamını daraltır; farklı takım ayrı toplam getirir', async () => {
  const { db } = veriTabani();
  const kisi = await getYoneticiDavranis(db, { firma_id: 'f1' }, bas, bit, 't1', 'bm1', 'u1', '', true);
  assert.equal(kisi.katki.netPuan, 100); assert.equal(kisi.katki.takim?.yuzde, 66.7);
  const ikinci = await getYoneticiDavranis(db, { firma_id: 'f1' }, bas, bit, 't2', '', '', '', true);
  assert.equal(ikinci.takimId, 't2'); assert.equal(ikinci.katki.netPuan, 50);
  assert.deepEqual(ikinci.bmler.map(k => k.kullanici_id), ['bm3']);
});

test('Firma dışı takım, seçilen takım dışı BM ve bölge dışı UTT engellenir', async () => {
  const { db, sorgular } = veriTabani();
  await assert.rejects(getYoneticiDavranis(db, { firma_id: 'f1' }, bas, bit, 'dis'), /erişim/);
  assert.ok(sorgular.every(s => s.tablo === 'takimlar'));
  await assert.rejects(getYoneticiDavranis(db, { firma_id: 'f1' }, bas, bit, 't1', 'bm3'), /erişim/);
  await assert.rejects(getYoneticiDavranis(db, { firma_id: 'f1' }, bas, bit, 't1', 'bm1', 'u2'), /erişim/);
});

test('Yönetici karşılaştırması aynı takımın iki bölgesini aynı dönemde karşılaştırır', async () => {
  const { db } = veriTabani();
  const r = await getYoneticiDavranis(db, { firma_id: 'f1' }, bas, bit, 't1', 'bm1', '', 'bm2', true);
  assert.ok('karsilastirma' in r);
  assert.equal(r.katki.netPuan, 100); assert.equal(r.karsilastirma.katki.netPuan, 50);
  assert.equal(r.baslangic, r.karsilastirma.baslangic); assert.equal(r.bitis, r.karsilastirma.bitis);
  await assert.rejects(getYoneticiDavranis(db, { firma_id: 'f1' }, bas, bit, 't1', 'bm1', '', 'bm3'), /erişim/);
});

test('Boş takım ve takımsız firma genel kişi sorgusuna dönüşmez', async () => {
  const { db } = veriTabani();
  const bosTakim = await getYoneticiDavranis(db, { firma_id: 'f1' }, bas, bit, 't0', '', '', '', true);
  assert.equal(bosTakim.katki.netPuan, 0); assert.deepEqual(bosTakim.bmler, []);
  const { db: bosDb, sorgular } = veriTabani(true);
  const bosFirma = await getYoneticiDavranis(bosDb, { firma_id: 'f1' }, bas, bit);
  assert.deepEqual(bosFirma.takimlar, []); assert.equal(bosFirma.katki.netPuan, 0);
  assert.ok(sorgular.every(s => s.tablo === 'takimlar'));
});
