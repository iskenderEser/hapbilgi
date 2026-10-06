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
  YONETICI_ROLLER,
  YONLENDIRICI_ROLLER,
  IU_ROLU,
  CCLIGI_GORENLERLER,
  STORE_ALABILEN_ROLLER,
  STORE_GENEL_GOREN_ROLLER,
  ECLUB_GOREN_ROLLER,
  ECLUB_YONETIM_ROLLERI,
  TUKETICI_ROLLER,
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
  // ─── 1. YAYINLAR VE RAPORLAR (Üretici ve İçerik Üreticisi) ───────────────
  {
    baslik: "Yayınlar ve Raporlar",
    oglar: [
      { etiket: "Yayın Oluşturma ve Takip", path: "/yayin-takip", badgeKey: "talep", gate: (c) => URETICI_ROLLER.includes(c.rolKucu) },
      { etiket: "Yayın Yönetimi",    path: "/yayin-yonetimi",     badgeKey: "yayin",     gate: (c) => URETICI_ROLLER.includes(c.rolKucu) },
      { etiket: "Sizin Yayınlarınız", path: "/sizin-yayinlariniz",                       gate: (c) => URETICI_ROLLER.includes(c.rolKucu) },
      { etiket: "Tüm Yayınlar",       path: "/tum-yayinlar",                             gate: (c) => URETICI_ROLLER.includes(c.rolKucu) },
      { etiket: "Yayın Raporları",    path: "/raporlar/yayin-raporlari",                 gate: (c) => URETICI_ROLLER.includes(c.rolKucu) || YONETICI_ROLLER.includes(c.rolKucu) || c.rolKucu === "admin" },
      { etiket: "Senaryolar",        path: "/senaryolar",         badgeKey: "senaryo",   gate: (c) => c.rolKucu === IU_ROLU },
      { etiket: "Öğrenme Araçları", path: "/videolar",           badgeKey: "video",     gate: (c) => c.rolKucu === IU_ROLU },
      { etiket: "Soru Setleri",      path: "/soru-setleri",       badgeKey: "soru_seti", gate: (c) => c.rolKucu === IU_ROLU },
      { etiket: "Onaylanan Talepler", path: "/onaylanan-talepler",                       gate: (c) => c.rolKucu === IU_ROLU },
    ],
  },

  // ─── 2. T-CLUB (Saha & Temsilci Kulübü) ──────────────────────────────────
  {
    baslik: "T-Club",
    oglar: [
      {
        etiket: "Öneri Takibi",
        path: "/oneriler",
        badgeKey: "oneri",
        gate: (c) => c.rolKucu === "tm" || c.rolKucu === "bm",
      },
      {
        etiket: "Eğitim Yayınları",
        path: "/yayindaki-videolar",
        gate: (c) => c.rolKucu === "tm" || c.rolKucu === "bm" || YONETICI_ROLLER.includes(c.rolKucu),
        altOglar: UTT_VIDEO_KATEGORILERI.map((kategori) => ({
          etiket: kategori.etiket,
          path: `/yayindaki-videolar/${kategori.slug}`,
          gate: (c) => c.rolKucu === "tm" || c.rolKucu === "bm" || YONETICI_ROLLER.includes(c.rolKucu),
        })),
      },
      {
        etiket: "Eğitim Yayınları",
        gate: (c: NavContext) => TUKETICI_ROLLER.includes(c.rolKucu),
        altOglar: UTT_VIDEO_KATEGORILERI.map((kategori) => ({
          etiket: kategori.etiket,
          path: `/videolarim/${kategori.slug}`,
          gate: (c: NavContext) => TUKETICI_ROLLER.includes(c.rolKucu),
        })),
      },
      {
        etiket: "Önerilen Yayınlar",
        path: "/oneriler",
        tamEslesme: true,
        badgeKey: "oneri",
        gate: (c) => TUKETICI_ROLLER.includes(c.rolKucu),
      },
      { etiket: "T-Club Ligi",        path: "/t-club-ligi",       gate: () => true },
      {
        etiket: "T-Club Raporları",
        path: (c) => {
          if (TUKETICI_ROLLER.includes(c.rolKucu)) return "/raporlar/utt";
          if (c.rolKucu === "bm") return "/raporlar/bm";
          if (c.rolKucu === "tm") return "/raporlar/tm";
          if (URETICI_ROLLER.includes(c.rolKucu)) return "/raporlar/tclub-uretici";
          return "/raporlar/yonetici";
        },
        gate: (c) => c.rolKucu !== "iu",
      },
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
    ],
  },

  // ─── 4. E-CLUB (Eczane Kulübü) ───────────────────────────────────────────
  {
    baslik: "E-Club",
    oglar: [
      { etiket: "E-Club Takımım",    path: "/eclub/eczanelerim",  gate: (c) => c.eclubAcik && (YONLENDIRICI_ROLLER.includes(c.rolKucu) || ECLUB_GOREN_ROLLER.includes(c.rolKucu)) },
      {
        etiket: "E-Club Yayınları",
        path: "/eclub/yayinlar",
        badgeKey: "eclub_gonderilecek",
        gate: (c) => c.eclubAcik && (YONLENDIRICI_ROLLER.includes(c.rolKucu) || ECLUB_GOREN_ROLLER.includes(c.rolKucu)),
      },
      { etiket: "E-Club Ligi",       path: "/eclub/ligi",         gate: (c) => c.eclubAcik && ECLUB_YONETIM_ROLLERI.includes(c.rolKucu) },
    ],
  },

  // ─── 5. ECZANEM (Nihai Tüketici Katmanı) ─────────────────────────────────
  {
    baslik: "Eczanem",
    oglar: [
      { etiket: "Eczanem Yayınları", path: "/eczanem/yayinlar",   tamEslesme: true, gate: (c) => c.eczanemAcik && TUKETICI_ROLLER.includes(c.rolKucu) },
      { etiket: "Mutabakat", path: "/eczanem/utt/mutabakat", tamEslesme: true, gate: (c) => c.eczanemAcik && c.rolKucu === "utt" },
      { etiket: "Mutabakat Takip", path: "/eczanem/bm/mutabakat", tamEslesme: true, gate: (c) => c.eczanemAcik && c.rolKucu === "bm" },
      { etiket: "Mutabakat Takip", path: "/eczanem/tm/mutabakat", tamEslesme: true, gate: (c) => c.eczanemAcik && c.rolKucu === "tm" },
    ],
  },
];

