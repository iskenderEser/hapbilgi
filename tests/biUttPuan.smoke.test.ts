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
      return { data: [{ video_puani: 100, soru_puani: 40, extra_puan: 20, oneri_puani: 10,
        ileri_sarma_kaybi: 5, yanlis_cevap_kaybi: 3, oneri_kaybi: 2 }], error: null };
    },
    from(tablo: string) {
      assert.equal(tablo, 'eclub_utt_puanlari');
      const q = { select() { return q; }, eq(alan: string, id: string) { assert.equal(alan, 'utt_id'); assert.equal(id, 'oturum-kimligi'); return q; },
        gte() { return q; }, lte() { return q; }, order() { return q; }, async range() { return { data: [{ puan: 30 }], error: null }; } }; return q;
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

test('E-Club kazanımı sayfa sınırında kesilmez; kaynak hatası sıfır veya eksik toplam üretmez', async () => {
  let hata = false;
  const araliklar: number[] = [];
  const db = {
    from() {
      const q = { select() { return q; }, eq() { return q; }, gte() { return q; }, lte() { return q; }, order() { return q; },
        async range(offset: number) {
          araliklar.push(offset);
          return hata ? { data: null, error: { message: 'hata' } }
            : { data: Array.from({ length: offset === 0 ? 500 : 1 }, () => ({ puan: 10 })), error: null };
        } }; return q;
    },
  } as unknown as SupabaseClient;
  const s = { ...temel, olcut: 'eclub' as const };
  assert.equal((await uttPuaniniOku(db, 'utt', 'utt', s, simdi)).puan, 5010);
  assert.deepEqual(araliklar, [0, 500]);
  hata = true;
  await assert.rejects(uttPuaniniOku(db, 'utt', 'utt', s, simdi), /VERI_OKUNAMADI/);
  const eksikDb = { async rpc() { return { data: [{ video_puani: null }], error: null }; } } as unknown as SupabaseClient;
  await assert.rejects(uttPuaniniOku(eksikDb, 'utt', 'utt', temel, simdi), /VERI_EKSIK/);
});
