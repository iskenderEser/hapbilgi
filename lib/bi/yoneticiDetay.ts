import type { SupabaseClient } from '@supabase/supabase-js';
import { YONETICI_ROLLER, URETICI_ROLLER } from '@/lib/utils/roller';
import { tekHedef } from '@/lib/bi/tmPuan';
import { bmPuaniniOku } from '@/lib/bi/bmPuan';
import { puanDonemi, BM_PUAN_BASLIKLARI, type PuanTuru } from '@/lib/bi/puanSozlesmesi';
import { URETICI_OLCUTLERI } from '@/lib/bi/ureticiSozlesmesi';
import { ureticiSayisiniOku } from '@/lib/bi/ureticiVeri';
import { TALEP_TURU_SIRA, talepTuruAdi, ureticiYetenegi, type TalepTuru } from '@/lib/uretici/yetenekler';
import { ogrenmeAraciMetinleri } from '@/lib/ogrenmeAraci/etiketler';

const SAHA = { net_puan:'Net Saha Puanı', kazanilan_toplam:'Kazanılan Saha Puanı', kaybedilen_toplam:'Kayıp Saha Puanı', tamamlanan_izleme:'Tamamlanan İzleme', izleme_puani:'İzleme Puanı', cevaplama_puani:'Cevaplama Puanı', oneri_puani:'Öneri Puanı', extra_puan:'Extra Puan', ileri_sarma_kaybi:'İleri Sarma Kaybı', yanlis_cevap_kaybi:'Yanlış Cevap Kaybı', oneri_kaybi:'Öneri Kaybı' };
// Rapor gruplarıdır; kullanıcı erişim rolleri değildir.
// eslint-disable-next-line hapbilgi-mimari/rol-tek-kaynak
const GRUPLAR = ['firma','takim','bolge','utt','bm','uretici','egitim','urun'] as const;
export const DETAY_OLCUTLERI = [...new Set([...Object.keys(SAHA), ...Object.keys(BM_PUAN_BASLIKLARI), ...Object.keys(URETICI_OLCUTLERI)])];
export type Detay = { alan:'detay'; kaynak:'saha'|'uretim'; grup:typeof GRUPLAR[number]; adlar:string[]; olcut:string; zaman:'simdi'|'hafta'|'ay'|'donem'|'yil'; geriye:number; karsilastir:boolean; sirala:boolean; takim:string; bolge:string; uretici:string; urun:string; egitim:'tumu'|TalepTuru; arac:'tumu'|'video'|'podcast'|'gorsel'|'flip_pdf' };
export const DETAY_SEMA = { type:'object', properties: {
 alan:{type:'string',enum:['detay']},kaynak:{type:'string',enum:['saha','uretim']},grup:{type:'string',enum:[...GRUPLAR]},adlar:{type:'array',items:{type:'string',maxLength:200},maxItems:10},
 olcut:{type:'string',enum:DETAY_OLCUTLERI},zaman:{type:'string',enum:['simdi','hafta','ay','donem','yil']},geriye:{type:'integer',minimum:0,maximum:120},karsilastir:{type:'boolean'},sirala:{type:'boolean'},
 takim:{type:'string',maxLength:200},bolge:{type:'string',maxLength:200},uretici:{type:'string',maxLength:200},urun:{type:'string',maxLength:200},egitim:{type:'string',enum:['tumu',...TALEP_TURU_SIRA]},arac:{type:'string',enum:['tumu','video','podcast','gorsel','flip_pdf']},
 },required:['alan','kaynak','grup','adlar','olcut','zaman','geriye','karsilastir','sirala','takim','bolge','uretici','urun','egitim','arac'],additionalProperties:false };
