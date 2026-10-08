import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ligEclubDurumu, ligModulDurumunuUygula } from '@/lib/tclub/hbligi/eclubDurumu';
import { getUttLig } from '@/lib/tclub/hbligi/getUttLig';
import { getSahaLig } from '@/lib/tclub/hbligi/getSahaLig';

const periyot = { periyot: 'yil' as const, yil: 2026, ay: 1, ceyrek: 1, hafta: 1 };
const ham = { kullanici_id: 'u1', ad: 'Ayşe', soyad: 'Yılmaz', rol: 'utt', firma_id: 'f', firma_adi: 'Firma', takim_id: 't', takim_adi: 'Takım', bolge_id: 'b', bolge_adi: 'İzmir', izleme_puani: 100, cevaplama_puani: 20, oneri_puani: 0, extra_puani: 0, eclub_puani: 30, ileri_sarma_kaybi: 5, yanlis_cevap_kaybi: 0, oneri_kaybi: 0, toplam_puan: 145 };

test('Modül durumu yalnız oturum firmasından okunur; açık ve kapalı ayrımı nettir', async () => {
  let durum = true;
  const c = {select(k:string){assert.equal(k,'eclub_aktif');return c;},eq(k:string,v:string){assert.equal(k,'firma_id');assert.equal(v,'f');return c;},single(){return Promise.resolve({data:{eclub_aktif:durum},error:null});}};
  const db = {from(t:string){assert.equal(t,'firmalar');return c;}} as unknown as SupabaseClient;
  assert.equal(await ligEclubDurumu(db,'f'),true);
  durum=false;assert.equal(await ligEclubDurumu(db,'f'),false);
});

test('Eksik firma veya belirsiz modül durumu sessizce kapalı kabul edilmez', async () => {
  const db = {from(){return {select(){return this;},eq(){return this;},single(){return Promise.resolve({data:{eclub_aktif:null},error:null});}};}} as unknown as SupabaseClient;
  await assert.rejects(ligEclubDurumu(db,null),/firma bilgisi eksik/);
  await assert.rejects(ligEclubDurumu(db,'f'),/modül durumu alınamadı/);
});

test('UTT, BM ve TM liglerinde kapatma eski E-Club puanını, sıralamayı ve kürsüyü değiştirmez', async () => {
  const db = {rpc:async()=>({data:[ham],error:null})} as unknown as SupabaseClient;
  const ligler = [
    await getUttLig(db,'u1',{firma_id:'f',takim_id:'t',bolge_id:'b'},periyot),
    await getSahaLig(db,{gorunum:'bm',firma_id:'f',takim_id:'t',bolge_id:'b'},periyot,new Date('2026-10-08T10:00:00Z')),
    await getSahaLig(db,{gorunum:'tm',firma_id:'f',takim_id:'t',bolge_id:null},periyot,new Date('2026-10-08T10:00:00Z')),
  ];
  for (const lig of ligler) {
    const acik = ligModulDurumunuUygula(lig,true), kapali = ligModulDurumunuUygula(lig,false);
    assert.equal(kapali.eclub_acik,false);assert.equal(acik.eclub_acik,true);
    assert.deepEqual(kapali.lig,acik.lig);assert.equal(kapali.lig[0].eclub_puani,30);
    assert.equal(kapali.lig[0].toplam_puan,145);
    assert.deepEqual(kapali.aylik_kursu,acik.aylik_kursu);
    assert.equal(lig.lig[0].eclub_puani,30);
  }
});

test('Baştan kapalı ligde puan yoktur; açılınca yeni kazanım eklenir ve tekrar kapanınca korunur', () => {
  const eski = { lig:[{...ham,eclub_puani:0,toplam_puan:115}] };
  const kapali = ligModulDurumunuUygula(eski,false);assert.equal(kapali.lig[0].toplam_puan,115);
  const yeni = ligModulDurumunuUygula({lig:[ham]},true);assert.equal(yeni.lig[0].toplam_puan,145);
  const tekrarKapali = ligModulDurumunuUygula(yeni,false);assert.equal(tekrarKapali.lig[0].toplam_puan,145);
  assert.equal(tekrarKapali.lig[0].eclub_puani,30);
});

test('Önbellekteki açık/kapalı bilgisi güncel firma durumuyla değiştirilirken kayıtlar korunur', () => {
  const cache = ligModulDurumunuUygula({lig:[ham]},true);
  const kapandi = ligModulDurumunuUygula(cache,false);assert.equal(kapandi.eclub_acik,false);assert.strictEqual(kapandi.lig,cache.lig);
  const acildi = ligModulDurumunuUygula(kapandi,true);assert.equal(acildi.eclub_acik,true);assert.strictEqual(acildi.lig,cache.lig);
});
