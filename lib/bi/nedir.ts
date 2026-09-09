import { biMetniniNormalize } from "@/lib/bi/normalizasyon";

export type NedirKonusu = Readonly<{
  id: string;
  baslik: string;
  adlar: readonly string[];
  cevap: string;
  aksiyon?: Readonly<{ etiket: string; url: string }>;
}>;

export type NedirCozumu =
  | Readonly<{ durum: "bulundu"; konu: NedirKonusu }>
  | Readonly<{ durum: "tanim_yok"; aranan: string }>
  | Readonly<{ durum: "nedir_sorusu_degil" }>;

export const NEDIR_KATALOGU: readonly NedirKonusu[] = [
  {
    id: "hapbilgi",
    baslik: "HapBilgi",
    adlar: ["hapbilgi", "hap bilgi", "platform", "bu platform"],
    cevap:
      "**HapBilgi**, öğrenme içeriklerini sunan; izleme, soru ve puan sonuçlarını kurallarla kaydeden dijital öğrenme platformudur.",
    aksiyon: { etiket: "HapBilgi Nedir?", url: "/hapbilgi-nedir" },
  },
  {
    id: "bi",
    baslik: "bi",
    adlar: ["bi", "hapbi"],
    cevap:
      "**bi**, HapBilgi içindeki yardım asistanıdır. Onaylı platform kavramlarını açıklar ve desteklenen kişisel puan sorularını yetkili veriden yanıtlar.",
    aksiyon: { etiket: "Nasıl Çalışır?", url: "/nasil-calisir" },
  },
  {
    id: "tclub",
    baslik: "T-Club",
    adlar: ["t club", "tclub", "t club ligi", "tclub ligi"],
    cevap:
      "**T-Club**, UTT ve KD_UTT kullanıcılarının öğrenme içeriklerinden kazandığı ve davranış kayıplarıyla azalan net puanların lig düzeninde izlendiği alandır.",
    aksiyon: { etiket: "T-Club Ligi", url: "/hbligi" },
  },
  {
    id: "cclub",
    baslik: "C-Club",
    adlar: ["c club", "cclub", "challenge club", "c club ligi", "cclub ligi"],
    cevap:
      "**C-Club**, Bölge Müdürlerinin birbirine öğrenme meydan okumaları gönderdiği ve bu akışın kendi puan kurallarıyla izlendiği alandır.",
    aksiyon: { etiket: "C-Club", url: "/challenge-club" },
  },
  {
    id: "hbstore",
    baslik: "HBStore",
    adlar: ["hbstore", "hb store"],
    cevap:
      "**HBStore**, UTT, KD_UTT ve BM kullanıcılarının harcanabilir puanlarıyla uygun ürünleri inceleyip sipariş verebildiği platform mağazasıdır.",
    aksiyon: { etiket: "HBStore", url: "/store" },
  },
  {
    id: "eclub",
    baslik: "E-Club",
    adlar: ["e club", "eclub"],
    cevap:
      "**E-Club**, eczane çalışanlarına yönelik öğrenme içeriklerinin, izleme ve puan akışlarının yönetildiği HapBilgi alanıdır.",
  },
  {
    id: "eczanem",
    baslik: "Eczanem",
    adlar: ["eczanem"],
    cevap:
      "**Eczanem**, yetkili eczanenin HapBilgi içeriklerini kendi uygulama üyelerine ulaştırdığı; öğrenme, puan ve işlem taleplerini yönettiği alandır.",
  },
  {
    id: "ogrenme_araclari",
    baslik: "Öğrenme araçları",
    adlar: ["öğrenme aracı", "öğrenme araçları"],
    cevap:
      "**Öğrenme araçları**, HapBilgi'deki video, podcast, görsel ve çevrilebilir PDF içerik türlerinin ortak adıdır.",
    aksiyon: { etiket: "Tüm Yayınlar", url: "/tum-yayinlar" },
  },
  {
    id: "net_puan",
    baslik: "Net puan",
    adlar: ["net puan", "t club net puanı", "tclub net puanı"],
    cevap:
      "**Net puan**, desteklenen dönemdeki T-Club puan kazanımlarından ileri sarma, yanlış cevap ve öneri kayıplarının çıkarılmasıyla oluşan sonuçtur.",
  },
];

const KALIPLAR = [
  /^(.+?) nedir$/u,
  /^(.+?) ne demek$/u,
  /^(.+?) ne işe yarar$/u,
  /^(.+?) ne ise yarar$/u,
];

export function nedirSorusunuCoz(soru: string): NedirCozumu {
  const normal = biMetniniNormalize(soru);
  const eslesme = KALIPLAR.map((kalip) => normal.match(kalip)).find(Boolean);
  if (!eslesme) return { durum: "nedir_sorusu_degil" };

  const aranan = eslesme[1].trim();
  const konu = NEDIR_KATALOGU.find((aday) => aday.adlar.includes(aranan));
  return konu ? { durum: "bulundu", konu } : { durum: "tanim_yok", aranan };
}
