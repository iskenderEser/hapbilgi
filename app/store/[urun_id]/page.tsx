// app/store/[urun_id]/page.tsx
//
// Ürün detay + satın alma akışı sayfası.
//
// İki bölüm:
//   - Üst: ürün görseli + ad + fiyat + stok + açıklama
//   - Alt: satın alma kartı (adet seç + adres seç + satın al butonu)
//
// Satın alma akışı:
//   1. Kullanıcı adet ve adresi seçer
//   2. "Satın Al" tıklar → onay modalı çıkar
//   3. Onaylar → POST /store/api/siparis
//   4. Başarılıysa /store/siparislerim sayfasına yönlendirilir
//   5. Hata varsa banner gösterilir

"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import HataMesaji, { useHataMesaji } from "@/components/HataMesaji";
import { STORE_ALABILEN_ROLLER } from "@/lib/utils/roller";
import { useAuth } from "@/app/providers/AuthProvider";
import { STOK_AZ_ESIK } from "@/lib/store/sabitler";
import type { Urun, Adres } from "@/lib/store/tipler";

interface UrunDetay extends Urun {
  kategori_adi: string | null;
}

const BORDO = "#bc2d0d";
const MAVI = "#56aeff";
const GRI_METIN = "#737373";
const KOYU_METIN = "#111827";
const GRI_ZEMIN = "#f9fafb";
const YESIL = "#16a34a";
const SARI_TEXT = "#854d0e";

