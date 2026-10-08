import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { firmaEclubDurumu } from '@/lib/firma/eclubDurumu';
import { raporBolumleriniSec, raporModulDurumunuUygula } from '@/lib/rapor/paylasilan/eclubDurumu';

const bolumler = ['Yayın Tamamlama','Cevaplama','Öneri','Extra','E-Club','İleri sarma','Yanlış cevap','Öneri kaybı'].map(ad => ({ad}));
const katki = {netPuan:145,bolge:{toplam:200,yuzde:72.5},takim:{toplam:500,yuzde:29},firma:{toplam:1000,yuzde:14.5}};
const rapor = {hucreler:[{kategori:'urun',arac:'tumu',degerler:{tamamlama_puani:100,eclub_kazanim:3}}],katki,temsilciSayisi:2,kisiBasiNetPuan:72.5,karsilastirma:{hucreler:[],katki:{...katki,netPuan:40},temsilciSayisi:1,kisiBasiNetPuan:40}};

test('Kapalı E-Club yalnız kendi kartını kaldırır; kalan kartların sırası değişmez', () => {
  assert.deepEqual(raporBolumleriniSec(bolumler,false).map(b=>b.ad),bolumler.filter(b=>b.ad!=='E-Club').map(b=>b.ad));
  assert.equal(raporBolumleriniSec(bolumler,false).length,7);
  assert.equal(bolumler.length,8);
});

test('Açma, kapama ve yeniden açma geçmiş puanları ve katkıları değiştirmez', () => {
  const acik=raporModulDurumunuUygula(rapor,true),kapali=raporModulDurumunuUygula(acik,false),yeniden=raporModulDurumunuUygula(kapali,true);
  for(const sonuc of [acik,kapali,yeniden]) {
    assert.strictEqual(sonuc.katki,rapor.katki);assert.strictEqual(sonuc.hucreler,rapor.hucreler);
    assert.strictEqual(sonuc.karsilastirma,rapor.karsilastirma);
    assert.equal(sonuc.kisiBasiNetPuan,72.5);assert.equal(sonuc.temsilciSayisi,2);
  }
  assert.equal(kapali.eclub_acik,false);assert.equal(yeniden.eclub_acik,true);
  assert.equal(raporBolumleriniSec(bolumler,yeniden.eclub_acik).length,8);
});

test('UTT, BM ve TM normal/karşılaştırma görünümlerinde ortak görünürlük kuralını kullanır', () => {
  for(const rol of ['utt','bm','tm']) for(const gorunum of ['rapor','karsilastirma']) {
    const kapali=raporModulDurumunuUygula({...rapor,rol,gorunum},false);
    assert.ok(!raporBolumleriniSec(bolumler,kapali.eclub_acik).some(b=>b.ad==='E-Club'));
    assert.equal(kapali.katki.netPuan,145);assert.equal(kapali.karsilastirma.katki.netPuan,40);
  }
});

test('Firma modül durumu oturum firmasından okunur; eksik veya hatalı durumda hata döner', async () => {
  let durum: boolean | null=true, hata=false;
  const c={select(k:string){assert.equal(k,'eclub_aktif');return c;},eq(k:string,v:string){assert.equal(k,'firma_id');assert.equal(v,'f1');return c;},single(){return Promise.resolve({data:{eclub_aktif:durum},error:hata?{message:'kesildi'}:null});}};
  const db={from(t:string){assert.equal(t,'firmalar');return c;}} as unknown as SupabaseClient;
  assert.equal(await firmaEclubDurumu(db,'f1'),true);
  durum=false;assert.equal(await firmaEclubDurumu(db,'f1'),false);
  durum=null;await assert.rejects(firmaEclubDurumu(db,'f1'),/modül durumu/);
  hata=true;await assert.rejects(firmaEclubDurumu(db,'f1'),/modül durumu/);
  await assert.rejects(firmaEclubDurumu(db,null),/Firma bilgisi eksik/);
});
