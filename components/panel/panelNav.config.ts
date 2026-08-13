// components/panel/panelNav.config.ts
//
// Panel gezinme TEK KAYNAĞI — Faz 1 / Adım 1.1
// (docs/ana_sayfa_kabuk_donusum_is_plani.md).
//
// Sol liste (SolListe) ve mobil drawer (MobilDrawer) bu bildirimsel ağaçtan beslenir.
// Rol/aktiflik koşulları eski components/Navbar.tsx'ten BİREBİR alınmıştır (Faz 3'te silindi)
// (davranış-korur; KARAR-3). Notlar:
//   • "Ana Sayfa" navbar bilgi pill'idir → bu ağaçta YOKTUR (KARAR-5/6).
//   • eclub_kisi dar gezinmesi KARAR-4 gereği layout'ta çözülür → bu ağaçta YOKTUR.
//   • Koşullar rolKucu üzerinden çözülür (setler küçük harf). Mevcut Navbar üretim
//     hattı koşulunda ham `rol` kullanıyordu; sistemde roller küçük harf olduğundan
//     rolKucu ile birebir aynıdır.
//   • analiz koşulu Navbar'daki hard-coded listenin roller.ts eşleniğidir:
//     ANALIZ_TUKETICI (bm,tm) + ANALIZ_URETICI (İK hariç üretici) + YONETICI — admin
//     hariç (admin panele girmez). Küme birebir aynıdır.

import {
  URETICI_ROLLER,
  URETIM_HATTI_GORENLER,
  IU_ROLU,
  YAYINDAKI_VIDEO_GORENLER,
  CCLIGI_GORENLERLER,
  STORE_ALABILEN_ROLLER,
  STORE_GENEL_GOREN_ROLLER,
  ECLUB_GOREN_ROLLER,
  ECLUB_LIGI_GOREN_ROLLER,
  ECLUB_STORE_RAPOR_GOREN_ROLLER,
  TUKETICI_ROLLER,
  ANALIZ_TUKETICI_ROLLERI,
  ANALIZ_URETICI_ROLLERI,
  YONETICI_ROLLER,
} from "@/lib/utils/roller";

// Gezinme bağlamı — layout'un profil/api + kimlikten türettiği değerler.
export interface NavContext {
  rolKucu: string;
  kimlikTuru?: string;
  storeAcik: boolean;
  ccAcik: boolean;
  eclubAcik: boolean;
  eclubStoreAcik: boolean;
  eczanemAcik: boolean;
}

export interface NavOge {
  etiket: string;
  // Sabit yol; Raporlar rol-bazlı yönlendiği için çözücü fonksiyon da olabilir
  // (mevcut Navbar.raporaGit birebir).
  path: string | ((ctx: NavContext) => string);
  badgeKey?: string;             // bildirimler/api "sayilar" anahtarı (talep/senaryo/…)
  yayinBekleyenRozeti?: boolean; // Yayın Yönetimi rozeti bildirim değil, canlı kuyruk sayısı
  gate: (ctx: NavContext) => boolean;
}

export interface NavGrup {
  baslik: string;
  oglar: NavOge[];
  // false yalnız ayrı kimlik kabuklarında kullanılır. İç sistem PANEL_NAV
  // gruplarında başlık, görünür öğe sayısından bağımsız olarak daima çizilir.
  baslikGoster?: boolean;
}

// analizRoller — Navbar hard-coded listesinin roller.ts eşleniği (admin hariç, birebir küme).
const ANALIZ_GOREN_ROLLER = [
  ...ANALIZ_TUKETICI_ROLLERI,
  ...ANALIZ_URETICI_ROLLERI,
  ...YONETICI_ROLLER,
];

