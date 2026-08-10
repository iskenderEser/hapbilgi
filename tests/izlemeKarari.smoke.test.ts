import test from "node:test";
import assert from "node:assert/strict";

import {
  ileriSarmaKaybiHesapla,
  izlemeKazanimKarariBelirle,
  soruHakkiBelirle,
  tamamlamaYeterliMi,
} from "@/lib/izleme/karar";

test("ilk gerçek temiz tam izleme tam puan ve soru hakkı üretir", () => {
  const kazanim = izlemeKazanimKarariBelirle({
    tamamlandi: true,
    puanliZaman: true,
    dahaOnceIzlemePuaniVar: false,
    videoPuani: 10,
  });
  const soru = soruHakkiBelirle({
    tamamlandi: true,
    puanliZaman: true,
    oncekiGercekDenemeVar: false,
    oncekiTamamlanmisDenemeVar: false,
    mevcutDenemedeIleriSarmaVar: false,
  });

  assert.deepEqual(kazanim, { puanVer: true, puan: 10 });
  assert.deepEqual(soru, { varMi: true, neden: "uygun" });
  assert.equal(tamamlamaYeterliMi({ videoSuresi: 60, gecenSure: 58, onayliAtlananSure: 0 }), true);
});

test("yarım ve ileri sarmalı varyasyonlar kazanım-kayıp-soru simetrisini korur", () => {
  const ilkSeekKaybi = ileriSarmaKaybiHesapla({
    videoPuani: 10,
    videoSuresi: 100,
    atlananSure: 30,
    puanliZaman: true,
  });
  const sonrakiTamKazanim = izlemeKazanimKarariBelirle({
    tamamlandi: true,
    puanliZaman: true,
    dahaOnceIzlemePuaniVar: false,
    videoPuani: 10,
  });
  const yarimSonrasiSoru = soruHakkiBelirle({
    tamamlandi: true,
    puanliZaman: true,
    oncekiGercekDenemeVar: true,
    oncekiTamamlanmisDenemeVar: false,
    mevcutDenemedeIleriSarmaVar: false,
  });
  const tekrarSoru = soruHakkiBelirle({
    tamamlandi: true,
    puanliZaman: true,
    oncekiGercekDenemeVar: true,
    oncekiTamamlanmisDenemeVar: true,
    mevcutDenemedeIleriSarmaVar: false,
  });
  const mevcutSeekSoru = soruHakkiBelirle({
    tamamlandi: true,
    puanliZaman: true,
    oncekiGercekDenemeVar: false,
    oncekiTamamlanmisDenemeVar: false,
    mevcutDenemedeIleriSarmaVar: true,
  });

  assert.equal(ilkSeekKaybi, 3);
  assert.deepEqual(sonrakiTamKazanim, { puanVer: true, puan: 10 });
  assert.deepEqual(yarimSonrasiSoru, { varMi: false, neden: "yarim_deneme" });
  assert.deepEqual(tekrarSoru, { varMi: false, neden: "tekrar_izleme" });
  assert.deepEqual(mevcutSeekSoru, { varMi: false, neden: "ileri_sarma" });
  assert.equal(ileriSarmaKaybiHesapla({ videoPuani: 10, videoSuresi: 100, atlananSure: 1, puanliZaman: true }), 1);
  assert.equal(ileriSarmaKaybiHesapla({ videoPuani: 10, videoSuresi: 100, atlananSure: 30, puanliZaman: false }), 0);
  assert.equal(tamamlamaYeterliMi({ videoSuresi: 100, gecenSure: 60, onayliAtlananSure: 20 }), false);
});
