import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getTmDavranis, getTmKarsilastirma, tmRaporKapsami } from '@/lib/rapor/tm/getTmDavranis';
const bas = '2026-10-01T00:00:00+03:00', bit = '2026-10-08T23:59:59+03:00';
const kisiler = [
  { kullanici_id: 'bm1', ad: 'Bir', soyad: 'BM', rol: 'bm', bolge_id: 'b1' },
  { kullanici_id: 'bm2', ad: 'İki', soyad: 'BM', rol: 'bm', bolge_id: 'b2' },
  { kullanici_id: 'u1', ad: 'Bir', soyad: 'UTT', rol: 'utt', bolge_id: 'b1' },
  { kullanici_id: 'u2', ad: 'İki', soyad: 'UTT', rol: 'kd_utt', bolge_id: 'b1' },
  { kullanici_id: 'u3', ad: 'Üç', soyad: 'UTT', rol: 'utt', bolge_id: 'b2' },
];

test('TM kapsamı takım → BM bölgesi → UTT zincirinde daralır', () => {
  assert.deepEqual(tmRaporKapsami(kisiler,'','').seciliIds, ['u1','u2','u3']);
  assert.deepEqual(tmRaporKapsami(kisiler,'bm1','').seciliIds, ['u1','u2']);
  assert.deepEqual(tmRaporKapsami(kisiler,'bm1','u2').seciliIds, ['u2']);
  assert.deepEqual(tmRaporKapsami(kisiler,'bm2','').bolgeUttleri.map(k => k.kullanici_id), ['u3']);
});

test('Dış BM, yanlış bölge UTTsi ve BM seçmeden kişisel erişim reddedilir', () => {
  assert.throws(() => tmRaporKapsami(kisiler,'dis',''), /erişim/);
  assert.throws(() => tmRaporKapsami(kisiler,'bm1','u3'), /erişim/);
  assert.throws(() => tmRaporKapsami(kisiler,'','u1'), /Önce/);
});

function veriTabani(uzun = false) {
  const sorgular: Array<{ tablo: string; filters: Record<string,unknown>; offset?: number }> = [];
  const liste = uzun ? [...kisiler, ...Array.from({length:1001},(_,i) => ({ kullanici_id: `ek${i}`,ad:'Ek',soyad:String(i),rol:'utt',bolge_id:'b2' }))] : kisiler;
  const puan = (id: string) => id === 'u1' ? 100 : id === 'u2' ? 50 : id === 'u3' ? 50 : 1;
  const db = { from(tablo: string) {
    const q = {tablo,filters:{}} as typeof sorgular[number]; sorgular.push(q);
    const c = {select() {return c;},eq(k: string,v:unknown){q.filters[k]=v;return c;},in(k:string,v:unknown){q.filters[k]=v;return c;},lte(){return c;},order(){return c;},range(a:number,b:number){q.offset=a;return Promise.resolve(result(a,b));},then(resolve:(v:unknown)=>void){return Promise.resolve(result()).then(resolve);} };
    function result(a=0,b=499){return {data:tablo==='kullanicilar'?liste.slice(a,b+1):tablo==='bolgeler'?[{bolge_id:'b1',bolge_adi:'İzmir'},{bolge_id:'b2',bolge_adi:'Ankara'}]:[],error:null};}
    return c;
  },rpc(_ad:string,args:Record<string,string>){
    const q={tablo:'rpc',filters:args} as typeof sorgular[number];sorgular.push(q);
    const c={select(){return c;},order(){return c;},range(a:number,b:number){q.offset=a; const rows=liste.filter(k=>k.rol!=='bm').map(k=>({kullanici_id:k.kullanici_id,toplam_net_puan:puan(k.kullanici_id)}));if(!args.p_takim_id)rows.push({kullanici_id:'diger-takim',toplam_net_puan:200});return Promise.resolve({data:rows.slice(a,b+1),error:null});}};return c;
  } } as unknown as SupabaseClient;
  return { db,sorgular };
}

