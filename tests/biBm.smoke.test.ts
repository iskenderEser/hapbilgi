import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { bmPuaniniOku } from '../lib/bi/bmPuan.ts';
import { BM_PUAN_BASLIKLARI, puanBaglaminiOku, type PuanSorgusu } from '../lib/bi/puanSozlesmesi.ts';
import { nedirSorusunuCoz, nedirKatalogu } from '../lib/bi/nedir.ts';

const temel: PuanSorgusu = { olcut: 'toplam_net', zaman: 'ay', geriye: 0, karsilastir: false };
const simdi = new Date('2026-09-09T12:00:00+03:00');
const kazanclar: Record<string, number> = { izleme: 100, cevaplama: 40, extra: 20, cc_gonderme: 10, cc_referral: 30 };
function ortam(hatali = false, eksik = false, cok = false) {
  const cagrilar: Array<{ tablo: string; id?: string; bas?: string; bit?: string; offset?: number }> = [];
  const db = { from(tablo: string) {
    assert.ok(['cc_kazanilan_puanlar', 'cc_ileri_sarma_kayitlari', 'cc_yanlis_cevap_kayitlari'].includes(tablo));
    let turler: string[] = [];
    const cagri: typeof cagrilar[number] = { tablo };
    const q = {
      select() { return q; },
      eq(alan: string, id: string) { assert.equal(alan, 'bm_id'); cagri.id = id; return q; },
      gte(alan: string, bas: string) { assert.equal(alan, 'created_at'); cagri.bas = bas; return q; },
      lte(alan: string, bit: string) { assert.equal(alan, 'created_at'); cagri.bit = bit; return q; },
      in(alan: string, v: string[]) { assert.equal(alan, 'puan_turu'); turler = v; return q; },
      order(alan: string) { assert.equal(alan, tablo === 'cc_kazanilan_puanlar' ? 'puan_id' : 'kayit_id'); return q; },
      async range(offset: number) {
        cagrilar.push({ ...cagri, offset });
        if (hatali) return { data: null, error: {} };
        const data = tablo === 'cc_kazanilan_puanlar'
          ? (cok ? Array.from({ length: offset === 0 ? 500 : 1 }, () => ({ puan: 10 })) : turler.map(t => ({ puan: kazanclar[t] })))
          : [{ kaybedilen_puan: tablo === 'cc_ileri_sarma_kayitlari' ? 5 : 3 }];
        return { data: eksik ? [{}] : data, error: null };
      },
    }; return q;
  } } as unknown as SupabaseClient;
  return { db, cagrilar };
}

test('BM 10 puan × 4 zaman kendi C-Club defterlerinden hesaplanır', async () => {
  const beklenen: Record<string, number> = { ...kazanclar, ileri_sarma: 5, yanlis_cevap: 3, toplam_kazanc: 200, toplam_kayip: 8, toplam_net: 192 };
  for (const olcut of Object.keys(BM_PUAN_BASLIKLARI) as Array<keyof typeof BM_PUAN_BASLIKLARI>) {
    for (const zaman of ['hafta','ay','donem','yil'] as const) {
      const { db, cagrilar } = ortam();
      const s = { ...temel, olcut, zaman };
      const sonuc = await bmPuaniniOku(db, 'oturum-bm', 'bm', s, simdi);
      assert.equal(sonuc.puan, beklenen[olcut], `${olcut}/${zaman}`);
      for (const cagri of cagrilar) {
        assert.equal(cagri.id, 'oturum-bm');
        assert.equal(cagri.bas, sonuc.donem.baslangic);
        assert.equal(cagri.bit, sonuc.donem.bitis);
      }
    }
  }
});

test('BM sayfalama, kaynak hatası, eksik değer ve rol sınırları', async () => {
  const cok = ortam(false, false, true);
  assert.equal((await bmPuaniniOku(cok.db, 'bm', 'bm', { ...temel, olcut: 'cc_gonderme' }, simdi)).puan, 5010);
  assert.deepEqual(cok.cagrilar.map(c => c.offset), [0, 500]);
  await assert.rejects(bmPuaniniOku(ortam(true).db, 'bm', 'bm', temel, simdi), /VERI_OKUNAMADI/);
  await assert.rejects(bmPuaniniOku(ortam(false, true).db, 'bm', 'bm', temel, simdi), /VERI_EKSIK/);
  for (const rol of ['utt','kd_utt','tm']) await assert.rejects(bmPuaniniOku(ortam().db, 'bm', rol, temel, simdi), /ROL_DESTEKLENMIYOR/);
  for (const olcut of ['eclub','oneri','oneri_kaybi'] as const) {
    assert.equal(puanBaglaminiOku({ ...temel, olcut }, 'bm'), undefined);
    await assert.rejects(bmPuaniniOku(ortam().db, 'bm', 'bm', { ...temel, olcut }, simdi), /ROL_DESTEKLENMIYOR/);
  }
  assert.equal(puanBaglaminiOku({ ...temel, olcut: 'cc_referral' }, 'utt'), undefined);
});

test('BM NEDİR ortak metinleri korur, challenge kavramlarını ve erişilebilir E-Club bağlantısını sunar', () => {
  for (const konu of nedirKatalogu('utt')) {
    const bm = nedirKatalogu('bm').find(k => k.id === konu.id)!;
    assert.equal(bm.cevap, konu.cevap);
  }
  for (const soru of ['Challenge nedir?', 'Challenge gönderme puanı nedir?', 'Referral puanı nedir?']) {
    assert.equal(nedirSorusunuCoz(soru, 'bm').durum, 'bulundu');
    assert.equal(nedirSorusunuCoz(soru, 'utt').durum, 'tanim_yok');
  }
  const sonuc = nedirSorusunuCoz('E-Club nedir?', 'bm');
  assert.equal(sonuc.durum, 'bulundu');
  if (sonuc.durum === 'bulundu') assert.equal(sonuc.konu.aksiyon?.url, '/eclub/raporlar');
});
