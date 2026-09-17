require("dotenv").config({ path: ".env.local", quiet: true });
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

const sorular = Array.from({ length: 10 }, (_, i) => ({
  soru_metni: `Video rollback sorusu ${i + 1}`,
  secenekler: ["A", "B", "C", "D"].map((harf, j) => ({ harf, metin: `Seçenek ${harf}`, dogru: j === 0 })),
}));

async function gorev(client, talepId, asama) {
  return (await client.query(`SELECT * FROM public.uretim_gorevleri WHERE talep_id=$1 AND asama=$2 ORDER BY created_at DESC LIMIT 1`, [talepId, asama])).rows[0];
}
async function soruTamamla(client, talepId, ureticiId) {
  const g = await gorev(client, talepId, "soru_seti");
  assert.ok(g?.atanan_iu_id, "Soru seti görevi atanmadı.");
  if (g.durum === "atama_bekliyor") await client.query("UPDATE public.uretim_gorevleri SET durum='hazirlaniyor' WHERE gorev_id=$1", [g.gorev_id]);
  await client.query("SELECT public.uretim_soru_seti_teslim_et($1,$2,$3::jsonb,$4)", [g.gorev_id, g.atanan_iu_id, JSON.stringify(sorular), randomUUID()]);
  const inceleme = await gorev(client, talepId, "soru_seti");
  await client.query("SELECT public.uretim_uretici_karar_ver($1,$2,'onaylandi',NULL,$3,$4)", [g.gorev_id, ureticiId, randomUUID(), inceleme.surum]);
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    const temel = (await client.query(`SELECT t.* FROM public.talepler t JOIN public.kullanicilar k ON k.kullanici_id=t.uretici_id AND k.aktif_mi=true WHERE t.ogrenme_araci_turu='video' ORDER BY t.created_at DESC LIMIT 1`)).rows[0];
    assert.ok(temel, "Video fixture üreticisi bulunamadı.");
    const sonuclar = [];
    for (const [varyant, hazirVideo, hazirSoru] of [["V1",false,false],["V2",true,false],["V3",false,true],["V4",true,true]]) {
      await client.query("SAVEPOINT varyant");
      const veri = { firma_id:temel.firma_id,takim_id:temel.takim_id,egitim_turu:temel.egitim_turu,hedef_roller:temel.hedef_roller,icerik_turu:temel.icerik_turu,ogrenme_araci_turu:"video",ogrenme_araci_tercihleri:{},urun_id:temel.urun_id,teknik_id:temel.teknik_id,urun_adi:temel.urun_adi,aciklama:`Video ${varyant} rollback testi`,hazir_video:hazirVideo,hazir_soru_seti:hazirSoru,hazir_soru_seti_verisi:hazirSoru?sorular:null,soru_seti_buyuklugu:10,secenek_sayisi:4,video_basi_soru_sayisi:2 };
      const talep = (await client.query("SELECT public.talep_atomik_olustur($1,$2,$3::jsonb) sonuc", [temel.uretici_id,randomUUID(),JSON.stringify(veri)])).rows[0].sonuc;
      if (!hazirVideo) {
        const s = await gorev(client,talep.talep_id,"senaryo"); assert.ok(s?.atanan_iu_id);
        await client.query("SELECT public.uretim_senaryo_teslim_et($1,$2,$3,$4)",[s.gorev_id,s.atanan_iu_id,"Video test senaryosu",randomUUID()]);
        const si=await gorev(client,talep.talep_id,"senaryo");
        await client.query("SELECT public.uretim_uretici_karar_ver($1,$2,'onaylandi',NULL,$3,$4)",[s.gorev_id,temel.uretici_id,randomUUID(),si.surum]);
        const v=await gorev(client,talep.talep_id,"video"); assert.ok(v?.atanan_iu_id);
        if(v.durum==="atama_bekliyor") await client.query("UPDATE public.uretim_gorevleri SET durum='hazirlaniyor' WHERE gorev_id=$1",[v.gorev_id]);
        await client.query("SELECT public.uretim_video_teslim_et($1,$2,$3,NULL,$4)",[v.gorev_id,v.atanan_iu_id,`https://iframe.mediadelivery.net/embed/1/${randomUUID()}`,randomUUID()]);
        const vi=await gorev(client,talep.talep_id,"video");
        await client.query("SELECT public.uretim_uretici_karar_ver($1,$2,'onaylandi',NULL,$3,$4)",[v.gorev_id,temel.uretici_id,randomUUID(),vi.surum]);
      } else {
        const guid=randomUUID();
        await client.query("SELECT public.uretim_hazir_video_kaydet($1,$2,$3,$4)",[talep.talep_id,temel.uretici_id,`https://iframe.mediadelivery.net/embed/1/${guid}`,guid]);
      }
      if(!hazirSoru) await soruTamamla(client,talep.talep_id,temel.uretici_id);
      const onaylar=(await client.query(`SELECT EXISTS(SELECT 1 FROM public.video_durumu d JOIN public.videolar v ON v.video_id=d.video_id WHERE v.talep_id=$1 AND d.durum='onaylandi') video, EXISTS(SELECT 1 FROM public.soru_seti_durumu d JOIN public.soru_setleri s ON s.soru_seti_id=d.soru_seti_id WHERE s.talep_id=$1 AND d.durum='onaylandi') soru`,[talep.talep_id])).rows[0];
      assert.deepEqual(onaylar,{video:true,soru:true}); sonuclar.push({varyant,tamamlandi:true}); console.log(JSON.stringify(sonuclar.at(-1)));
      await client.query("ROLLBACK TO SAVEPOINT varyant"); await client.query("RELEASE SAVEPOINT varyant");
    }
    console.log(JSON.stringify({arac:"video",sonuclar,rollback:true}));
  } finally { await client.query("ROLLBACK").catch(()=>{}); await client.end(); }
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
