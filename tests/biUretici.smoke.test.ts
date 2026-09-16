import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ureticiSayisiniOku, durumSayimaUyar } from '../lib/bi/ureticiVeri.ts';
import { ureticiBaglaminiOku, ureticiDonemi, type UreticiSorgusu } from '../lib/bi/ureticiSozlesmesi.ts';
import { geminiUreticiSorusunuCoz } from '../lib/bi/geminiUretici.ts';
import { nedirSorusunuCoz } from '../lib/bi/nedir.ts';

const temel: UreticiSorgusu = { alan: 'uretim', olcut: 'talep_toplam', egitim: 'tumu', arac: 'tumu', zaman: 'simdi', geriye: 0, karsilastir: false };
const simdi = new Date('2026-09-09T15:00:00+03:00');
function ortam(hatali = false, adet = 6) {
  const talepler = Array.from({ length: adet }, (_, i) => ({ talep_id: 't'+i, uretici_id: 'ik1', firma_id: 'f1',
    created_at: '2026-09-01T00:00:00+03:00', egitim_turu: i % 2 ? 'yonetim_egitimi' : 'ik_egitimi', ogrenme_araci_turu: 'podcast',
    hazir_video: true, yayin_oncesi_silme_durumu: null, yayin_oncesi_silme_tarihi: null }));
  const yabanci = { ...talepler[0], talep_id: 'yabanci', uretici_id: 'ik2' };
  const okumalar: string[] = [];
  const db = { from(tablo: string) {
    okumalar.push(tablo);
    const filtreler: Array<(r: Record<string, unknown>) => boolean> = [];
    const esler: Record<string, unknown> = {};
    let b = 0, e = 999;
    const sonuc = () => {
      if (hatali) return { data: null, error: {} };
      let satirlar: Record<string, unknown>[] = [];
      if (tablo === 'talepler') {
        assert.equal(esler.uretici_id, 'ik1'); assert.equal(esler.firma_id, 'f1');
        satirlar = [...talepler, yabanci];
      }
      if (tablo === 'v_uretici_icerik_takip') satirlar = talepler.map(t => ({ talep_id: t.talep_id, video_id: 'v', video_durum: 'onaylandi',
        soru_seti_id: 's', soru_seti_durum: 'onaylandi', yayin_durum: null }));
      if (tablo === 'uretim_gorevleri') satirlar = [{ talep_id: 't0', durum: 'inceleme_bekliyor' }, { talep_id: 't1', durum: 'revizyon_bekliyor' }];
      if (tablo === 'v_yayin_kunye') {
        assert.equal(esler.uretici_id, 'ik1'); assert.equal(esler.firma_id, 'f1');
        satirlar = talepler.map(t => ({ talep_id: t.talep_id, yayin_id: 'y'+t.talep_id, uretici_id: 'ik1', firma_id: 'f1' }));
      }
      if (tablo === 'yayin_yonetimi') satirlar = ['yayinda','planlandi','Durduruldu'].map((durum,i) =>
        ({ yayin_id: 'yt'+i, uretici_id: 'ik1', durum }));
      if (tablo === 'yayin_tekrar_kayitlari') satirlar = [
        { yayin_id: 'yt0', tur_no: 1, baslangic_tarihi: '2026-09-02T00:00:00Z' },
        { yayin_id: 'yt0', tur_no: 2, baslangic_tarihi: '2026-09-03T00:00:00Z' },
        { yayin_id: 'yt2', tur_no: 1, baslangic_tarihi: '2026-08-02T00:00:00Z' },
      ];
      return { data: satirlar.filter(r => filtreler.every(f => f(r))).slice(b,e+1), error: null };
    };
    const q = {
      select() { return q; },
      eq(k: string, v: unknown) { esler[k] = v; filtreler.push(r => r[k] === v); return q; },
      in(k: string, v: unknown[]) { filtreler.push(r => v.includes(r[k])); return q; },
      gte(k: string, v: string) { filtreler.push(r => Date.parse(String(r[k])) >= Date.parse(v)); return q; },
      lte(k: string, v: string) { filtreler.push(r => Date.parse(String(r[k])) <= Date.parse(v)); return q; },
      order() { return q; }, range(bas: number, son: number) { b=bas; e=son; return q; },
      async maybeSingle() {
        assert.equal(esler.kullanici_id, 'ik1');
        return { data: { firma_id: 'f1', rol: 'ik_md', aktif_mi: true }, error: null };
      },
      then(resolve: (v: ReturnType<typeof sonuc>) => unknown) { return Promise.resolve(sonuc()).then(resolve); },
    }; return q;
  } } as unknown as SupabaseClient;
  return { db, okumalar };
}
test('İK sayımları kendi talepleri, görevleri ve yayınlarıyla sınırlı; ilk tur tekrar sayılmaz', async () => {
  const beklenen = { talep_toplam: 6, talep_acilan: 6, uretimde: 2, inceleme: 1, revizyon: 1, yayin_bekleyen: 4,
    yayinda: 1, planlanan: 1, durdurulan: 1, yayina_alinan: 1 };
  for (const [olcut, adet] of Object.entries(beklenen)) {
    const s = { ...temel, olcut: olcut as UreticiSorgusu['olcut'], zaman: olcut === 'talep_acilan' || olcut === 'yayina_alinan' ? 'ay' as const : 'simdi' as const };
    assert.equal((await ureticiSayisiniOku(ortam().db, 'ik1','ik_md',s,simdi)).adet, adet, olcut);
  }
  assert.equal((await ureticiSayisiniOku(ortam().db, 'ik1','ik_md',{...temel, egitim:'ik_egitimi'},simdi)).adet,3);
  assert.equal((await ureticiSayisiniOku(ortam().db, 'ik1','ik_md',{...temel, arac:'video'},simdi)).adet,0);
  assert.equal((await ureticiSayisiniOku(ortam(false,51).db, 'ik1','ik_md',temel,simdi)).adet,51);
  await assert.rejects(ureticiSayisiniOku(ortam(true).db,'ik1','ik_md',temel,simdi), /VERI_OKUNAMADI/);
  assert.throws(() => durumSayimaUyar('sistem_hatasi','uretimde'), /VERI_EKSIK/);
});
test('İK beş unvanında sözleşme aynı; geçmiş durum ve başka eğitim/rol reddedilir', () => {
  for (const rol of ['ik_drk','ik_md','ik_yrd_md','ik_uz','ik_per']) {
    assert.deepEqual(ureticiBaglaminiOku(temel,rol),temel);
    assert.equal(nedirSorusunuCoz('Revizyon nedir?',rol).durum,'bulundu');
    assert.equal(nedirSorusunuCoz('Yönetim eğitimi nedir?',rol).durum,'bulundu');
  }
  for (const v of [{...temel, zaman:'ay'}, {...temel, egitim:'urun_egitimi'}, {...temel, karsilastir:true},
    {...temel, olcut:'talep_acilan'}, {...temel, olcut:'constructor'}])
    assert.equal(ureticiBaglaminiOku(v,'ik_md'),undefined);
  assert.deepEqual(ureticiBaglaminiOku(temel,'pm'),temel);
  const donem = ureticiDonemi({...temel,olcut:'talep_acilan',zaman:'donem'},simdi);
  assert.equal(donem.baslangic,'2026-06-30T21:00:00.000Z');
  assert.equal(donem.bitis,'2026-09-08T20:59:59.999Z');
});
test('Üretici Gemini yanıtı doğrulanır; istemci kimliği ve puan bağlamı taşınmaz', async t => {
  const key = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY='test'; process.env.GEMINI_MODEL='test';
  t.after(() => { if(key===undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY=key;
    if(model===undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL=model; });
  let cikti: unknown = { ...temel, istek:'bulundu' };
  t.mock.method(globalThis,'fetch',async (_url: string, init: RequestInit) => {
    assert.doesNotMatch(String(init.body),/foreign-user/);
    return Response.json({ candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(cikti)}]}}] });
  });
  assert.deepEqual(await geminiUreticiSorusunuCoz('Kaç talebim var?','ik_md',{uretici_id:'foreign-user'}),{durum:'bulundu',sorgu:temel});
  cikti={...temel,istek:'bulundu',zaman:'ay'};
  assert.deepEqual(await geminiUreticiSorusunuCoz('Geçen ay revizyonda kaç iş vardı?','ik_md'),{durum:'baglanti_hatasi'});
  cikti={...temel,istek:'desteklenmiyor'};
  assert.deepEqual(await geminiUreticiSorusunuCoz('Firma toplamı?','ik_md'),{durum:'desteklenmiyor'});
});

test('Eğitim filtresi yeteneklerden gelir; İK ve eğitim türleri birbirine karışmaz', () => {
 for (const rol of ['egt_md','egt_yrd_md','egt_yon','egt_uz']) {
 assert.ok(ureticiBaglaminiOku({...temel, egitim:'satis_teknikleri'}, rol));
 assert.ok(ureticiBaglaminiOku({...temel, egitim:'yonetim_egitimi'}, rol));
 assert.equal(ureticiBaglaminiOku({...temel, egitim:'ik_egitimi'}, rol), undefined);
 assert.equal(nedirSorusunuCoz('Satış teknikleri nedir?',rol).durum, 'bulundu');
 }
 assert.equal(ureticiBaglaminiOku({...temel, egitim:'satis_teknikleri'}, 'ik_md'),undefined);
});
