import assert from 'node:assert/strict';
import test from 'node:test';
import { yonLinkleri, yonlendirmeYaniti, KAPSAM_DISI_MESAJ } from '../lib/bi/yonlendirme.ts';
import { geminiIleKacSorusunuCoz } from '../lib/bi/gemini.ts';

test('Yönlendirme rol ve konu ayrımını, kapalı modülleri korur', () => {
  assert.deepEqual(yonLinkleri('utt', 'tclub_ligi').map(x => x.url), ['/hbligi']);
  assert.deepEqual(yonLinkleri('bm', 'tclub').map(x => x.url), ['/raporlar/bm', '/hbligi']);
  assert.deepEqual(yonLinkleri('bm', 'cclub', true).map(x => x.url), ['/challenge-club', '/cc-ligi']);
  assert.deepEqual(yonLinkleri('tm', 'cclub', true).map(x => x.url), ['/cc-ligi']);
  assert.deepEqual(yonLinkleri('utt', 'cclub', true), []);
  assert.deepEqual(yonLinkleri('bm', 'cclub', false), []);
  assert.deepEqual(yonLinkleri('utt', 'eclub', false, false), []);
  assert.deepEqual(yonLinkleri('utt', 'eclub', false, true).map(x => x.url), ['/eclub/raporlar', '/eclub/ligi']);
  for (const rol of ['ik_drk','ik_md','ik_yrd_md','ik_uz','ik_per']) {
    assert.equal(yonLinkleri(rol, 'kendi_uretim')[0].url, '/raporlar/uretici');
    assert.equal(yonLinkleri(rol, 'firma_uretim')[0].url, '/raporlar/uretim');
    assert.equal(yonLinkleri(rol, 'tclub')[0].url, '/raporlar/tclub-uretici');
    assert.equal(yonLinkleri(rol, 'talepler')[0].url, '/talepler');
    assert.equal(yonLinkleri(rol, 'yayinlar')[0].url, '/yayin-yonetimi');
  }
});

test('Kapsam dışı ifade aynen korunur, veri okunmuş gibi kaynak gösterilmez', async () => {
  const db = { from: () => { throw new Error('Veri okunmamalı'); } } as never;
  const dis = await yonlendirmeYaniti(db, 'id', 'bm', 'platform_disi');
  assert.equal(dis.cevap, KAPSAM_DISI_MESAJ);
  assert.deepEqual(dis.yonlendirmeler, []);
  const lig = await yonlendirmeYaniti(db, 'id', 'utt', 'tclub_ligi');
  assert.match(lig.cevap, /T-Club Ligi linkini tıklamanızı önerebilirim/);
  assert.deepEqual(lig.kaynaklar, []);
});

test('Gemini mevcut çağrıda yönlendirme konusunu taşır, URL kabul etmez', async t => {
  const eskiModel = process.env.GEMINI_MODEL;
  process.env.GEMINI_MODEL = 'test';
  t.after(() => { if (eskiModel === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = eskiModel; });
  const eski = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test';
  t.after(() => { if (eski === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = eski; });
  let yon = 'tclub_ligi';
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.ok(body.generationConfig.responseJsonSchema.required.includes('yon'));
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ istek: 'kac_sorusu_degil', yon, olcut: 'toplam_net', zaman: 'ay', geriye: 0, karsilastir: false }) }] } }] });
  });
  assert.equal((await geminiIleKacSorusunuCoz('t club ligine nasıl ulaşabilirim?')).yon, 'tclub_ligi');
  yon = 'platform_disi';
  assert.equal((await geminiIleKacSorusunuCoz('Fenerbahçe şampiyon olur mu?')).yon, 'platform_disi');
  yon = 'https://example.com';
  assert.equal((await geminiIleKacSorusunuCoz('bir link')).yon, 'genel');
});
