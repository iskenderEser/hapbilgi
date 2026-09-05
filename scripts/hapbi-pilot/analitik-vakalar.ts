import type { PilotKullanici, PilotMetinKurali, PilotVakasi } from "@/scripts/hapbi-pilot/vakalar";

const urunVePuan: PilotMetinKurali[] = [
  {
    kod: "urun-adi",
    aciklama: "Yanıt en yüksek net puanı üreten ürünü adlandırmalı.",
    desen: /ürün/iu,
    tur: "bulunmali",
    kritik: true,
  },
  {
    kod: "sayisal-katki",
    aciklama: "Yanıt net puan katkısını sayısal olarak vermeli.",
    desen: /\d/u,
    tur: "bulunmali",
    kritik: true,
  },
];

const urunUttVePuan: PilotMetinKurali[] = [
  ...urunVePuan,
  {
    kod: "utt-katkisi",
    aciklama: "Yanıt ürüne en fazla katkı sağlayan UTT olarak Berk Kılıç'ı adlandırmalı.",
    desen: /Berk Kılıç/iu,
    tur: "bulunmali",
    kritik: true,
  },
];

const UTT: PilotKullanici = {
  rol: "utt", ad: "Berk", soyad: "Kılıç", beklenenTakim: "Şimşek", beklenenBolge: "İzmir",
};
const BM: PilotKullanici = {
  rol: "bm", ad: "Selin", soyad: "Yılmaz", beklenenTakim: "Şimşek", beklenenBolge: "İzmir",
};
const TM: PilotKullanici = { rol: "tm", ad: "Emre", soyad: "Kaya", beklenenTakim: "Şimşek" };
const PM: PilotKullanici = { rol: "pm", ad: "Merve", soyad: "Duran", beklenenTakim: "Şimşek" };
const MED_MD: PilotKullanici = { rol: "med_md", ad: "Sema", soyad: "Bilgin" };
const GM: PilotKullanici = { rol: "gm", ad: "Murat", soyad: "Aydın", eposta: "murat@test2.com" };

// Canlı veritabanında aktif DRK hesabı bulunmuyor. Kullanıcının yönlendirmesiyle
// DRK soru biçimi, aynı firma kapsamındaki GM test hesabıyla vekâleten çalıştırılır;
// bu koşum DRK rol doğrulamasının yerini tutmaz.
const DRK_VEKILI: PilotKullanici = GM;

function analitikAdimi(soru: string, metinKurallari: PilotMetinKurali[]) {
  return {
    soru,
    pathname: "/hbligi",
    davranis: "cevapla" as const,
    beklenenYol: "ai" as const,
    zorunluAraclar: [{ ad: "analitik_sorgu" }],
    kaynakDeseni: /T-Club analitik sonucu/iu,
    metinKurallari,
  };
}

export const ANALITIK_PILOT_VAKALARI: PilotVakasi[] = [
  {
    id: "AI-AN-UTT",
    baslik: "UTT kişisel ürün katkısı",
    kullanici: UTT,
    adimlar: [analitikAdimi(
      "3. çeyrekte en yüksek net puan ürettiğim ürün hangisi ve bu üründeki net puan katkım kaç?",
      urunVePuan,
    )],
  },
  {
    id: "AI-AN-BM",
    baslik: "BM sorumluluk kapsamı ürün ve UTT katkısı",
    kullanici: BM,
    adimlar: [analitikAdimi(
      "3. çeyrekte sorumlu olduğum UTT'lerin en yüksek net puanı ürettiği ürün hangisi; bu ürüne en fazla net puan katkısı sağlayan UTT kim ve katkısı kaç puan?",
      urunUttVePuan,
    )],
  },
  {
    id: "AI-AN-TM",
    baslik: "TM takım ürünü ve UTT katkısı",
    kullanici: TM,
    adimlar: [analitikAdimi(
      "3. çeyrekte takımımda en yüksek net puanı üreten ürün hangisi; bu ürüne en fazla net puan katkısı sağlayan UTT kim ve katkısı kaç puan?",
      urunUttVePuan,
    )],
  },
  {
    id: "AI-AN-PM",
    baslik: "PM ekip ürünü ve UTT katkısı",
    kullanici: PM,
    adimlar: [analitikAdimi(
      "3. çeyrekte ekibimde en yüksek net puanı üreten ürün hangisi; bu ürüne en fazla net puan katkısı sağlayan UTT kim ve katkısı kaç puan?",
      urunUttVePuan,
    )],
  },
  {
    id: "AI-AN-MED-MD",
    baslik: "Medikal müdür firma ürünü ve UTT katkısı",
    kullanici: MED_MD,
    adimlar: [analitikAdimi(
      "3. çeyrekte firmamızda en yüksek net puanı üreten ürün hangisi; bu ürüne en fazla net puan katkısı sağlayan UTT kim ve katkısı kaç puan?",
      urunUttVePuan,
    )],
  },
  {
    id: "AI-AN-DRK-VEKIL",
    baslik: "DRK soru biçimi — GM vekil koşumu",
    kullanici: DRK_VEKILI,
    adimlar: [analitikAdimi(
      "3. çeyrekte şirketimizde en yüksek net puanı üreten ürün hangisi; bu ürüne en fazla net puan katkısı sağlayan UTT kim ve katkısı kaç puan?",
      urunUttVePuan,
    )],
  },
  {
    id: "AI-AN-GM",
    baslik: "GM firma ürünü ve UTT katkısı",
    kullanici: GM,
    adimlar: [analitikAdimi(
      "3. çeyrekte şirketimiz genelinde en yüksek net puanı üreten ürün hangisi; bu ürüne en fazla net puan katkısı sağlayan UTT kim ve katkısı kaç puan?",
      urunUttVePuan,
    )],
  },
];
