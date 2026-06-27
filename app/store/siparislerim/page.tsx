// app/store/siparislerim/page.tsx
//
// Kullanıcının kendi sipariş geçmişi. UTT/KD_UTT/BM görür.
//
// Her sipariş kartı:
//   - Ürün görseli + adı + adet + toplam puan
//   - Durum rozeti (beklemede/kargoda/teslim_edildi/iptal)
//   - Tarih
//   - Teslimat adresi (snapshot'tan)
//   - Aksiyon butonları (durum bazlı):
//       * beklemede + 12 saat içinde → "İptal Et"
//       * kargoda → kargo firması + takip linki + "Teslim Aldım"
//       * teslim_edildi → teslim tarihi
//       * iptal → iptal sebebi

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import HataMesaji, { useHataMesaji } from "@/components/HataMesaji";
import { STORE_ALABILEN_ROLLER } from "@/lib/utils/roller";
import { useAuth } from "@/app/providers/AuthProvider";
import { DURUM_ETIKETLERI, DURUM_RENKLERI, IPTAL_SURE_SAATI } from "@/lib/store/sabitler";
import { kargoTakipUrl } from "@/lib/store/kargo";
import type { SiparisGosterim, AdresSnapshot } from "@/lib/store/tipler";

const BORDO = "#bc2d0d";
const GRI_METIN = "#737373";
const KOYU_METIN = "#111827";
const GRI_ZEMIN = "#f9fafb";

