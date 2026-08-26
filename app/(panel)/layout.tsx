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

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import PanelNavbar from "@/components/panel/PanelNavbar";
import SolListe from "@/components/panel/SolListe";
import MobilDrawer from "@/components/panel/MobilDrawer";
import { PANEL_NAV, eclubKisiNavOlustur, type NavContext } from "@/components/panel/panelNav.config";
import { HBSTORE_BAKIYE_DEGISTI } from "@/lib/tclub/store/olay";
import { BILDIRIM_ROZETLERI_DEGISTI } from "@/lib/bildirimler/rozet";
import { HapbiProvider } from "@/components/hapbi/HapbiProvider";
import HapbiMaskot from "@/components/hapbi/HapbiMaskot";
import HapbiChatModal from "@/components/hapbi/HapbiChatModal";
import HapbiSpotlight from "@/components/hapbi/HapbiSpotlight";
import Footer from "@/components/footer/Footer";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { kullanici, yukleniyor, cikisYap } = useAuth();

  const [flags, setFlags] = useState({
    storeAcik: false, ccAcik: false, eclubAcik: false, eclubStoreAcik: false, eczanemAcik: false,
  });
  const [badge, setBadge] = useState<Record<string, number>>({});
  const [drawerAcik, setDrawerAcik] = useState(false);
  // Navbar kişisel özeti — yalnız UTT/KD_UTT için profil/api döndürür (BM sonraya).
  const [ozet, setOzet] = useState<{ haftalikPuan: number; takimSirasi: number | null; siparisPuani: number } | null>(null);
  const [eclubStorePuani, setEclubStorePuani] = useState<number | null>(null);
  const [eclubFirmalar, setEclubFirmalar] = useState<Array<{ firma_id: string; firma_adi: string }>>([]);

  const rolKucu = kullanici?.rol?.trim().toLowerCase() ?? "";
  const isEclubKisi = kullanici?.kimlik_turu === "eclub_kisi";

  // Guard — tek yerde (ana-sayfa'dan birebir; ROLE_MAP kontrolü sayfada kalır).
  useEffect(() => {
    if (yukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (rolKucu === "admin") { router.replace("/admin"); return; }
  }, [kullanici, yukleniyor, rolKucu, router]);

  const profilVeOzetiCek = useCallback(async () => {
    try {
      const res = await fetch("/profil/api", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.profil) {
        setFlags({
          storeAcik: data.profil.hbstore_aktif === true,
          ccAcik: data.profil.cc_aktif === true,
          eclubAcik: data.profil.eclub_aktif === true,
          eclubStoreAcik: data.profil.eclub_store_aktif === true,
          eczanemAcik: data.profil.eczanem_aktif === true,
        });
      }
      if (data.navbar_ozet) {
        setOzet({
          haftalikPuan: data.navbar_ozet.haftalik_puan ?? 0,
          takimSirasi: data.navbar_ozet.takim_sirasi ?? null,
          siparisPuani: data.navbar_ozet.siparis_puani ?? 0,
        });
      } else setOzet(null);
      setEclubStorePuani(data.eclub_navbar_ozet?.store_puani ?? null);
      setEclubFirmalar(data.eclub_firmalar ?? []);
    } catch {}
  }, []);

  // Firma bayrakları + Navbar özeti. Sipariş/iptal sonrası aynı oturumda bakiye
  // yeniden okunur; sekmeye geri dönüldüğünde de eski değer ekranda kalmaz.
  useEffect(() => {
    const ilkYukleme = window.setTimeout(profilVeOzetiCek, 0);
    const yenile = () => profilVeOzetiCek();
    const gorunurluk = () => {
      if (document.visibilityState === "visible") profilVeOzetiCek();
    };
    window.addEventListener(HBSTORE_BAKIYE_DEGISTI, yenile);
    document.addEventListener("visibilitychange", gorunurluk);
    return () => {
      window.clearTimeout(ilkYukleme);
      window.removeEventListener(HBSTORE_BAKIYE_DEGISTI, yenile);
      document.removeEventListener("visibilitychange", gorunurluk);
    };
  }, [profilVeOzetiCek]);

  // Rozet çekimi (B) — bir kez burada; SolListe + MobilDrawer'a dağıtılır.
  // E-Club kişisinde genel üretim bildirimleri yerine yalnız aktif eczanenin
  // bekleyen indirim talepleri okunur; açık oturum 30 saniyede bir tazelenir.
  useEffect(() => {
    if (!rolKucu) return;
    const badgelariCek = async () => {
      try {
        const adres = isEclubKisi ? "/eczanem/eczane/api/rozet" : "/bildirimler/api";
        const res = await fetch(adres, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setBadge(data.sayilar ?? {});
        }
      } catch {}
    };
    badgelariCek();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") badgelariCek();
    };
    const zamanlayici = isEclubKisi
      ? window.setInterval(() => {
          if (document.visibilityState === "visible") badgelariCek();
        }, 30000)
      : null;
    window.addEventListener(BILDIRIM_ROZETLERI_DEGISTI, badgelariCek);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      if (zamanlayici !== null) window.clearInterval(zamanlayici);
      window.removeEventListener(BILDIRIM_ROZETLERI_DEGISTI, badgelariCek);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [rolKucu, isEclubKisi]);

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
  const gruplar = kullanici.kimlik_turu === "eclub_kisi" ? eclubKisiNavOlustur(eclubFirmalar) : PANEL_NAV;
  const anaSayfaYolu = isEclubKisi ? "/eclub/panel" : "/ana-sayfa";

  return (
    <HapbiProvider>
      <div style={{ height: "100vh", background: "#f9fafb", fontFamily: "'Nunito', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <PanelNavbar
          adSoyad={kullanici.adSoyad}
          email={kullanici.email}
          ozet={isEclubKisi ? null : ozet}
          siparisPuaniGoster={!isEclubKisi && flags.storeAcik}
          anaSayfaYolu={anaSayfaYolu}
          eclubStorePuani={isEclubKisi && flags.eclubStoreAcik ? eclubStorePuani : null}
          onCikis={cikisYap}
          onHamburger={() => setDrawerAcik(true)}
        />

        <MobilDrawer
          {...ctx}
          gruplar={gruplar}
          badge={badge}
          acik={drawerAcik}
          onKapat={() => setDrawerAcik(false)}
          onCikis={cikisYap}
          anaSayfaYolu={anaSayfaYolu}
        />

        <div className="flex flex-1" style={{ minHeight: 0 }}>
          <SolListe {...ctx} gruplar={gruplar} badge={badge} />
          <main className="flex-1 overflow-y-auto flex flex-col justify-between" style={{ minWidth: 0 }}>
            <div className="flex-1">{children}</div>
            <Footer />
          </main>
        </div>

        {/* Canlı 3D Hapbi Maskotu ve İnteraktif Tur Bileşenleri */}
        <HapbiMaskot />
        <HapbiChatModal />
        <HapbiSpotlight />
      </div>
    </HapbiProvider>
  );
}
