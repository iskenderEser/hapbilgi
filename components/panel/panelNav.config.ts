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

import {
  URETICI_ROLLER,
  IU_ROLU,
  YAYINDAKI_VIDEO_GORENLER,
  CCLIGI_GORENLERLER,
  STORE_ALABILEN_ROLLER,
  STORE_GENEL_GOREN_ROLLER,
  ECLUB_GOREN_ROLLER,
  ECLUB_YONETIM_ROLLERI,
  TUKETICI_ROLLER,
  ECZANEM_TALEP_ACAN_ROLLER,
  ECZANEM_RAPOR_GOREN_ROLLER,
} from "@/lib/utils/roller";
import { UTT_VIDEO_KATEGORILERI } from "@/lib/video/uttVideoKategorileri";

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
  path?: string | ((ctx: NavContext) => string);
  altOglar?: NavOge[];
  badgeKey?: string;             // bildirimler/api "sayilar" anahtarı (talep/senaryo/…)
  tamEslesme?: boolean;          // Alt rotalarda başka menü öğesini de aktif göstermemek için
  gate: (ctx: NavContext) => boolean;
}

export interface NavGrup {
  baslik: string;
  oglar: NavOge[];
  // false yalnız ayrı kimlik kabuklarında kullanılır. İç sistem PANEL_NAV
  // gruplarında başlık, görünür öğe sayısından bağımsız olarak daima çizilir.
  baslikGoster?: boolean;
}

export const PANEL_NAV: NavGrup[] = [
  // ─── 1. ÜRETİM & YAYIN (Üretici ve İçerik Üreticisi) ─────────────────────
  {
    baslik: "Üretim & Yayın",
    oglar: [
      { etiket: "Talepler ve Yeni Talep", path: "/talepler", badgeKey: "talep", gate: (c) => URETICI_ROLLER.includes(c.rolKucu) },
      { etiket: "Yayın Yönetimi",    path: "/yayin-yonetimi",     badgeKey: "yayin",     gate: (c) => URETICI_ROLLER.includes(c.rolKucu) },
      { etiket: "Sizin Yayınlarınız", path: "/sizin-yayinlariniz",                       gate: (c) => URETICI_ROLLER.includes(c.rolKucu) },
      { etiket: "Tüm Yayınlar",       path: "/tum-yayinlar",                             gate: (c) => URETICI_ROLLER.includes(c.rolKucu) },
      { etiket: "Senaryolar",        path: "/senaryolar",         badgeKey: "senaryo",   gate: (c) => c.rolKucu === IU_ROLU },
      { etiket: "Videolar",          path: "/videolar",           badgeKey: "video",     gate: (c) => c.rolKucu === IU_ROLU },
      { etiket: "Soru Setleri",      path: "/soru-setleri",       badgeKey: "soru_seti", gate: (c) => c.rolKucu === IU_ROLU },
      { etiket: "Onaylanan Talepler", path: "/onaylanan-talepler",                       gate: (c) => c.rolKucu === IU_ROLU },
    ],
  },

  // ─── 2. T-CLUB (Saha & Temsilci Kulübü) ──────────────────────────────────
  {
    baslik: "T-Club",
    oglar: [
      { etiket: "Öneri Takibi",       path: "/oneriler",           badgeKey: "oneri", gate: (c) => c.rolKucu === "tm" || c.rolKucu === "bm" || TUKETICI_ROLLER.includes(c.rolKucu) },
      {
        etiket: "Eğitim Yayınları",
        gate: (c: NavContext) => TUKETICI_ROLLER.includes(c.rolKucu),
        altOglar: UTT_VIDEO_KATEGORILERI.map((kategori) => ({
          etiket: kategori.etiket,
          path: `/videolarim/${kategori.slug}`,
          gate: (c: NavContext) => TUKETICI_ROLLER.includes(c.rolKucu),
        })),
      },
      { etiket: "Yayındaki Videolar", path: "/yayindaki-videolar", gate: (c) => YAYINDAKI_VIDEO_GORENLER.includes(c.rolKucu) && !URETICI_ROLLER.includes(c.rolKucu) },
      { etiket: "T-Club Ligi",        path: "/hbligi",             gate: () => true },
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
      // UTT HBStore (kendi puanı)
      { etiket: "Mağazam",           path: "/store",              tamEslesme: true, gate: (c) => c.storeAcik && TUKETICI_ROLLER.includes(c.rolKucu) },
      { etiket: "Siparişlerim",      path: "/store/siparislerim",                   gate: (c) => c.storeAcik && TUKETICI_ROLLER.includes(c.rolKucu) },
      { etiket: "Adreslerim",        path: "/store/adreslerim",                     gate: (c) => c.storeAcik && TUKETICI_ROLLER.includes(c.rolKucu) },
      // BM / TM / Yönetici (Ekip Takibi — Üretici hariç)
      { etiket: "Ekip Mağaza Siparişleri", path: "/store/siparisler",               gate: (c) => c.storeAcik && STORE_GENEL_GOREN_ROLLER.includes(c.rolKucu) && !URETICI_ROLLER.includes(c.rolKucu) },
    ],
  },

  // ─── 3. C-CLUB (Challenge Club) ──────────────────────────────────────────
  {
    baslik: "C-Club",
    oglar: [
      { etiket: "Challenge Club",    path: "/challenge-club",     gate: (c) => c.ccAcik && c.rolKucu === "bm" },
      { etiket: "C-Club Ligi",       path: "/cc-ligi",            gate: (c) => c.ccAcik && CCLIGI_GORENLERLER.includes(c.rolKucu) },
      // BM Kişisel Mağazam (C-Club puanlarıyla alışveriş)
      { etiket: "Mağazam",           path: "/store",              tamEslesme: true, gate: (c) => c.storeAcik && c.ccAcik && c.rolKucu === "bm" },
      { etiket: "Siparişlerim",      path: "/store/siparislerim",                   gate: (c) => c.storeAcik && c.ccAcik && c.rolKucu === "bm" },
      { etiket: "Adreslerim",        path: "/store/adreslerim",                     gate: (c) => c.storeAcik && c.ccAcik && c.rolKucu === "bm" },
    ],
  },

  // ─── 4. E-CLUB (Eczane Kulübü) ───────────────────────────────────────────
  {
    baslik: "E-Club",
    oglar: [
      { etiket: "E-Club Takımım",    path: "/eclub/eczanelerim",  gate: (c) => c.eclubAcik && ECLUB_GOREN_ROLLER.includes(c.rolKucu) },
      {
        etiket: "Video Yönetimi",
        badgeKey: "eclub_gonderilecek",
        gate: (c) => c.eclubAcik && ECLUB_GOREN_ROLLER.includes(c.rolKucu),
        altOglar: [
          { etiket: "Gönderilecek Videolar", path: "/eclub/videolarim", badgeKey: "eclub_gonderilecek", gate: (c) => c.eclubAcik && ECLUB_GOREN_ROLLER.includes(c.rolKucu) },
          { etiket: "Gönderilen Videolar",   path: "/eclub/gonderilen-videolar", gate: (c) => c.eclubAcik && ECLUB_GOREN_ROLLER.includes(c.rolKucu) },
        ],
      },
      { etiket: "E-Club Takım Raporlarım", path: "/eclub/raporlar", gate: (c) => c.eclubAcik && ECLUB_YONETIM_ROLLERI.includes(c.rolKucu) },
      { etiket: "E-Club Ligi",       path: "/eclub/ligi",         gate: (c) => c.eclubAcik && ECLUB_YONETIM_ROLLERI.includes(c.rolKucu) },
    ],
  },

  // ─── 5. ECZANEM (Nihai Tüketici Katmanı) ─────────────────────────────────
  {
    baslik: "Eczanem",
    oglar: [
      { etiket: "Video Dağıtımı",    path: "/eczanem/utt",        tamEslesme: true, gate: (c) => c.eczanemAcik && TUKETICI_ROLLER.includes(c.rolKucu) },
      { etiket: "Mutabakat Dökümü",  path: "/eczanem/utt/mutabakat",                gate: (c) => c.eczanemAcik && TUKETICI_ROLLER.includes(c.rolKucu) },
      { etiket: "Eczanem Raporları", path: "/raporlar/eczanem",                     gate: (c) => c.eczanemAcik && ECZANEM_RAPOR_GOREN_ROLLER.includes(c.rolKucu) },
    ],
  },
];