export default function SiparislerimPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const [yetkiKontrolEdildi, setYetkiKontrolEdildi] = useState(false);

  const [siparisler, setSiparisler] = useState<SiparisGosterim[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  const [iptalEdilecek, setIptalEdilecek] = useState<SiparisGosterim | null>(null);
  const [iptalIslemi, setIptalIslemi] = useState(false);

  const [teslimEdilecek, setTeslimEdilecek] = useState<SiparisGosterim | null>(null);
  const [teslimIslemi, setTeslimIslemi] = useState(false);

  const { mesajlar, hata, basari } = useHataMesaji();

  // Auth + yetki
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

  // Sipariş listesi
  const siparisleriYukle = async () => {
    setYukleniyor(true);
    try {
      const res = await fetch("/store/api/siparis");
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Siparişler yüklenemedi.", d.adim, d.detay);
        setYukleniyor(false);
        return;
      }
      setSiparisler(d.siparisler ?? []);
    } catch (err) {
      hata("Siparişler yüklenirken hata oluştu.", "fetch", String(err));
    }
    setYukleniyor(false);
  };

  useEffect(() => {
    if (!yetkiKontrolEdildi) return;
    siparisleriYukle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yetkiKontrolEdildi]);

  const handleCikis = async () => {
    await cikisYap();
    router.push("/login");
  };

  const handleIptalOnayla = async () => {
    if (!iptalEdilecek) return;
    setIptalIslemi(true);
    try {
      const res = await fetch("/store/api/siparis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siparis_id: iptalEdilecek.siparis_id,
          action: "iptal",
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Sipariş iptal edilemedi.", d.adim, d.detay);
        setIptalIslemi(false);
        return;
      }
      basari("Sipariş iptal edildi. Puan iade edildi.");
      setIptalEdilecek(null);
      setIptalIslemi(false);
      await siparisleriYukle();
    } catch (err) {
      hata("İptal sırasında hata oluştu.", "fetch", String(err));
      setIptalIslemi(false);
    }
  };

  const handleTeslimAldim = async () => {
    if (!teslimEdilecek) return;
    setTeslimIslemi(true);
    try {
      const res = await fetch("/store/api/siparis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siparis_id: teslimEdilecek.siparis_id,
          action: "teslim_aldim",
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Teslim onayı verilemedi.", d.adim, d.detay);
        setTeslimIslemi(false);
        return;
      }
      basari("Teslim onayı verildi.");
      setTeslimEdilecek(null);
      setTeslimIslemi(false);
      await siparisleriYukle();
    } catch (err) {
      hata("İşlem sırasında hata oluştu.", "fetch", String(err));
      setTeslimIslemi(false);
    }
  };

  // 12 saat içinde mi kontrolü
  const iptalEdilebilirMi = (s: SiparisGosterim): boolean => {
    if (s.durum !== "beklemede") return false;
    const olusturma = new Date(s.created_at).getTime();
    const simdi = Date.now();
    const saatFarki = (simdi - olusturma) / (1000 * 60 * 60);
    return saatFarki <= IPTAL_SURE_SAATI;
  };

  // Tarih formatla
  const tarihFormatla = (iso: string | null): string => {
    if (!iso) return "—";
    const t = new Date(iso);
    return t.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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

      <div className="fixed top-20 right-4 z-40 flex flex-col gap-2 max-w-sm">
        {mesajlar.map((m, i) => (
          <HataMesaji key={i} {...m} />
        ))}
      </div>

      <div className="max-w-3xl mx-auto px-3 py-3 md:px-4 md:py-6">
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

        {/* Başlık */}
        <div className="mb-5">
          <h1 className="text-xl font-bold" style={{ color: KOYU_METIN, margin: 0 }}>
            Siparişlerim
          </h1>
          <div className="text-xs mt-1" style={{ color: GRI_METIN }}>
            Verdiğin tüm siparişlerin geçmişi ve durumu.
          </div>
        </div>

        {/* Sipariş listesi */}
        {yukleniyor ? (
          <div
            className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm"
            style={{ color: GRI_METIN }}
          >
            Yükleniyor...
          </div>
        ) : siparisler.length === 0 ? (
          <div
            className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm"
            style={{ color: GRI_METIN }}
          >
            Henüz sipariş vermedin. Mağazadan ürün seçip puanlarını kullanmaya başla.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {siparisler.map((s) => {
              const durumStili = DURUM_RENKLERI[s.durum];
              const durumEtiketi = DURUM_ETIKETLERI[s.durum];
              const adres = s.adres_snapshot as AdresSnapshot;
              const urunAdi = s.store_urunler?.ad ?? "Ürün";
              const urunGorsel = s.store_urunler?.gorsel_url ?? null;
              const iptalUygun = iptalEdilebilirMi(s);
              const kargoUrl = kargoTakipUrl(s.kargo_firmasi, s.kargo_takip_no);

              return (
                <div
                  key={s.siparis_id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                >
                  {/* Üst kısım: görsel + ürün bilgisi + durum */}
                  <div className="flex gap-3 p-4">
                    {/* Görsel */}
                    <div
                      className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
                      style={{ background: GRI_ZEMIN }}
                    >
                      {urunGorsel ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={urunGorsel} alt={urunAdi} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-xs" style={{ color: GRI_METIN }}>
                          Görsel
                        </div>
                      )}
                    </div>

                    {/* Bilgi */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="font-semibold text-sm" style={{ color: KOYU_METIN }}>
                          {urunAdi}
                        </div>
                        <span
                          className="text-xs px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0"
                          style={{
                            color: durumStili.metin,
                            background: durumStili.arka,
                            border: `0.5px solid ${durumStili.kenar}`,
                          }}
                        >
                          {durumEtiketi}
                        </span>
                      </div>
                      <div className="text-xs" style={{ color: GRI_METIN }}>
                        {s.adet} adet × {s.puan_birim_fiyat} HapPuan ={" "}
                        <span className="font-semibold" style={{ color: BORDO }}>
                          {s.toplam_puan} HapPuan
                        </span>
                      </div>
                      <div className="text-xs" style={{ color: GRI_METIN }}>
                        Sipariş tarihi: {tarihFormatla(s.created_at)}
                      </div>
                    </div>
                  </div>

                  {/* Adres */}
                  <div
                    className="px-4 py-2.5 text-xs"
                    style={{ background: GRI_ZEMIN, color: GRI_METIN, borderTop: "0.5px solid #f3f4f6" }}
                  >
                    <span className="font-semibold" style={{ color: KOYU_METIN }}>
                      Teslimat:
                    </span>{" "}
                    {adres.baslik} · {adres.alici_adi} · {adres.telefon}
                    <div className="mt-0.5">
                      {adres.adres_detay} — {adres.ilce} / {adres.il}
                    </div>
                  </div>

                  {/* Durum bazlı detay */}
                  {s.durum === "kargoda" && (
                    <div
                      className="px-4 py-3 border-t flex items-center justify-between gap-3 flex-wrap"
                      style={{ borderColor: "#f3f4f6" }}
                    >
                      <div className="text-xs" style={{ color: GRI_METIN }}>
                        <div className="font-semibold" style={{ color: KOYU_METIN }}>
                          Kargo: {s.kargo_firmasi}
                        </div>
                        <div className="mt-0.5">
                          Takip No:{" "}
                          {kargoUrl ? (
                            <a
                              href={kargoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "#56aeff", textDecoration: "underline" }}
                            >
                              {s.kargo_takip_no}
                            </a>
                          ) : (
                            <span>{s.kargo_takip_no}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setTeslimEdilecek(s)}
                        className="px-3 py-1.5 rounded-lg border-none text-white text-xs font-semibold cursor-pointer"
                        style={{ background: "#16a34a", fontFamily: "'Nunito', sans-serif" }}
                      >
                        Teslim Aldım
                      </button>
                    </div>
                  )}

                  {s.durum === "teslim_edildi" && s.teslim_alma_at && (
                    <div
                      className="px-4 py-2.5 text-xs border-t"
                      style={{ borderColor: "#f3f4f6", color: GRI_METIN }}
                    >
                      <span className="font-semibold" style={{ color: "#16a34a" }}>
                        Teslim alındı:
                      </span>{" "}
                      {tarihFormatla(s.teslim_alma_at)}
                    </div>
                  )}

                  {s.durum === "iptal" && (
                    <div
                      className="px-4 py-2.5 text-xs border-t"
                      style={{ borderColor: "#f3f4f6", color: GRI_METIN }}
                    >
                      <span className="font-semibold" style={{ color: BORDO }}>
                        İptal sebebi:
                      </span>{" "}
                      {s.iptal_sebebi ?? "Belirtilmemiş"}
                    </div>
                  )}

                  {s.durum === "beklemede" && (
                    <div
                      className="px-4 py-3 border-t flex items-center justify-between gap-3 flex-wrap"
                      style={{ borderColor: "#f3f4f6" }}
                    >
                      <div className="text-xs" style={{ color: GRI_METIN }}>
                        {iptalUygun
                          ? `Bu siparişi 12 saat içinde iptal edebilirsin.`
                          : `İptal süresi (12 saat) doldu. Kargo aşamasına geçilince kargo bilgisi burada görünecek.`}
                      </div>
                      {iptalUygun && (
                        <button
                          onClick={() => setIptalEdilecek(s)}
                          className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer bg-white"
                          style={{
                            border: `0.5px solid ${BORDO}`,
                            color: BORDO,
                            fontFamily: "'Nunito', sans-serif",
                          }}
                        >
                          İptal Et
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* İptal onay modalı */}
      {iptalEdilecek && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <div
            className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-sm p-5"
            style={{ fontFamily: "'Nunito', sans-serif" }}
          >
            <div className="text-base font-semibold mb-2" style={{ color: KOYU_METIN }}>
              Siparişi iptal et
            </div>
            <div className="text-sm mb-5" style={{ color: GRI_METIN }}>
              <strong style={{ color: KOYU_METIN }}>
                {iptalEdilecek.store_urunler?.ad ?? "Ürün"}
              </strong>{" "}
              siparişini iptal etmek istediğine emin misin?{" "}
              <strong style={{ color: BORDO }}>{iptalEdilecek.toplam_puan} HapPuan</strong>{" "}
              bakiyene iade edilecek.
            </div>
            <div className="flex gap-2.5 justify-end">
              <button
                onClick={() => setIptalEdilecek(null)}
                disabled={iptalIslemi}
                className="px-4 py-2 rounded-lg border bg-transparent text-xs cursor-pointer"
                style={{
                  border: "0.5px solid #e5e7eb",
                  color: GRI_METIN,
                  opacity: iptalIslemi ? 0.4 : 1,
                }}
              >
                Vazgeç
              </button>
              <button
                onClick={handleIptalOnayla}
                disabled={iptalIslemi}
                className="px-4 py-2 rounded-lg border-none text-white text-xs font-semibold cursor-pointer"
                style={{
                  background: BORDO,
                  opacity: iptalIslemi ? 0.5 : 1,
                }}
              >
                {iptalIslemi ? "İptal ediliyor..." : "İptal Et"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teslim aldım onay modalı */}
      {teslimEdilecek && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <div
            className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-sm p-5"
            style={{ fontFamily: "'Nunito', sans-serif" }}
          >
            <div className="text-base font-semibold mb-2" style={{ color: KOYU_METIN }}>
              Teslim aldım onayı
            </div>
            <div className="text-sm mb-5" style={{ color: GRI_METIN }}>
              <strong style={{ color: KOYU_METIN }}>
                {teslimEdilecek.store_urunler?.ad ?? "Ürün"}
              </strong>{" "}
              siparişini teslim aldın mı? Bu onay verildikten sonra geri alınamaz.
            </div>
            <div className="flex gap-2.5 justify-end">
              <button
                onClick={() => setTeslimEdilecek(null)}
                disabled={teslimIslemi}
                className="px-4 py-2 rounded-lg border bg-transparent text-xs cursor-pointer"
                style={{
                  border: "0.5px solid #e5e7eb",
                  color: GRI_METIN,
                  opacity: teslimIslemi ? 0.4 : 1,
                }}
              >
                Vazgeç
              </button>
              <button
                onClick={handleTeslimAldim}
                disabled={teslimIslemi}
                className="px-4 py-2 rounded-lg border-none text-white text-xs font-semibold cursor-pointer"
                style={{
                  background: "#16a34a",
                  opacity: teslimIslemi ? 0.5 : 1,
                }}
              >
                {teslimIslemi ? "Onaylanıyor..." : "Teslim Aldım"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}