export const DETAY_TALIMATI = `
Ayrıntılı sorular için istek=detay, detay alanını doldur. Firma toplamındaki eski ölçütler bulundu kalabilir.
Detay kaynak saha: grup takim/bolge/utt/bm. Takım ve bölge UTT toplamıdır, BM kişisel C-Club puanı ayrı.
Saha ölçütleri ${JSON.stringify(SAHA)}. BM için ${JSON.stringify(BM_PUAN_BASLIKLARI)}. UTT tekil dahil yönetici saha raporu kaynağı kullanılır.
Detay kaynak uretim: grup firma/uretici/egitim/urun. Ölçütler ${JSON.stringify(URETICI_OLCUTLERI)}.
"Yayında kaç öğrenme aracı" = yayinda_arac_turu, farklı tür sayısı. Yayın/içerik sayısı yayinda. Araçlara göre dağılım yayin_arac_dagilimi. Belirli video/podcast adedi yayinda+arac filtresi.
Adlar karşılaştırılacak veya tek sorgulanan grup adlarıdır: Ankara bölgesi => grup bolge, adlar [Ankara]. İki takım kıyasla => grup takim iki ad. Tümünü listele/sırala/en yüksek => adlar boş,sirala=true. Sıralama aynı metrikte büyükten küçüğe ve eşitlikleri koruyarak yapılır. En düşük veya belirli sıra numarası şu an yönlendirme.
Üretici adı filtresi uretici, ürün adı urun, eğitim türü egitim, araç filtresi arac; belirtilmeyen ad filtreleri boş, türler tumu. Belirli ürünün yayınları kaynak uretim grup firma urun=adı. Üreticiler arasında yayın karşılaştırması grup uretici. Eğitim türleri/ürünlere göre gruplama grup egitim/urun.
Saha grubunu takım ve bölge adlarıyla sınırlayabilirsin (takim,bolge). Üretim takım/bölge filtresi desteklenmez. Saha ürün/eğitim/araç/üretici filtresi desteklenmez; atlayarak yanıtlama, yönlendirme seç.
Üretim talepleri ve yayın durumu mevcut an simdi; talep_acilan/yayina_alinan takvim zamanı ister. Geçmiş durum fotoğrafı yok. Saha zaman ister. Dönem=takvim çeyreği. Takipte detayın filtrelerini ve grubunu koru, açık yeni soruda yeni seç. Karsilastir=true yalnız önceki aynı takvim aralığına karşılaştırma; grup karşılaştırması adlar ile yapılır.
Kapsam yalnız yöneticinin kendi firması. Başka firma, bilinmeyen filtre, özel tarih, çapraz grup kıyaslaması yönlendirme. Hiçbir kullanıcı/ürün/takım kimliği üretme.
Detay kullanılmıyorsa varsayılan alan=detay,kaynak=saha,grup=takim,adlar=[],olcut=net_puan,zaman=ay,geriye=0,karsilastir=false,sirala=false,tüm ad filtreleri boş,egitim=tumu,arac=tumu.
`;
export function detayOku(v:unknown): Detay | undefined {
 if (!v || typeof v !== 'object') return;
 const s=v as Detay;
 if(s.alan!=='detay'||!['saha','uretim'].includes(s.kaynak)||!GRUPLAR.includes(s.grup)||!Array.isArray(s.adlar)||s.adlar.length>10||s.adlar.some(n=>typeof n!=='string'||!n.trim()||n.length>200)||!DETAY_OLCUTLERI.includes(s.olcut)||!['simdi','hafta','ay','donem','yil'].includes(s.zaman)||!Number.isInteger(s.geriye)||s.geriye<0||s.geriye>120||typeof s.karsilastir!=='boolean'||typeof s.sirala!=='boolean') return;
 if (['takim','bolge','uretici','urun'].some(k=>typeof s[k as keyof Detay]!=='string'||String(s[k as keyof Detay]).length>200)||!['tumu',...TALEP_TURU_SIRA].includes(s.egitim)||!['tumu','video','podcast','gorsel','flip_pdf'].includes(s.arac)) return;
 if(s.karsilastir&&s.geriye===120) return;
 if(s.kaynak==='saha') {
 // Rapor grupları; yetki yukarıda YONETICI_ROLLER ile doğrulanır.
 // eslint-disable-next-line hapbilgi-mimari/rol-tek-kaynak
 if(!['takim','bolge','utt','bm'].includes(s.grup)||s.zaman==='simdi'||s.uretici||s.urun||s.egitim!=='tumu'||s.arac!=='tumu'||!Object.hasOwn(s.grup==='bm'?BM_PUAN_BASLIKLARI:SAHA,s.olcut))return;
 }else{
 if(!['firma','uretici','egitim','urun'].includes(s.grup)||s.takim||s.bolge||!Object.hasOwn(URETICI_OLCUTLERI,s.olcut))return;
 const olay=['talep_acilan','yayina_alinan'].includes(s.olcut);
 if(olay===(s.zaman==='simdi')||(s.zaman==='simdi'&&(s.geriye!==0||s.karsilastir)))return;
 if(s.sirala&&s.olcut==='yayin_arac_dagilimi')return;
 }
 return Object.fromEntries(Object.keys(DETAY_SEMA.properties).map(k=>[k,s[k as keyof Detay]])) as Detay;
}
type Row = Record<string, unknown>;
async function sayfala(q:(bas:number,son:number)=>PromiseLike<{data:Row[]|null;error:unknown}>) {
 const rows:Row[]=[]; for(let b=0;;b+=500){const r=await q(b,b+499);if(r.error||!Array.isArray(r.data))throw new Error('VERI_EKSIK'); rows.push(...r.data);if(r.data.length<500)return rows;}
}
const metin=(r:Row,k:string)=>String(r[k]??'');
const sayi=(r:Row,k:string)=>{const x=r[k];if(x===null||x===undefined||!Number.isFinite(Number(x)))throw new Error('VERI_EKSIK');return Number(x);};
async function partiler<T,R>(rows:T[],f:(r:T)=>Promise<R>) {const out:R[]=[];for(let i=0;i<rows.length;i+=8)out.push(...await Promise.all(rows.slice(i,i+8).map(f)));return out;}
export async function yoneticiDetayYaniti(db:SupabaseClient,id:string,rol:string,s:Detay,simdi=new Date()): Promise<{cevap:string;baglam:Detay;kaynaklar:{id:string;baslik:string;url:string;zaman:string}[];kullanim:{yol:string;olcut:string}}> {
 if(!YONETICI_ROLLER.includes(rol)||!detayOku(s))throw new Error('KAPSAM_YOK');
 const k=await db.from('kullanicilar').select('firma_id,rol,aktif_mi').eq('kullanici_id',id).maybeSingle();
 if(k.error||k.data?.rol!==rol||!k.data.firma_id||k.data.aktif_mi!==true)throw new Error('KAPSAM_YOK');
 const firma=String(k.data.firma_id);
 if(s.grup==='bm'){const f=await db.from('firmalar').select('cc_aktif,aktif').eq('firma_id',firma).maybeSingle();if(f.error||f.data?.cc_aktif!==true||f.data?.aktif!==true)throw new Error('KAPSAM_YOK');}
 const donem=puanDonemi({olcut:'toplam_net',zaman:s.zaman==='simdi'?'ay':s.zaman,geriye:s.geriye,karsilastir:false},simdi);
 if(donem.bitis<donem.baslangic)throw new Error('VERI_EKSIK');
 let sonuclar:Array<{ad:string;adet:number;dagilim?:Record<string,number>}>=[];
 if(s.kaynak==='saha') {
 let takimlar=await sayfala((b,e)=>db.from('takimlar').select('takim_id,takim_adi').eq('firma_id',firma).order('takim_id').range(b,e));
 if(s.takim)takimlar=[tekHedef(takimlar,s.takim,r=>metin(r,'takim_adi'))];
 const bolgeler=(await partiler(takimlar,t=>sayfala((b,e)=>db.from('bolgeler').select('bolge_id,bolge_adi,takim_id').eq('takim_id',t.takim_id).order('bolge_id').range(b,e)))).flat();
 const bolgeFiltre=s.bolge?tekHedef(bolgeler,s.bolge,r=>metin(r,'bolge_adi')):undefined;
 if(s.grup==='bm'){
 let kisiler=await sayfala((b,e)=>db.from('kullanicilar').select('kullanici_id,ad,soyad,takim_id,bolge_id').eq('firma_id',firma).eq('aktif_mi',true).eq('rol','bm').order('kullanici_id').range(b,e));
 const ts=new Set(takimlar.map(t=>t.takim_id));kisiler=kisiler.filter(p=>ts.has(p.takim_id)&&(!bolgeFiltre||p.bolge_id===bolgeFiltre.bolge_id));
 if(s.adlar.length)kisiler=s.adlar.map(ad=>tekHedef(kisiler,ad,r=>metin(r,'ad')+' '+metin(r,'soyad')));
 sonuclar=await partiler(kisiler,async p=>({ad:metin(p,'ad')+' '+metin(p,'soyad'),adet:(await bmPuaniniOku(db,metin(p,'kullanici_id'),'bm',{olcut:s.olcut as PuanTuru,zaman:s.zaman as 'ay',geriye:s.geriye,karsilastir:false},simdi)).puan}));
 }else{
 const rpc=(seviye:string,ust:string|null)=>sayfala((b,e)=>db.rpc('get_yonetici_hiyerarsi_v2',{p_yonetici_id:id,p_baslangic:donem.baslangic,p_bitis:donem.bitis,p_seviye:seviye,p_ust_birim_id:ust}).order('birim_id').range(b,e));
 let rows:Row[];
 if(s.grup==='takim'){if(s.bolge)throw new Error('KAPSAM_YOK');const ids=new Set(takimlar.map(t=>t.takim_id)); rows=(await rpc('takim',null)).filter(r=>ids.has(r.birim_id));}
 else if(s.grup==='bolge') rows=(await partiler(takimlar,t=>rpc('bolge',metin(t,'takim_id')))).flat().filter(r=>!bolgeFiltre||r.birim_id===bolgeFiltre.bolge_id);
 else rows=(await partiler(bolgeFiltre?[bolgeFiltre]:bolgeler,b=>rpc('utt',metin(b,'bolge_id')))).flat();
 if(s.adlar.length)rows=s.adlar.map(ad=>tekHedef(rows,ad,r=>metin(r,'birim_adi')));
 sonuclar=rows.map(r=>({ad:metin(r,'birim_adi'),adet:sayi(r,s.olcut)}));
 }
 }else{
 let kisiler=await sayfala((b,e)=>db.from('kullanicilar').select('kullanici_id,ad,soyad,rol').eq('firma_id',firma).in('rol',URETICI_ROLLER).order('kullanici_id').range(b,e));
 if(s.uretici)kisiler=[tekHedef(kisiler,s.uretici,r=>metin(r,'ad')+' '+metin(r,'soyad'))];
 const urunler=(s.urun||s.grup==='urun')?await sayfala((b,e)=>db.from('urunler').select('urun_id,urun_adi').eq('firma_id',firma).order('urun_id').range(b,e)):[];
 const urun=s.urun?tekHedef(urunler,s.urun,r=>metin(r,'urun_adi')):undefined;
 type Grup={ad:string;kisiler:Row[];egitim:Detay['egitim'];urunId?:string|null};
 let gruplar:Grup[]=s.grup==='uretici'?kisiler.map(p=>({ad:metin(p,'ad')+' '+metin(p,'soyad'),kisiler:[p],egitim:s.egitim,urunId:urun?metin(urun,'urun_id'):undefined})):
 s.grup==='egitim'?(s.egitim==='tumu'?TALEP_TURU_SIRA:[s.egitim]).map(t=>({ad:talepTuruAdi(t),kisiler,egitim:t,urunId:urun?metin(urun,'urun_id'):undefined})):
 s.grup==='urun'?(urun?[urun]:[...urunler,{urun_id:null,urun_adi:'Ürünsüz içerikler'}]).map(u=>({ad:metin(u,'urun_adi'),kisiler,egitim:s.egitim,urunId:u.urun_id===null?null:metin(u,'urun_id')})):
 [{ad:'Firma geneli',kisiler,egitim:s.egitim,urunId:urun?metin(urun,'urun_id'):undefined}];
 if(s.adlar.length)gruplar=s.adlar.map(ad=>tekHedef(gruplar,ad,g=>g.ad));
 sonuclar=await partiler(gruplar,async g=>{
 const dagilim:Record<string,number>={video:0,podcast:0,gorsel:0,flip_pdf:0};let adet=0;
 for(const p of g.kisiler){const r=metin(p,'rol');if(g.egitim!=='tumu'&&!ureticiYetenegi(r)!.acabilecegiTalepTurleri.includes(g.egitim))continue;
 const sonuc=await ureticiSayisiniOku(db,metin(p,'kullanici_id'),r,{alan:'uretim',olcut:(s.olcut==='yayinda_arac_turu'?'yayin_arac_dagilimi':s.olcut) as keyof typeof URETICI_OLCUTLERI,egitim:g.egitim,arac:s.arac,zaman:s.zaman,geriye:s.geriye,karsilastir:false},simdi,{firmaId:firma,urunId:g.urunId});
 adet+=sonuc.adet;for(const tur of Object.keys(dagilim))dagilim[tur]+=sonuc.aracDagilimi[tur];}
 return {ad:g.ad,adet:s.olcut==='yayinda_arac_turu'?Object.values(dagilim).filter(n=>n>0).length:adet,dagilim};
 });
 }
 if(s.sirala)sonuclar.sort((a,b)=>b.adet-a.adet||a.ad.localeCompare(b.ad,'tr'));
 const etiket=s.kaynak==='uretim'?URETICI_OLCUTLERI[s.olcut as keyof typeof URETICI_OLCUTLERI]:s.grup==='bm'?BM_PUAN_BASLIKLARI[s.olcut as keyof typeof BM_PUAN_BASLIKLARI]:SAHA[s.olcut as keyof typeof SAHA];
 const ad=(tur:string)=>ogrenmeAraciMetinleri(tur as 'video').ad;
 const tarih=(v:string)=>new Date(v).toLocaleDateString('tr-TR',{timeZone:'Europe/Istanbul'});
 const liste=sonuclar.map((r)=>{
 const sira=s.sirala?`${sonuclar.findIndex(x=>x.adet===r.adet)+1}. `:'';
 if(s.olcut==='yayin_arac_dagilimi')return `${r.ad}: ${Object.entries(r.dagilim!).map(([t,n])=>`${ad(t)}: ${n}`).join(', ')} — Toplam ${r.adet} yayın`;
 if(s.olcut==='yayinda_arac_turu')return `${r.ad}: **${r.adet} tür**${r.adet?': '+Object.entries(r.dagilim!).filter(([,n])=>n>0).map(([t])=>ad(t)).join(', '):''}`;
 return `${sira}${r.ad}: **${r.adet.toLocaleString('tr-TR')}**`;
 });
 const filtreler=[s.takim&&`Takım: ${s.takim}`,s.bolge&&`Bölge: ${s.bolge}`,s.uretici&&`Üretici: ${s.uretici}`,s.urun&&`Ürün: ${s.urun}`,s.egitim!=='tumu'&&talepTuruAdi(s.egitim),s.arac!=='tumu'&&ad(s.arac)].filter(Boolean);
 let cevap=(filtreler.length?filtreler.join(' · ')+'\n\n':'')+`${s.zaman==='simdi'?'Şu anda':donem.etiket} — ${etiket}\n`+(s.zaman==='simdi'?'':`${tarih(donem.baslangic)} – ${tarih(donem.bitis)}\n`)+liste.join('\n');
 if(!sonuclar.length)cevap+='Bu kapsamda kayıt bulunamadı.';
 if(s.adlar.length===2&&sonuclar.length===2&&s.olcut!=='yayin_arac_dagilimi')cevap+=`\nFark (${sonuclar[0].ad} − ${sonuclar[1].ad}): **${(sonuclar[0].adet-sonuclar[1].adet).toLocaleString('tr-TR')}**`;
 if(s.karsilastir){const onceki=await yoneticiDetayYaniti(db,id,rol,{...s,geriye:s.geriye+1,karsilastir:false},simdi);cevap+='\n\n'+onceki.cevap;}
 const url=s.kaynak==='uretim'?'/raporlar/uretim':s.grup==='bm'?'/cc-ligi':'/raporlar/yonetici';
 return {cevap,baglam:{...s,karsilastir:false},kaynaklar:[{id:'yonetici_detay',baslik:etiket,url,zaman:simdi.toISOString()}],kullanim:{yol:'kac',olcut:s.olcut}};
}
