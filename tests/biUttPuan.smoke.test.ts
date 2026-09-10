import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PUAN_BASLIKLARI, puanBaglaminiOku, uttPuanDonemi, uttPuaniniOku, type UttPuanSorgusu } from '../lib/bi/uttPuan.ts';
const simdi = new Date('2026-09-09T12:00:00+03:00');
const temel: UttPuanSorgusu = { olcut: 'toplam_net', zaman: 'ay', geriye: 0, karsilastir: false };
test('11 puan × 4 zaman: beş kazanç, üç kayıp ve toplamlar aynı kaynaklarla hesaplanır', async () => {
  const beklenen = { izleme: 100, cevaplama: 40, extra: 20, oneri: 10, eclub: 30,
    ileri_sarma: 5, yanlis_cevap: 3, oneri_kaybi: 2, toplam_kazanc: 200, toplam_kayip: 10, toplam_net: 190 };
  const db = {
    async rpc(_ad: string, args: Record<string,string>) {
      assert.equal(args.p_kullanici_id, 'oturum-kimligi');
      assert.ok(args.p_baslangic < args.p_bitis);
      return { data: [{
        video_puani: 100,
        soru_puani: 40,
        extra_puan: 20,
        oneri_puani: 10,
        eclub_puani: 30,
        ileri_sarma_kaybi: 5,
        yanlis_cevap_kaybi: 3,
        oneri_kaybi: 2,
        toplam_net_puan: 190,
      }], error: null };
    },
    from(_tablo: string) {
      assert.fail('eclub_utt_puanlari tablosuna ikinci sorgu yapılmamalı');
    },
  } as unknown as SupabaseClient;
  for (const olcut of Object.keys(PUAN_BASLIKLARI) as Array<keyof typeof PUAN_BASLIKLARI>) {
    for (const zaman of ['hafta','ay','donem','yil'] as const) {
      const sonuc = await uttPuaniniOku(db, 'oturum-kimligi', 'utt', { ...temel, olcut, zaman }, simdi);
      assert.equal(sonuc.puan, beklenen[olcut], `${olcut}/${zaman}`);
    }
  }
  await assert.rejects(uttPuaniniOku(db, 'oturum-kimligi', 'bm', temel), /ROL_DESTEKLENMIYOR/);
});
test('Önceki aralıklar sınır gününü içermez; takip iki ay önceye ulaşır', () => {
  assert.equal(uttPuanDonemi({ ...temel, geriye: 1 }, simdi).bitis, '2026-08-31T20:59:59.999Z');
  assert.equal(uttPuanDonemi({ ...temel, geriye: 2 }, simdi).baslangic, '2026-06-30T21:00:00.000Z');
  assert.equal(uttPuanDonemi({ ...temel, zaman: 'donem' }, simdi).bitis, '2026-09-08T20:59:59.999Z');
  assert.equal(uttPuanDonemi({ ...temel, zaman: 'yil', geriye: 1 }, simdi).baslangic, '2024-12-31T21:00:00.000Z');
  assert.equal(puanBaglaminiOku({ ...temel, geriye: -1 }), undefined);
});

test('E-Club RPC üzerinden tek seferde okunur; ikinci sorgu yapılmaz; hata ve eksik değer doğru yönetilir', async () => {
  const dbHata = {
    async rpc() { return { data: null, error: { message: 'rpc hatası' } }; },
    from() { assert.fail('from() çağrılmamalı'); },
  } as unknown as SupabaseClient;
  await assert.rejects(uttPuaniniOku(dbHata, 'utt', 'utt', { ...temel, olcut: 'eclub' }, simdi), /VERI_OKUNAMADI/);

  const dbBos = {
    async rpc() { return { data: [], error: null }; },
    from() { assert.fail('from() çağrılmamalı'); },
  } as unknown as SupabaseClient;
  await assert.rejects(uttPuaniniOku(dbBos, 'utt', 'utt', { ...temel, olcut: 'eclub' }, simdi), /KAYIT_YOK/);

  const dbEksik = {
    async rpc() { return { data: [{ video_puani: null, eclub_puani: null, toplam_net_puan: null }], error: null }; },
    from() { assert.fail('from() çağrılmamalı'); },
  } as unknown as SupabaseClient;
  await assert.rejects(uttPuaniniOku(dbEksik, 'utt', 'utt', { ...temel, olcut: 'eclub' }, simdi), /VERI_EKSIK/);
  await assert.rejects(uttPuaniniOku(dbEksik, 'utt', 'utt', { ...temel, olcut: 'toplam_net' }, simdi), /VERI_EKSIK/);
  await assert.rejects(uttPuaniniOku(dbEksik, 'utt', 'utt', { ...temel, olcut: 'toplam_kazanc' }, simdi), /VERI_EKSIK/);
  await assert.rejects(uttPuaniniOku(dbEksik, 'utt', 'utt', { ...temel, olcut: 'toplam_kayip' }, simdi), /VERI_EKSIK/);
});