export default function UrunDetayPage() {
  const router = useRouter();
  const params = useParams();
  const urun_id = params?.urun_id as string;

  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const [yetkiKontrolEdildi, setYetkiKontrolEdildi] = useState(false);

  const [urun, setUrun] = useState<UrunDetay | null>(null);
  const [adresler, setAdresler] = useState<Adres[]>([]);
  const [bakiye, setBakiye] = useState<number>(0);
  const [yukleniyor, setYukleniyor] = useState(true);

  // Satın alma state
  const [adet, setAdet] = useState<number>(1);
  const [seciliAdresId, setSeciliAdresId] = useState<string>("");
  const [onayModal, setOnayModal] = useState(false);
  const [siparisVeriliyor, setSiparisVeriliyor] = useState(false);

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

  // Veri yükleme
  const verileriYukle = async () => {
    setYukleniyor(true);
    try {
      const [urunRes, adresRes, bakRes] = await Promise.all([
        fetch(`/store/api?tip=urun&urun_id=${urun_id}`),
        fetch("/store/api/adres"),
        fetch("/store/api?tip=bakiye"),
      ]);

      if (urunRes.ok) {
        const d = await urunRes.json();
        setUrun(d.urun);
      } else {
        const d = await urunRes.json();
        hata(d.hata ?? "Ürün yüklenemedi.", d.adim, d.detay);
      }

      if (adresRes.ok) {
        const d = await adresRes.json();
        const adresListesi = d.adresler ?? [];
        setAdresler(adresListesi);
        // Varsayılan adresi seçili yap
        const varsayilan = adresListesi.find((a: Adres) => a.varsayilan_mi);
        if (varsayilan) {
          setSeciliAdresId(varsayilan.adres_id);
        } else if (adresListesi.length > 0) {
          setSeciliAdresId(adresListesi[0].adres_id);
        }
      }

      if (bakRes.ok) {
        const d = await bakRes.json();
        setBakiye(d.bakiye ?? 0);
      }
    } catch (err) {
      hata("Veriler yüklenirken hata oluştu.", "fetch", String(err));
    }
    setYukleniyor(false);
  };

  useEffect(() => {
    if (!yetkiKontrolEdildi || !urun_id) return;
    verileriYukle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yetkiKontrolEdildi, urun_id]);

  const handleCikis = async () => {
    await cikisYap();
    router.push("/login");
  };

  const handleSatinAl = () => {
    if (!urun) return;
    if (!seciliAdresId) {
      hata("Lütfen bir teslimat adresi seç.", "validasyon", undefined);
      return;
    }
    if (adet > urun.stok) {
      hata("Stok yetersiz.", "validasyon", undefined);
      return;
    }
    if (toplamPuan > bakiye) {
      hata("Bakiyen yetmiyor.", "validasyon", undefined);
      return;
    }
    setOnayModal(true);
  };

  const handleOnayla = async () => {
    if (!urun || !seciliAdresId) return;
    setSiparisVeriliyor(true);
    try {
      const res = await fetch("/store/api/siparis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urun_id: urun.urun_id,
          adres_id: seciliAdresId,
          adet,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Sipariş oluşturulamadı.", d.adim, d.detay);
        setSiparisVeriliyor(false);
        return;
      }

      basari("Siparişin alındı!");
      setOnayModal(false);
      setSiparisVeriliyor(false);
      // Siparişlerim sayfasına yönlendir
      router.push("/store/siparislerim");
    } catch (err) {
      hata("Sipariş sırasında hata oluştu.", "fetch", String(err));
      setSiparisVeriliyor(false);
    }
  };

  // Hesaplama
  const toplamPuan = urun ? urun.puan_fiyati * adet : 0;
  const seciliAdres = adresler.find((a) => a.adres_id === seciliAdresId);

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

      <div className="fixed top-20 right-4 z-40 flex flex-col gap-2 max-w-sm">
        {mesajlar.map((m, i) => (
          <HataMesaji key={i} {...m} />
        ))}
      </div>

      <div className="max-w-4xl mx-auto px-3 py-3 md:px-4 md:py-6">
        {/* Geri */}
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

        {yukleniyor ? (
          <div
            className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm"
            style={{ color: GRI_METIN }}
          >
            Yükleniyor...
          </div>
        ) : !urun ? (
          <div
            className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm"
            style={{ color: GRI_METIN }}
          >
            Ürün bulunamadı.
          </div>
        ) : !urun.aktif_mi ? (
          <div
            className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm"
            style={{ color: GRI_METIN }}
          >
            Bu ürün şu an satışta değil.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Sol: görsel */}
            <div
              className="bg-white border border-gray-200 rounded-xl overflow-hidden flex items-center justify-center"
              style={{ aspectRatio: "1 / 1" }}
            >
              {urun.gorsel_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={urun.gorsel_url}
                  alt={urun.ad}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-sm" style={{ color: GRI_METIN }}>
                  Görsel yok
                </div>
              )}
            </div>

            {/* Sağ: bilgi + satın alma */}
            <div className="flex flex-col gap-4">
              {/* Bilgi kartı */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                {urun.kategori_adi && (
                  <div className="text-xs mb-1.5" style={{ color: GRI_METIN }}>
                    {urun.kategori_adi}
                  </div>
                )}
                <h1
                  className="text-xl font-bold mb-2"
                  style={{ color: KOYU_METIN, margin: 0 }}
                >
                  {urun.ad}
                </h1>
                <div
                  className="text-2xl font-bold mb-3"
                  style={{ color: BORDO }}
                >
                  {urun.puan_fiyati} HapPuan
                </div>

                {/* Stok durumu */}
                <div className="mb-3">
                  {urun.stok === 0 ? (
                    <span
                      className="text-xs px-2.5 py-1 rounded-full"
                      style={{
                        color: BORDO,
                        background: "#fef2f2",
                        border: "0.5px solid #fecaca",
                      }}
                    >
                      Stok yok
                    </span>
                  ) : urun.stok <= STOK_AZ_ESIK ? (
                    <span
                      className="text-xs px-2.5 py-1 rounded-full"
                      style={{
                        color: SARI_TEXT,
                        background: "#fefce8",
                        border: "0.5px solid #fde68a",
                      }}
                    >
                      Son {urun.stok} adet
                    </span>
                  ) : (
                    <span
                      className="text-xs px-2.5 py-1 rounded-full"
                      style={{
                        color: YESIL,
                        background: "#f0fdf4",
                        border: "0.5px solid #bbf7d0",
                      }}
                    >
                      Stokta
                    </span>
                  )}
                </div>

                {/* Açıklama */}
                {urun.aciklama && (
                  <div
                    className="text-sm whitespace-pre-line"
                    style={{ color: GRI_METIN, lineHeight: 1.6 }}
                  >
                    {urun.aciklama}
                  </div>
                )}
              </div>

              {/* Satın alma kartı */}
              {urun.stok > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
                  {/* Adet seçici */}
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                      Adet
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAdet((a) => Math.max(1, a - 1))}
                        className="w-8 h-8 rounded-lg border bg-white cursor-pointer text-sm"
                        style={{ border: "0.5px solid #e5e7eb", color: KOYU_METIN }}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={urun.stok}
                        value={adet}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isInteger(v) && v >= 1 && v <= urun.stok) {
                            setAdet(v);
                          }
                        }}
                        className="w-16 text-center px-2 py-1 text-sm rounded-lg bg-white"
                        style={{
                          border: "0.5px solid #e5e7eb",
                          color: KOYU_METIN,
                          fontFamily: "'Nunito', sans-serif",
                        }}
                      />
                      <button
                        onClick={() => setAdet((a) => Math.min(urun.stok, a + 1))}
                        className="w-8 h-8 rounded-lg border bg-white cursor-pointer text-sm"
                        style={{ border: "0.5px solid #e5e7eb", color: KOYU_METIN }}
                      >
                        +
                      </button>
                      <span className="text-xs ml-1" style={{ color: GRI_METIN }}>
                        / {urun.stok} stok
                      </span>
                    </div>
                  </div>

                  {/* Adres seçici */}
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                      Teslimat Adresi
                    </label>
                    {adresler.length === 0 ? (
                      <div
                        className="text-xs px-3 py-2.5 rounded-lg"
                        style={{
                          background: "#fefce8",
                          border: "0.5px solid #fde68a",
                          color: SARI_TEXT,
                        }}
                      >
                        Hiç adresin yok.{" "}
                        <button
                          onClick={() => router.push("/store/adreslerim")}
                          className="font-semibold underline bg-transparent border-none cursor-pointer"
                          style={{ color: SARI_TEXT }}
                        >
                          Adres ekle
                        </button>
                      </div>
                    ) : (
                      <select
                        value={seciliAdresId}
                        onChange={(e) => setSeciliAdresId(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg bg-white cursor-pointer"
                        style={{
                          border: "0.5px solid #e5e7eb",
                          fontFamily: "'Nunito', sans-serif",
                          color: KOYU_METIN,
                        }}
                      >
                        {adresler.map((a) => (
                          <option key={a.adres_id} value={a.adres_id}>
                            {a.baslik} — {a.ilce} / {a.il}
                            {a.varsayilan_mi ? " (varsayılan)" : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Toplam + bakiye */}
                  <div
                    className="rounded-lg px-3 py-2.5 flex flex-col gap-1"
                    style={{ background: GRI_ZEMIN }}
                  >
                    <div className="flex justify-between items-center text-xs" style={{ color: GRI_METIN }}>
                      <span>Toplam</span>
                      <span className="font-semibold" style={{ color: KOYU_METIN }}>
                        {toplamPuan} HapPuan
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs" style={{ color: GRI_METIN }}>
                      <span>Mevcut Bakiyen</span>
                      <span
                        className="font-semibold"
                        style={{ color: toplamPuan > bakiye ? BORDO : YESIL }}
                      >
                        {bakiye} HapPuan
                      </span>
                    </div>
                  </div>

                  {/* Satın al butonu */}
                  <button
                    onClick={handleSatinAl}
                    disabled={
                      adresler.length === 0 ||
                      !seciliAdresId ||
                      toplamPuan > bakiye
                    }
                    className="w-full px-4 py-2.5 rounded-lg text-white text-sm font-semibold cursor-pointer border-none"
                    style={{
                      background: BORDO,
                      opacity:
                        adresler.length === 0 ||
                        !seciliAdresId ||
                        toplamPuan > bakiye
                          ? 0.5
                          : 1,
                      fontFamily: "'Nunito', sans-serif",
                    }}
                  >
                    {toplamPuan > bakiye ? "Yetersiz Bakiye" : "Satın Al"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Onay modalı */}
      {onayModal && urun && seciliAdres && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <div
            className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-md p-5 flex flex-col gap-3"
            style={{ fontFamily: "'Nunito', sans-serif" }}
          >
            <div className="text-base font-semibold" style={{ color: KOYU_METIN }}>
              Siparişi Onayla
            </div>

            <div className="text-sm" style={{ color: GRI_METIN, lineHeight: 1.6 }}>
              <strong style={{ color: KOYU_METIN }}>
                {adet} adet {urun.ad}
              </strong>{" "}
              için{" "}
              <strong style={{ color: BORDO }}>{toplamPuan} HapPuan</strong>{" "}
              düşülecek.
            </div>

            <div
              className="rounded-lg px-3 py-2.5 text-xs"
              style={{ background: GRI_ZEMIN, color: GRI_METIN }}
            >
              <div className="font-semibold mb-0.5" style={{ color: KOYU_METIN }}>
                Teslimat Adresi
              </div>
              <div>
                {seciliAdres.alici_adi} · {seciliAdres.telefon}
              </div>
              <div className="mt-0.5">{seciliAdres.adres_detay}</div>
              <div>
                {seciliAdres.ilce} / {seciliAdres.il}
              </div>
            </div>

            <div className="text-xs" style={{ color: GRI_METIN }}>
              Siparişin 12 saat içinde iptal edebilirsin. Bu süreden sonra
              veya sipariş kargoya verildikten sonra iptal mümkün olmayacak.
            </div>

            <div className="flex gap-2.5 justify-end mt-1">
              <button
                onClick={() => setOnayModal(false)}
                disabled={siparisVeriliyor}
                className="px-4 py-2 rounded-lg border bg-transparent text-gray-500 text-xs cursor-pointer"
                style={{
                  border: "0.5px solid #e5e7eb",
                  opacity: siparisVeriliyor ? 0.4 : 1,
                }}
              >
                Vazgeç
              </button>
              <button
                onClick={handleOnayla}
                disabled={siparisVeriliyor}
                className="px-5 py-2 rounded-lg border-none text-white text-xs font-semibold cursor-pointer"
                style={{
                  background: BORDO,
                  opacity: siparisVeriliyor ? 0.5 : 1,
                }}
              >
                {siparisVeriliyor ? "İşleniyor..." : "Onayla ve Sipariş Ver"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}