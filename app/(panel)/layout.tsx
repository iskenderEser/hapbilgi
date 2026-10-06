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
import { BILDIRIM_ROZETLERI_DEGISTI, bildirimRozetleriniYenile } from "@/lib/bildirimler/rozet";
import { ONERI_ZAMANI_DEGISTI } from "@/lib/tclub/oneri/gorunurluk";
import { HapbiProvider } from "@/components/hapbi/HapbiProvider";
import HapbiMaskot from "@/components/hapbi/HapbiMaskot";
import HapbiChatModal from "@/components/hapbi/HapbiChatModal";
import YarimYuklemeBildirimi from "@/components/ogrenme-araci/YarimYuklemeBildirimi";
import YayinSonucBildirimi from "@/components/panel/YayinSonucBildirimi";
import { STORE_ALABILEN_ROLLER, URETICI_ROLLER } from "@/lib/utils/roller";
import { prefetchTalepMerkezi } from "@/app/(panel)/talepler/_hooks/talepOnbellek";
import { prefetchYayinOzet } from "@/app/(panel)/yayin-yonetimi/_hooks/ozetOnbellek";
import { prefetchYayinKatalog } from "@/lib/video/katalogOnbellek";
import { prefetchUretimRaporu } from "@/app/(panel)/raporlar/yayin-raporlari/_hooks/uretimRaporuOnbellek";
import {
  getPanelCache,
  setPanelCache,
  VARSAYILAN_FLAGS,
  type PanelFlags,
} from "@/lib/panel/panelCache";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { kullanici, yukleniyor, cikisYap } = useAuth();

  // Mahremiyet güvenliği: Kimliği doğrulanmamış hiçbir durumda önbellek okunmaz;
  // güvenli varsayılanlarla başlatılır. Kullanıcı doğrulandığında sessionStorage'dan okunur.
  const [flags, setFlags] = useState<PanelFlags>(VARSAYILAN_FLAGS);
  const [badge, setBadge] = useState<Record<string, number>>({});
  const [drawerAcik, setDrawerAcik] = useState(false);
  const [ozet, setOzet] = useState<{ takimSirasi: number | null; siparisPuani: number } | null>(null);
  const [eclubStorePuani, setEclubStorePuani] = useState<number | null>(null);
  const [eclubFirmalar, setEclubFirmalar] = useState<Array<{ firma_id: string; firma_adi: string }>>([]);
  const [firmaAdi, setFirmaAdi] = useState<string | null>(null);

  const rolKucu = kullanici?.rol?.trim().toLowerCase() ?? "";
  const isEclubKisi = kullanici?.kimlik_turu === "eclub_kisi";

  // Guard — tek yerde (ana-sayfa'dan birebir; ROLE_MAP kontrolü sayfada kalır).
  useEffect(() => {
    if (yukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (rolKucu === "admin") { router.replace("/admin"); return; }
    if (kullanici.kimlik_turu === "musteri") { router.replace("/eczanem"); return; }
  }, [kullanici, yukleniyor, rolKucu, router]);

  // Kullanıcı değiştiğinde veya oturum doğrulandığında kullanıcının kendi önbelleğini yükle
  useEffect(() => {
    if (!kullanici?.id) return;
    const cache = getPanelCache(kullanici.id);
    if (cache) {
      setFlags(cache.flags);
      setOzet(cache.ozet);
      setEclubStorePuani(cache.eclubStorePuani);
      setEclubFirmalar(cache.eclubFirmalar);
    }
  }, [kullanici?.id]);

  // Üretici rolleri için ana sayfa ve panel içi gezinmede tüm kritik sayfaların önbelleğini ısıt
  useEffect(() => {
    if (kullanici && URETICI_ROLLER.includes(rolKucu)) {
      void prefetchYayinOzet(kullanici.id);
      void prefetchTalepMerkezi(kullanici.id);
      void prefetchYayinKatalog("benim", kullanici.id);
      void prefetchUretimRaporu("bu_ay", kullanici.id);
    }
  }, [kullanici, rolKucu]);

  const profilVeOzetiCek = useCallback(async () => {
    try {
      const res = await fetch("/profil/api", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      let guncelFlags = VARSAYILAN_FLAGS;
      if (data.profil) {
        guncelFlags = {
          storeAcik: data.profil.hbstore_aktif === true,
          ccAcik: data.profil.cc_aktif === true,
          eclubAcik: data.profil.eclub_aktif === true,
          eclubStoreAcik: data.profil.eclub_store_aktif === true,
          eczanemAcik: data.profil.eczanem_aktif === true,
          firmaLogoUrl: data.profil.logo_url ?? null,
          ogrenmePlatformuAktif: data.profil.ogrenme_platformu_aktif === true,
        };
        setFlags(guncelFlags);
        if (data.profil.firma_adi) {
          setFirmaAdi(data.profil.firma_adi);
        }
      }
      const guncelOzet = data.navbar_ozet ? {
        takimSirasi: data.navbar_ozet.takim_sirasi ?? null,
        siparisPuani: data.navbar_ozet.siparis_puani ?? 0,
      } : null;
      setOzet(guncelOzet);

      const guncelStorePuan = data.eclub_navbar_ozet?.store_puani ?? null;
      setEclubStorePuani(guncelStorePuan);

      const guncelFirmalar = data.eclub_firmalar ?? [];
      setEclubFirmalar(guncelFirmalar);

      if (kullanici?.id) {
        setPanelCache(kullanici.id, {
          flags: guncelFlags,
          ozet: guncelOzet,
          eclubStorePuani: guncelStorePuan,
          eclubFirmalar: guncelFirmalar,
        });
      }
    } catch {}
  }, [kullanici?.id]);

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
  // E-Club kişisinde uygulama bildirimleri ile eczane operasyon rozetleri
  // birleştirilir; açık oturum 30 saniyede bir tazelenir.
  useEffect(() => {
    if (!rolKucu) return;
    let aktif = true;
    let oneriZamanlayici: number | null = null;
    const badgelariCek = async () => {
      try {
        const adresler = isEclubKisi
          ? ["/bildirimler/api", "/eczanem/eczane/api/rozet"]
          : ["/bildirimler/api"];
        const yanitlar = await Promise.allSettled(adresler.map((adres) => fetch(adres, { cache: "no-store" })));
        const birlesikSayilar: Record<string, number> = {};
        let basariliYanitVar = false;
        let oneriRozetYanitiAlindi = false;
        let sonrakiOneriDegisimi: number | null = null;
        for (const sonuc of yanitlar) {
          if (sonuc.status !== "fulfilled") continue;
          const res = sonuc.value;
          if (!res.ok) continue;
          const data = await res.json();
          Object.assign(birlesikSayilar, data.sayilar ?? {});
          if ("sonraki_oneri_rozet_degisimi" in data) {
            oneriRozetYanitiAlindi = true;
            const zaman = Date.parse(data.sonraki_oneri_rozet_degisimi ?? "");
            sonrakiOneriDegisimi = Number.isFinite(zaman) ? zaman : null;
          }
          basariliYanitVar = true;
        }
        if (!aktif) return;
        if (basariliYanitVar) setBadge(birlesikSayilar);
        if (oneriRozetYanitiAlindi) {
          if (oneriZamanlayici !== null) window.clearTimeout(oneriZamanlayici);
          oneriZamanlayici = sonrakiOneriDegisimi === null ? null : window.setTimeout(() => {
            if (document.visibilityState === "visible") {
              window.dispatchEvent(new Event(ONERI_ZAMANI_DEGISTI));
              void badgelariCek();
            }
          }, Math.min(Math.max(sonrakiOneriDegisimi - Date.now() + 20, 50), 2_147_483_647));
        }
      } catch {}
    };
    badgelariCek();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") badgelariCek();
    };
    const zamanlayici = isEclubKisi
      ? window.setInterval(() => {
          if (document.visibilityState === "visible") bildirimRozetleriniYenile();
        }, 30000)
      : null;
    window.addEventListener(BILDIRIM_ROZETLERI_DEGISTI, badgelariCek);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      aktif = false;
      if (oneriZamanlayici !== null) window.clearTimeout(oneriZamanlayici);
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

  // Yalnızca oturumu doğrulanmış kullanıcıya ait önbellek (kullanıcı bazlı tam izolasyon)
  const userCache = getPanelCache(kullanici.id);

  const etkinFlags: PanelFlags = {
    storeAcik: flags.storeAcik || (userCache?.flags.storeAcik ?? false),
    ccAcik: flags.ccAcik || (userCache?.flags.ccAcik ?? false),
    eclubAcik: flags.eclubAcik || (userCache?.flags.eclubAcik ?? false),
    eclubStoreAcik: flags.eclubStoreAcik || (userCache?.flags.eclubStoreAcik ?? false),
    eczanemAcik: flags.eczanemAcik || (userCache?.flags.eczanemAcik ?? false),
    firmaLogoUrl: flags.firmaLogoUrl ?? userCache?.flags.firmaLogoUrl ?? null,
    ogrenmePlatformuAktif: flags.ogrenmePlatformuAktif || (userCache?.flags.ogrenmePlatformuAktif ?? false),
  };

  const etkinOzet = ozet ?? userCache?.ozet ?? null;
  const etkinFirmalar = eclubFirmalar.length > 0 ? eclubFirmalar : (userCache?.eclubFirmalar ?? []);
  const etkinEclubStorePuani = eclubStorePuani ?? userCache?.eclubStorePuani ?? null;

  const ctx: NavContext = {
    rolKucu,
    kimlikTuru: kullanici.kimlik_turu,
    storeAcik: etkinFlags.storeAcik,
    ccAcik: etkinFlags.ccAcik,
    eclubAcik: etkinFlags.eclubAcik,
    eclubStoreAcik: etkinFlags.eclubStoreAcik,
    eczanemAcik: etkinFlags.eczanemAcik,
  };
  // eclub_kisi (KARAR-4) dar gezinme; diğer herkes tam ağaç.
  const gruplar = kullanici.kimlik_turu === "eclub_kisi" ? eclubKisiNavOlustur(etkinFirmalar) : PANEL_NAV;
  const anaSayfaYolu = isEclubKisi ? "/eclub/panel" : "/ana-sayfa";

  return (
    <HapbiProvider>
      <div style={{ height: "100vh", background: "#f9fafb", fontFamily: "'Nunito', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <PanelNavbar
          adSoyad={kullanici.adSoyad}
          email={kullanici.email}
          ozet={isEclubKisi ? null : etkinOzet}
          siparisPuaniGoster={!isEclubKisi && etkinFlags.storeAcik}
          hbStoreGoster={!isEclubKisi && etkinFlags.storeAcik && STORE_ALABILEN_ROLLER.includes(rolKucu)}
          eclubStoreGeriSayimGoster={Boolean(isEclubKisi && etkinFlags.eclubStoreAcik)}
          anaSayfaYolu={anaSayfaYolu}
          eclubStorePuani={isEclubKisi && etkinFlags.eclubStoreAcik ? etkinEclubStorePuani : null}
          firmaLogoUrl={!isEclubKisi ? etkinFlags.firmaLogoUrl : null}
          ogrenmePlatformuAktif={!isEclubKisi && Boolean(etkinFlags.ogrenmePlatformuAktif)}
          firmaAdi={firmaAdi}
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
          <main className="flex-1 overflow-y-auto" style={{ minWidth: 0 }}>
            {children}
          </main>
        </div>

        {/* bi düğmesi ve sohbet alanı */}
        <HapbiMaskot />
        <HapbiChatModal />
        <YarimYuklemeBildirimi />
        <YayinSonucBildirimi />
      </div>
    </HapbiProvider>
  );
}