// eclub_kisi (eczacı/teknisyen) dar gezinmesi — kişi paneli + kendi mağaza yolları.
// Çok-firmalı erişim bayrakları aktif eczane→firma zincirinden profil API'sinde çözülür.
export function eclubKisiNavOlustur(firmalar: Array<{ firma_id: string; firma_adi: string }>): NavGrup[] {
  return [
  {
    baslik: "E-Club",
    oglar: [
      {
        etiket: "Firmaların Videoları",
        path: "/eclub/panel",
        gate: (c) => c.eclubAcik,
        altOglar: firmalar.map((firma) => ({
          etiket: firma.firma_adi,
          path: `/eclub/panel/firma/${firma.firma_id}`,
          gate: (c) => c.eclubAcik,
        })),
      },
    ],
  },
  {
    baslik: "E-Club Store",
    oglar: [
      { etiket: "Mağazam", path: "/eclub/store", tamEslesme: true, gate: (c) => c.eclubAcik && c.eclubStoreAcik },
      { etiket: "Siparişlerim", path: "/eclub/store/siparislerim", gate: (c) => c.eclubAcik && c.eclubStoreAcik },
      { etiket: "Adreslerim", path: "/eclub/store/adreslerim", gate: (c) => c.eclubAcik && c.eclubStoreAcik },
    ],
  },
  {
    baslik: "Eczanem",
    oglar: [
      { etiket: "Müşterilerim",     path: "/eczanem/eczane/musterilerim", gate: (c) => c.eczanemAcik },
      { etiket: "Video Dağıtımı",   path: "/eczanem/eczane/dagitim", badgeKey: "eczanem_video_gonderilecek", gate: (c) => c.eczanemAcik },
      { etiket: "Sipariş Onayı",    path: "/eczanem/eczane/siparisler", badgeKey: "eczanem_siparis_bekleyen", gate: (c) => c.eczanemAcik },
      { etiket: "İşlem Dökümü",     path: "/eczanem/eczane/dokum",        gate: (c) => c.eczanemAcik },
    ],
  },
  ];
}

export const ECLUB_KISI_NAV: NavGrup[] = eclubKisiNavOlustur([]);