const MOBIL_KISISEL_HBSTORE_YOLLARI = new Set([
  "/store",
  "/store/siparislerim",
  "/store/adreslerim",
]);

const mobilKisiselHbstoreGorunur = (ctx: NavContext) =>
  ctx.storeAcik && STORE_ALABILEN_ROLLER.includes(ctx.rolKucu);

/**
 * Mobil drawer'da kişisel HBStore yollarını masaüstü gruplarından ayırır.
 * Masaüstü sidebar'daki kişisel HBStore bağlantıları varsa mobilde tekrarlanmaz.
 */
export function mobilPanelNavOlustur(gruplar: NavGrup[], ctx: NavContext): NavGrup[] {
  const temizGruplar = gruplar.map((grup) => ({
    ...grup,
    oglar: grup.oglar.filter((oge) => {
      const path = typeof oge.path === "string" ? oge.path : null;
      return !path || !MOBIL_KISISEL_HBSTORE_YOLLARI.has(path);
    }),
  }));

  if (!mobilKisiselHbstoreGorunur(ctx)) return temizGruplar;

  const hbstoreGrubu: NavGrup = {
    baslik: "HBStore",
    oglar: [
      { etiket: "HBStore", path: "/store", tamEslesme: true, gate: mobilKisiselHbstoreGorunur },
      { etiket: "Siparişlerim", path: "/store/siparislerim", gate: mobilKisiselHbstoreGorunur },
      { etiket: "Adreslerim", path: "/store/adreslerim", gate: mobilKisiselHbstoreGorunur },
    ],
  };
  const eczanemIndex = temizGruplar.findIndex((grup) => grup.baslik === "Eczanem");
  const eklemeIndexi = eczanemIndex >= 0 ? eczanemIndex + 1 : temizGruplar.length;

  return [
    ...temizGruplar.slice(0, eklemeIndexi),
    hbstoreGrubu,
    ...temizGruplar.slice(eklemeIndexi),
  ];
}

// eclub_kisi (eczacı/teknisyen) dar gezinmesi — kişi paneli + hediye çeki yolları.
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
    baslik: "E-Club Hediye Çeki",
    oglar: [
      { etiket: "Hediye Çeki", path: "/eclub/store", tamEslesme: true, gate: (c) => c.eclubAcik && c.eclubStoreAcik },
      { etiket: "Çek Taleplerim", path: "/eclub/cek-taleplerim", badgeKey: "cek", gate: (c) => c.eclubAcik && c.eclubStoreAcik },
    ],
  },
  {
    baslik: "Eczanem",
    oglar: [
      { etiket: "Müşterilerim",     path: "/eczanem/eczane/musterilerim", gate: (c) => c.eczanemAcik },
      { etiket: "Video Dağıtımı",   path: "/eczanem/eczane/dagitim", badgeKey: "eczanem_video_gonderilecek", gate: (c) => c.eczanemAcik },
      { etiket: "Sipariş Onayı",    path: "/eczanem/eczane/siparisler", badgeKey: "eczanem_siparis_bekleyen", gate: (c) => c.eczanemAcik },
    ],
  },
  ];
}

export const ECLUB_KISI_NAV: NavGrup[] = eclubKisiNavOlustur([]);