export const PANEL_NAV: NavGrup[] = [
  {
    baslik: "Üretim",
    oglar: [
      // Birleşme (03.08): tek /talepler rotası; deneyim role göre sayfa içinde dallanır
      // (üretici → talep-merkezli, İÜ → klasik). Rol ayrımı artık page.tsx'te.
      { etiket: "Talepler",     path: "/talepler", badgeKey: "talep", gate: (c) => URETIM_HATTI_GORENLER.includes(c.rolKucu) },
      // Ayrı üretim sayfaları yalnız İÜ'ye — üretici bu üç aşamayı v2 şeridinde görür.
      { etiket: "Senaryolar",   path: "/senaryolar",   badgeKey: "senaryo",   gate: (c) => c.rolKucu === IU_ROLU },
      { etiket: "Videolar",     path: "/videolar",     badgeKey: "video",     gate: (c) => c.rolKucu === IU_ROLU },
      { etiket: "Soru Setleri", path: "/soru-setleri", badgeKey: "soru_seti", gate: (c) => c.rolKucu === IU_ROLU },
    ],
  },
  {
    baslik: "Yayın",
    oglar: [
      { etiket: "Yayın Yönetimi",    path: "/yayin-yonetimi",     yayinBekleyenRozeti: true, gate: (c) => URETICI_ROLLER.includes(c.rolKucu) },
      { etiket: "Yayındaki Videolar", path: "/yayindaki-videolar",                            gate: (c) => YAYINDAKI_VIDEO_GORENLER.includes(c.rolKucu) },
      { etiket: "Onaylanan Talepler", path: "/onaylanan-talepler",                            gate: (c) => c.rolKucu === "iu" },
    ],
  },
  {
    baslik: "Öneri Takibi",
    oglar: [
      // TM/BM (yönlendirici) rozetsiz; UTT/KD_UTT rozetli — badgeKey UTT için dolar.
      { etiket: "Öneri Takibi", path: "/oneriler", badgeKey: "oneri", gate: (c) => c.rolKucu === "tm" || c.rolKucu === "bm" || TUKETICI_ROLLER.includes(c.rolKucu) },
    ],
  },
  {
    baslik: "Raporlama",
    oglar: [
      {
        etiket: "Raporlar",
        path: (c) => {
          if (TUKETICI_ROLLER.includes(c.rolKucu)) return "/raporlar/utt";
          if (c.rolKucu === "bm") return "/raporlar/bm";
          if (c.rolKucu === "tm") return "/raporlar/tm";
          if (URETICI_ROLLER.includes(c.rolKucu)) return "/raporlar/uretici";
          return "/raporlar/yonetici";
        },
        gate: (c) => c.rolKucu !== "iu",
      },
      { etiket: "Analiz", path: "/analiz", gate: (c) => ANALIZ_GOREN_ROLLER.includes(c.rolKucu) },
    ],
  },
  {
    baslik: "Ligler",
    oglar: [
      { etiket: "HBLigi",      path: "/hbligi",     gate: (c) => c.rolKucu !== "iu" },
      { etiket: "CC Ligi",     path: "/cc-ligi",    gate: (c) => c.ccAcik && CCLIGI_GORENLERLER.includes(c.rolKucu) },
      { etiket: "E-Club Ligi", path: "/eclub/ligi", gate: (c) => c.eclubAcik && ECLUB_LIGI_GOREN_ROLLER.includes(c.rolKucu) },
    ],
  },
  {
    baslik: "HBStore",
    oglar: [
      { etiket: "Mağaza",    path: "/store",            gate: (c) => c.storeAcik && STORE_ALABILEN_ROLLER.includes(c.rolKucu) },
      { etiket: "Siparişler", path: "/store/siparisler", gate: (c) => c.storeAcik && STORE_GENEL_GOREN_ROLLER.includes(c.rolKucu) && c.rolKucu !== "bm" },
    ],
  },
  {
    baslik: "E-Club",
    oglar: [
      { etiket: "E-Club",       path: "/eclub/listem",     gate: (c) => c.eclubAcik && ECLUB_GOREN_ROLLER.includes(c.rolKucu) },
      { etiket: "E-Club Store", path: "/eclub/store/rapor", gate: (c) => c.eclubStoreAcik && ECLUB_STORE_RAPOR_GOREN_ROLLER.includes(c.rolKucu) },
    ],
  },
  {
    baslik: "Eczanem",
    oglar: [
      { etiket: "Eczanem", path: "/eczanem/utt", gate: (c) => c.eczanemAcik && TUKETICI_ROLLER.includes(c.rolKucu) },
    ],
  },
  {
    baslik: "Challenge Club",
    oglar: [
      { etiket: "Challenge Club", path: "/challenge-club", gate: (c) => c.ccAcik && c.rolKucu === "bm" },
    ],
  },
];

// eclub_kisi (eczacı/teknisyen) dar gezinmesi — KARAR-4 (B kararı: tek kaynak).
// Mevcut Navbar'ın kimlikTuru==='eclub_kisi' → yalnız "E-Club Store" pill'inin
// karşılığı. Koşulsuz (mevcut davranışta da eclubStoreAcik kontrolü yoktu).
// Aynı SolListe / MobilDrawer bileşenleri bu ağacı da çizer.
export const ECLUB_KISI_NAV: NavGrup[] = [
  {
    baslik: "E-Club Store",
    baslikGoster: false,
    oglar: [
      { etiket: "E-Club Store", path: "/eclub/store", gate: () => true },
    ],
  },
];
