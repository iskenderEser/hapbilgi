import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { bmPuaniniOku } from '../lib/bi/bmPuan.ts';
import { BM_PUAN_BASLIKLARI, puanBaglaminiOku, type PuanSorgusu } from '../lib/bi/puanSozlesmesi.ts';
import { nedirSorusunuCoz, nedirKatalogu } from '../lib/bi/nedir.ts';

const temel: PuanSorgusu = { olcut: 'toplam_net', zaman: 'ay', geriye: 0, karsilastir: false };
const simdi = new Date('2026-09-09T12:00:00+03:00');
const kazanclar: Record<string, number> = { izleme: 100, cevaplama: 40, extra: 20, cc_gonderme: 10, cc_referral: 30 };
function ortam(hatali = false, eksik = false, challengeKaybi = 10) {
  const cagrilar: Array<{ fn: string; p_bm_id?: string; p_baslangic?: string; p_bitis?: string }> = [];
  const db = {
    async rpc(fn: string, args: Record<string, unknown>) {
      assert.equal(fn, 'get_bm_puan_ozet');
      cagrilar.push({ fn, p_bm_id: String(args.p_bm_id), p_baslangic: String(args.p_baslangic), p_bitis: String(args.p_bitis) });
      if (hatali) return { data: null, error: { message: 'rpc hatası' } };
      if (eksik) return { data: [{ izleme_puani: null }], error: null };
      const izleme_puani = 100;
      const cevaplama_puani = 40;
      const extra_puan = 20;
      const cc_gonderme_puani = 10;
      const cc_referral_puani = 30;
      const ileri_sarma_kaybi = 5;
      const yanlis_cevap_kaybi = 3;
      const challenge_kaybi = challengeKaybi;
      const toplam_kazanc = izleme_puani + cevaplama_puani + extra_puan + cc_gonderme_puani + cc_referral_puani;
      const toplam_kayip = ileri_sarma_kaybi + yanlis_cevap_kaybi + challenge_kaybi;
      const toplam_net = toplam_kazanc - toplam_kayip;
      return {
        data: [{
          bm_id: args.p_bm_id,
          izleme_puani,
          cevaplama_puani,
          extra_puan,
          cc_gonderme_puani,
          cc_referral_puani,
          ileri_sarma_kaybi,
          yanlis_cevap_kaybi,
          challenge_kaybi,
          toplam_kazanc,
          toplam_kayip,
          toplam_net,
        }],
        error: null,
      };
    },
    from(_tablo: string) {
      assert.fail('Ayrı tablolara sorgu yapılmamalı, get_bm_puan_ozet RPC kullanılmalı');
    },
  } as unknown as SupabaseClient;
  return { db, cagrilar };
}

test('BM 10 puan × 4 zaman kendi C-Club defterlerinden hesaplanır', async () => {
  const beklenen: Record<string, number> = { ...kazanclar, ileri_sarma: 5, yanlis_cevap: 3, toplam_kazanc: 200, toplam_kayip: 18, toplam_net: 182 };
  for (const olcut of Object.keys(BM_PUAN_BASLIKLARI) as Array<keyof typeof BM_PUAN_BASLIKLARI>) {
    for (const zaman of ['hafta','ay','donem','yil'] as const) {
      const { db, cagrilar } = ortam();
      const s = { ...temel, olcut, zaman };
      const sonuc = await bmPuaniniOku(db, 'oturum-bm', 'bm', s, simdi);
      assert.equal(sonuc.puan, beklenen[olcut], `${olcut}/${zaman}`);
      for (const cagri of cagrilar) {
        assert.equal(cagri.p_bm_id, 'oturum-bm');
        assert.equal(cagri.p_baslangic, sonuc.donem.baslangic);
        assert.equal(cagri.p_bitis, sonuc.donem.bitis);
      }
    }
  }
});

test('BM RPC hatası, eksik değer, boş sonuç ve rol sınırları', async () => {
  await assert.rejects(bmPuaniniOku(ortam(true).db, 'bm', 'bm', temel, simdi), /VERI_OKUNAMADI/);
  await assert.rejects(bmPuaniniOku(ortam(false, true).db, 'bm', 'bm', temel, simdi), /VERI_EKSIK/);
  const bosDb = { async rpc() { return { data: [], error: null }; } } as unknown as SupabaseClient;
  await assert.rejects(bmPuaniniOku(bosDb, 'bm', 'bm', temel, simdi), /KAYIT_YOK/);
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
