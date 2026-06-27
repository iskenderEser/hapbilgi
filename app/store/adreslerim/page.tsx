// app/store/adreslerim/page.tsx
//
// Kullanıcının adres yönetimi sayfası. UTT/KD_UTT/BM görür.
//
// İşlevler:
//   - Adresleri listeler (varsayılan üstte)
//   - Yeni adres ekle (modal)
//   - Düzenle (modal)
//   - Sil (onaylı)
//   - Varsayılan yap

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import HataMesaji, { useHataMesaji } from "@/components/HataMesaji";
import { STORE_ALABILEN_ROLLER } from "@/lib/utils/roller";
import { useAuth } from "@/app/providers/AuthProvider";
import AdresModal from "@/components/store/AdresModal";
import type { Adres } from "@/lib/store/tipler";

const BORDO = "#bc2d0d";
const MAVI = "#56aeff";
const GRI_METIN = "#737373";
const KOYU_METIN = "#111827";
const GRI_ZEMIN = "#f9fafb";
const YESIL = "#16a34a";

export default function AdreslerimPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const [yetkiKontrolEdildi, setYetkiKontrolEdildi] = useState(false);

  const [adresler, setAdresler] = useState<Adres[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  const [modalAcik, setModalAcik] = useState(false);
  const [duzenlenecek, setDuzenlenecek] = useState<Adres | null>(null);
  const [silinecek, setSilinecek] = useState<Adres | null>(null);
  const [silmeIslemi, setSilmeIslemi] = useState(false);

  const { mesajlar, hata, basari } = useHataMesaji();

  // Auth + yetki — AuthProvider'dan gelen kullanıcı bilgisini kullan
  useEffect(() => {
    if (authYukleniyor) return;

    if (!kullanici) {
      router.push("/login");
      return;
    }

    const r = kullanici.rol.toLowerCase();
    if (!STORE_ALABILEN_ROLLER.includes(r)) {
      router.push("/ana-sayfa");
      return;
    }

    setYetkiKontrolEdildi(true);
  }, [kullanici, authYukleniyor, router]);

  // Adres listesi
  const adresleriYukle = async () => {
    setYukleniyor(true);
    try {
      const res = await fetch("/store/api/adres");
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Adresler yüklenemedi.", d.adim, d.detay);
        setYukleniyor(false);
        return;
      }
      setAdresler(d.adresler ?? []);
    } catch (err) {
      hata("Adresler yüklenirken hata oluştu.", "fetch", String(err));
    }
    setYukleniyor(false);
  };

  useEffect(() => {
    if (!yetkiKontrolEdildi) return;
    adresleriYukle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yetkiKontrolEdildi]);

  const handleCikis = async () => {
    await cikisYap();
    router.push("/login");
  };

  const handleYeniEkle = () => {
    setDuzenlenecek(null);
    setModalAcik(true);
  };

  const handleDuzenle = (adres: Adres) => {
    setDuzenlenecek(adres);
    setModalAcik(true);
  };

  const handleVarsayilanYap = async (adres: Adres) => {
    if (adres.varsayilan_mi) return;
    try {
      const res = await fetch("/store/api/adres", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adres_id: adres.adres_id,
          sadece_varsayilan_yap: true,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Varsayılan ayarlanamadı.", d.adim, d.detay);
        return;
      }
      basari("Varsayılan adres güncellendi.");
      await adresleriYukle();
    } catch (err) {
      hata("İşlem sırasında hata oluştu.", "fetch", String(err));
    }
  };

  const handleSilOnayla = async () => {
    if (!silinecek) return;
    setSilmeIslemi(true);
    try {
      const res = await fetch(
        `/store/api/adres?adres_id=${silinecek.adres_id}`,
        { method: "DELETE" }
      );
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Adres silinemedi.", d.adim, d.detay);
        setSilmeIslemi(false);
        return;
      }
      basari("Adres silindi.");
      setSilinecek(null);
      setSilmeIslemi(false);
      await adresleriYukle();
    } catch (err) {
      hata("Silme sırasında hata oluştu.", "fetch", String(err));
      setSilmeIslemi(false);
    }
  };

  // Loading
  if (authYukleniyor || !kullanici || !yetkiKontrolEdildi) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: GRI_ZEMIN }}
      >
        <svg
          className="animate-spin w-6 h-6"
          style={{ color: GRI_METIN }}
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-20 md:pb-0"
      style={{ background: GRI_ZEMIN, fontFamily: "'Nunito', sans-serif" }}
    >
      <Navbar
        email={kullanici.email}
        rol={kullanici.rol}
        adSoyad={kullanici.adSoyad}
        onCikis={handleCikis}
      />

      {/* Hata/başarı mesajları */}
      <div className="fixed top-20 right-4 z-40 flex flex-col gap-2 max-w-sm">
        {mesajlar.map((m, i) => (
          <HataMesaji key={i} {...m} />
        ))}
      </div>

      <div className="max-w-3xl mx-auto px-3 py-3 md:px-4 md:py-6">
        {/* Geri linki */}
        <button
          onClick={() => router.push("/store")}
          className="flex items-center gap-1.5 text-xs mb-4 bg-transparent border-none cursor-pointer"
          style={{ color: GRI_METIN, fontFamily: "'Nunito', sans-serif" }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          HBStore
        </button>

        {/* Başlık + Yeni Ekle butonu */}
        <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
          <div>
            <h1 className="text-xl font-bold" style={{ color: KOYU_METIN, margin: 0 }}>
              Adreslerim
            </h1>
            <div className="text-xs mt-1" style={{ color: GRI_METIN }}>
              Sipariş verirken kullanacağın teslimat adreslerini yönet.
            </div>
          </div>
          <button
            onClick={handleYeniEkle}
            className="px-4 py-2 rounded-lg border-none text-white text-xs font-semibold cursor-pointer"
            style={{ background: MAVI, fontFamily: "'Nunito', sans-serif" }}
          >
            + Yeni Adres
          </button>
        </div>

        {/* Adres listesi */}
        {yukleniyor ? (
          <div
            className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm"
            style={{ color: GRI_METIN }}
          >
            Yükleniyor...
          </div>
        ) : adresler.length === 0 ? (
          <div
            className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm"
            style={{ color: GRI_METIN }}
          >
            Henüz adres eklemedin. Sipariş verebilmek için en az bir adres eklemen gerekir.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {adresler.map((a) => (
              <div
                key={a.adres_id}
                className="bg-white rounded-xl px-4 py-3"
                style={{
                  border: a.varsayilan_mi
                    ? `0.5px solid ${YESIL}`
                    : "0.5px solid #e5e7eb",
                }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <div
                        className="text-sm font-semibold"
                        style={{ color: KOYU_METIN }}
                      >
                        {a.baslik}
                      </div>
                      {a.varsayilan_mi && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            color: YESIL,
                            background: "#f0fdf4",
                            border: "0.5px solid #bbf7d0",
                          }}
                        >
                          Varsayılan
                        </span>
                      )}
                    </div>
                    <div className="text-sm" style={{ color: KOYU_METIN }}>
                      {a.alici_adi} · {a.telefon}
                    </div>
                    <div className="text-xs mt-1" style={{ color: GRI_METIN }}>
                      {a.adres_detay}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: GRI_METIN }}>
                      {a.ilce} / {a.il}{a.posta_kodu ? ` · ${a.posta_kodu}` : ""}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {!a.varsayilan_mi && (
                      <button
                        onClick={() => handleVarsayilanYap(a)}
                        className="px-3 py-1 rounded-lg border text-xs cursor-pointer bg-white"
                        style={{
                          border: "0.5px solid #e5e7eb",
                          color: GRI_METIN,
                          fontFamily: "'Nunito', sans-serif",
                        }}
                      >
                        Varsayılan Yap
                      </button>
                    )}
                    <button
                      onClick={() => handleDuzenle(a)}
                      className="px-3 py-1 rounded-lg border text-xs cursor-pointer bg-white"
                      style={{
                        border: "0.5px solid #e5e7eb",
                        color: KOYU_METIN,
                        fontFamily: "'Nunito', sans-serif",
                      }}
                    >
                      Düzenle
                    </button>
                    <button
                      onClick={() => setSilinecek(a)}
                      className="px-3 py-1 rounded-lg border text-xs cursor-pointer bg-white"
                      style={{
                        border: `0.5px solid ${BORDO}`,
                        color: BORDO,
                        fontFamily: "'Nunito', sans-serif",
                      }}
                    >
                      Sil
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ekle/düzenle modalı */}
      <AdresModal
        acik={modalAcik}
        mevcutAdres={duzenlenecek}
        onKapat={() => {
          setModalAcik(false);
          setDuzenlenecek(null);
        }}
        onKaydedildi={adresleriYukle}
        hata={hata}
        basari={basari}
      />

      {/* Silme onay modalı */}
      {silinecek && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <div
            className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-sm p-5"
            style={{ fontFamily: "'Nunito', sans-serif" }}
          >
            <div className="text-base font-semibold mb-2" style={{ color: KOYU_METIN }}>
              Adresi sil
            </div>
            <div className="text-sm mb-5" style={{ color: GRI_METIN }}>
              <span className="font-semibold" style={{ color: KOYU_METIN }}>
                {silinecek.baslik}
              </span>{" "}
              başlıklı adresi silmek istediğine emin misin? Bu işlem geri alınamaz.
            </div>
            <div className="flex gap-2.5 justify-end">
              <button
                onClick={() => setSilinecek(null)}
                disabled={silmeIslemi}
                className="px-4 py-2 rounded-lg border bg-transparent text-xs cursor-pointer"
                style={{
                  border: "0.5px solid #e5e7eb",
                  color: GRI_METIN,
                  opacity: silmeIslemi ? 0.4 : 1,
                }}
              >
                İptal
              </button>
              <button
                onClick={handleSilOnayla}
                disabled={silmeIslemi}
                className="px-4 py-2 rounded-lg border-none text-white text-xs font-semibold cursor-pointer"
                style={{
                  background: BORDO,
                  opacity: silmeIslemi ? 0.5 : 1,
                }}
              >
                {silmeIslemi ? "Siliniyor..." : "Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}