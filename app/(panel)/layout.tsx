// app/(panel)/layout.tsx
//
// Panel ortak kabuğu — Faz 1 / Adım 1.5 (docs/ana_sayfa_kabuk_donusum_is_plani.md).
//
// (panel) route group'una taşınan tüm sayfaları saran TEK kabuk:
//   • Auth guard tek yerde (yukleniyor→spinner, !kullanici→/login, admin→/admin).
//   • Firma aktiflik bayrakları profil/api'den BİR KEZ çekilir → NavContext.
//   • Rozet çekimi (B kararı) BİR KEZ burada: bildirimler/api + yayin-yonetimi/api/
//     bekleyenler; SolListe ve MobilDrawer'a prop olarak dağıtılır (30 sn + görünürlük).
//   • Yerleşim: PanelNavbar + (SolListe | eclub_kisi'de ECLUB_KISI_NAV) + main.
//
// Route group URL'i değiştirmez; sayfa (panel) altına taşınınca (Adım 1.7+) bu kabuk
// otomatik uygulanır. Guard/rozet/profil mantığı mevcut Navbar + ana-sayfa'dan birebir.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import PanelNavbar from "@/components/panel/PanelNavbar";
import SolListe from "@/components/panel/SolListe";
import MobilDrawer from "@/components/panel/MobilDrawer";
import { PANEL_NAV, ECLUB_KISI_NAV, type NavContext } from "@/components/panel/panelNav.config";
import { URETICI_ROLLER } from "@/lib/utils/roller";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { kullanici, yukleniyor, cikisYap } = useAuth();

  const [flags, setFlags] = useState({
    storeAcik: false, ccAcik: false, eclubAcik: false, eclubStoreAcik: false, eczanemAcik: false,
  });
  const [badge, setBadge] = useState<Record<string, number>>({});
  const [yayinBekleyen, setYayinBekleyen] = useState(0);
  const [drawerAcik, setDrawerAcik] = useState(false);
  // Navbar kişisel özeti — yalnız UTT/KD_UTT için profil/api döndürür (BM sonraya).
  const [ozet, setOzet] = useState<{ haftalikPuan: number; takimSirasi: number | null; siparisPuani: number } | null>(null);

  const rolKucu = kullanici?.rol?.trim().toLowerCase() ?? "";
  const isUretici = URETICI_ROLLER.includes(rolKucu);

  // Guard — tek yerde (ana-sayfa'dan birebir; ROLE_MAP kontrolü sayfada kalır).
  useEffect(() => {
    if (yukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (rolKucu === "admin") { router.replace("/admin"); return; }
  }, [kullanici, yukleniyor, rolKucu, router]);

  // Firma aktiflik bayrakları — bir kez (mevcut Navbar useEffect'i).
  useEffect(() => {
    fetch("/profil/api")
      .then((res) => res.json())
      .then((data) => {
        if (data.profil) {
          setFlags({
            storeAcik: data.profil.hbstore_aktif === true,
            ccAcik: data.profil.cc_aktif === true,
            eclubAcik: data.profil.eclub_aktif === true,
            eclubStoreAcik: data.profil.eclub_store_aktif === true,
            eczanemAcik: data.profil.eczanem_aktif === true,
          });
        }
        // Navbar özeti — navbar_ozet yalnız UTT/KD_UTT payload'ında bulunur.
        if (data.navbar_ozet) {
          setOzet({
            haftalikPuan: data.navbar_ozet.haftalik_puan ?? 0,
            takimSirasi: data.navbar_ozet.takim_sirasi ?? null,
            siparisPuani: data.navbar_ozet.siparis_puani ?? 0,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Rozet çekimi (B) — bir kez burada; SolListe + MobilDrawer'a dağıtılır.
  useEffect(() => {
    if (!rolKucu) return;
    const badgelariCek = async () => {
      try {
        const res = await fetch("/bildirimler/api");
        if (res.ok) {
          const data = await res.json();
          setBadge(data.sayilar ?? {});
        }
      } catch {}
      if (isUretici) {
        try {
          const res = await fetch("/yayin-yonetimi/api/bekleyenler?sayi=1");
          if (res.ok) {
            const data = await res.json();
            setYayinBekleyen(data.sayi ?? 0);
          }
        } catch {}
      }
    };
    badgelariCek();
    const interval = setInterval(badgelariCek, 30000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") badgelariCek();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [rolKucu, isUretici]);

  if (yukleniyor || !kullanici) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg className="animate-spin" style={{ width: 24, height: 24, color: "#737373" }} fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const ctx: NavContext = {
    rolKucu,
    kimlikTuru: kullanici.kimlik_turu,
    storeAcik: flags.storeAcik,
    ccAcik: flags.ccAcik,
    eclubAcik: flags.eclubAcik,
    eclubStoreAcik: flags.eclubStoreAcik,
    eczanemAcik: flags.eczanemAcik,
  };
  // eclub_kisi (KARAR-4) dar gezinme; diğer herkes tam ağaç.
  const gruplar = kullanici.kimlik_turu === "eclub_kisi" ? ECLUB_KISI_NAV : PANEL_NAV;

  return (
    <div style={{ height: "100vh", background: "#f9fafb", fontFamily: "'Nunito', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <PanelNavbar adSoyad={kullanici.adSoyad} email={kullanici.email} ozet={ozet} onCikis={cikisYap} onHamburger={() => setDrawerAcik(true)} />

      <MobilDrawer
        {...ctx}
        gruplar={gruplar}
        badge={badge}
        yayinBekleyen={yayinBekleyen}
        acik={drawerAcik}
        onKapat={() => setDrawerAcik(false)}
      />

      <div className="flex flex-1" style={{ minHeight: 0 }}>
        <SolListe {...ctx} gruplar={gruplar} badge={badge} yayinBekleyen={yayinBekleyen} />
        <main className="flex-1 overflow-y-auto" style={{ minWidth: 0 }}>{children}</main>
      </div>
    </div>
  );
}