test('Takım, bölge ve kişi aynı net puan kaynağını kullanır; seçimde kayıtlar tekrar çekilmez', async () => {
  const {db,sorgular}=veriTabani(); const k={firma_id:'f-test-tm',takim_id:'t-test-tm'};
  const takim=await getTmDavranis(db,k,bas,bit,'','',true);
  assert.equal(takim.katki.netPuan,200);assert.equal(takim.katki.firma?.yuzde,50);assert.equal(takim.temsilciler.length,0);assert.equal(takim.bmler.find(k=>k.kullanici_id==='bm1')?.altBilgi,'İzmir');
  sorgular.length=0;
  const bolge=await getTmDavranis(db,k,bas,bit,'bm1');
  assert.equal(bolge.katki.netPuan,150);assert.equal(bolge.katki.takim?.yuzde,75);
  assert.deepEqual(bolge.temsilciler.map(k=>k.kullanici_id),['u1','u2']);
  assert.equal(sorgular.filter(q=>q.tablo!=='kullanicilar' && q.tablo!=='bolgeler').length,0);
  const kisi=await getTmDavranis(db,k,bas,bit,'bm1','u1');
  assert.equal(kisi.katki.netPuan,100);assert.equal(kisi.katki.bolge?.yuzde,66.7);assert.equal(kisi.katki.takim?.yuzde,50);
  sorgular.length=0;
  await getTmDavranis(db,k,bas,bit,'bm1','u1',true);
  assert.ok(sorgular.some(q=>q.tablo==='izleme_kayitlari'));
});

test('Firma ve takım sınırı, aktif roller, dönem ve 1000 üstü sayfalama korunur', async () => {
  const {db,sorgular}=veriTabani(true);
  const r=await getTmDavranis(db,{firma_id:'buyuk-f',takim_id:'buyuk-t'},bas,bit,'','',true);
  assert.equal(r.katki.netPuan,1201);
  const users=sorgular.filter(q=>q.tablo==='kullanicilar');assert.deepEqual(users.map(q=>q.offset),[0,500,1000]);
  for(const q of users)assert.deepEqual(q.filters,{aktif_mi:true,firma_id:'buyuk-f',takim_id:'buyuk-t',rol:['utt','kd_utt','bm']});
  for(const q of sorgular.filter(q=>q.tablo==='rpc')){assert.equal(q.filters.p_firma_id,'buyuk-f');assert.equal(q.filters.p_baslangic,bas);assert.equal(q.filters.p_bitis,bit);}
});

test('Yetkisiz hedef veri sorgusu başlamadan engellenir ve eksik takım genel sorguya dönüşmez', async () => {
  const {db,sorgular}=veriTabani();
  await assert.rejects(getTmDavranis(db,{firma_id:'f',takim_id:'t'},bas,bit,'bm1','u3'),/erişim/);
  assert.ok(sorgular.every(q=>q.tablo==='kullanicilar'));
  await assert.rejects(getTmDavranis(db,{firma_id:'f',takim_id:''},bas,bit),/bilgisi eksik/);
});


test('TM karşılaştırması BM kişisel puanlarını değil iki bölgenin aynı dönemdeki UTT toplamlarını gösterir', async () => {
  const { db } = veriTabani();
  const r = await getTmKarsilastirma(db, { firma_id: 'tm-kiyas-f', takim_id: 'tm-kiyas-t' }, bas, bit, 'bm1', 'bm2', true);
  assert.equal(r.bmId, 'bm1'); assert.equal(r.karsilastirma.bmId, 'bm2');
  assert.equal(r.katki.netPuan, 150); assert.equal(r.karsilastirma.katki.netPuan, 50);
  assert.equal(r.temsilciSayisi, 2); assert.equal(r.karsilastirma.temsilciSayisi, 1);
  assert.equal(r.kisiBasiNetPuan, 75); assert.equal(r.karsilastirma.kisiBasiNetPuan, 50);
  assert.equal(r.baslangic, r.karsilastirma.baslangic); assert.equal(r.bitis, r.karsilastirma.bitis);
  assert.deepEqual(r.temsilciler.map(k => k.kullanici_id), ['u1','u2']);
  assert.deepEqual(r.karsilastirma.temsilciler.map(k => k.kullanici_id), ['u3']);
});

test('TM karşılaştırması aynı BM ve takım dışı BM seçimlerini reddeder', async () => {
  const { db, sorgular } = veriTabani();
  const k = { firma_id: 'tm-kiyas-red-f', takim_id: 'tm-kiyas-red-t' };
  await assert.rejects(getTmKarsilastirma(db,k,bas,bit,'bm1','bm1'), /iki farklı/);
  assert.equal(sorgular.length,0);
  await assert.rejects(getTmKarsilastirma(db,k,bas,bit,'bm1','dis'), /erişim/);
});
