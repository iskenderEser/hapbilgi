// app/store/page.tsx
//
// HBStore vitrin sayfası. UTT/KD_UTT/BM görür.
//
// Üç blok:
//   - Üst banner: kullanıcı adı + harcanabilir HapPuan
//   - Kategori filtresi: yatay scroll pill bar
//   - Ürün grid: 1/2/3/4 responsive sütun
//
// Kart: görsel + ad + HapPuan + stok + "Detay" butonu (ürün detay sayfasına yönlendirir).
//
// İlgili sayfalar:
//   - /store/[urun_id] — ürün detay + satın alma akışı
//   - /store/adreslerim — adres yönetimi
//   - /store/siparislerim — sipariş geçmişi

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import HataMesaji, { useHataMesaji } from "@/components/HataMesaji";
import { STORE_ALABILEN_ROLLER } from "@/lib/utils/roller";
import { useAuth } from "@/app/providers/AuthProvider";
import type { Urun, Kategori } from "@/lib/store/tipler";
import { STOK_AZ_ESIK } from "@/lib/store/sabitler";

const BORDO = "#bc2d0d";
const MAVI = "#56aeff";
const GRI_METIN = "#737373";
const KOYU_METIN = "#111827";
const GRI_ZEMIN = "#f9fafb";
const YESIL = "#16a34a";
const SARI_TEXT = "#854d0e";

export default function StorePage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const [yetkiKontrolEdildi, setYetkiKontrolEdildi] = useState(false);

  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);
  const [seciliKategori, setSeciliKategori] = useState<string | null>(null);
  const [urunler, setUrunler] = useState<Urun[]>([]);
  const [bakiye, setBakiye] = useState<number>(0);
  const [yukleniyor, setYukleniyor] = useState(true);

  const { mesajlar, hata } = useHataMesaji();

  // Auth + yetki — AuthProvider'dan gelen kullanıcı bilgisini kullan
  useEffect(() => {
    if (authYukleniyor) return; // AuthProvider hâlâ yüklüyorsa bekle

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

  // Başlangıç verileri (kategoriler + bakiye)
  useEffect(() => {
    if (!yetkiKontrolEdildi) return;

    const baslat = async () => {
      try {
        const [katRes, bakRes] = await Promise.all([
          fetch("/store/api?tip=kategoriler"),
          fetch("/store/api?tip=bakiye"),
        ]);

        if (katRes.ok) {
          const d = await katRes.json();
          setKategoriler(d.kategoriler ?? []);
        } else {
          const d = await katRes.json();
          hata(d.hata ?? "Kategoriler yüklenemedi.", d.adim, d.detay);
        }

        if (bakRes.ok) {
          const d = await bakRes.json();
          setBakiye(d.bakiye ?? 0);
        } else {
          const d = await bakRes.json();
          hata(d.hata ?? "Bakiye yüklenemedi.", d.adim, d.detay);
        }
      } catch (err) {
        hata("Veriler yüklenirken hata oluştu.", "fetch", String(err));
      }
    };

    baslat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yetkiKontrolEdildi]);

  // Ürünler (kategori değiştikçe yenile)
  useEffect(() => {
    if (!yetkiKontrolEdildi) return;

    const urunleriYukle = async () => {
      setYukleniyor(true);
      try {
        let url = "/store/api?tip=urunler";
        if (seciliKategori) url += `&kategori_id=${seciliKategori}`;

        const res = await fetch(url);
        const d = await res.json();
        if (!res.ok) {
          hata(d.hata ?? "Ürünler yüklenemedi.", d.adim, d.detay);
          setYukleniyor(false);
          return;
        }
        setUrunler(d.urunler ?? []);
      } catch (err) {
        hata("Ürünler yüklenirken hata oluştu.", "fetch", String(err));
      }
      setYukleniyor(false);
    };

    urunleriYukle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yetkiKontrolEdildi, seciliKategori]);

  const handleCikis = async () => {
    await cikisYap();
    router.push("/login");
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

      <div className="max-w-6xl mx-auto px-3 py-3 md:px-4 md:py-6">
        {/* Üst banner: bakiye + alt eylem butonları */}
        <div
          className="rounded-xl px-5 py-4 mb-5 text-white flex items-center justify-between gap-3 flex-wrap"
          style={{ background: BORDO }}
        >
          <div>
            <div className="text-xs uppercase tracking-wider" style={{ opacity: 0.8 }}>
              Harcanabilir Bakiyen
            </div>
            <div className="text-2xl font-bold mt-1">{bakiye} HapPuan</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => router.push("/store/adreslerim")}
              className="px-3 py-1.5 rounded-lg text-xs cursor-pointer border-none text-white"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              Adreslerim
            </button>
            <button
              onClick={() => router.push("/store/siparislerim")}
              className="px-3 py-1.5 rounded-lg text-xs cursor-pointer border-none text-white"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              Siparişlerim
            </button>
            
            {kullanici.rol.toLowerCase() === "bm" && (
              <button
                onClick={() => router.push("/store/siparisler")}
                className="px-3 py-1.5 rounded-lg text-xs cursor-pointer border-none text-white"
                style={{ background: "rgba(255,255,255,0.2)" }}
              >
                HBStore Siparişleri
              </button>
            )}
          </div>
        </div>

        {/* Kategori filtresi */}
        <div
          className="flex gap-2 mb-5 overflow-x-auto pb-1"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <KategoriButon
            aktif={seciliKategori === null}
            onClick={() => setSeciliKategori(null)}
            etiket="Tümü"
          />
          {kategoriler.map((k) => (
            <KategoriButon
              key={k.kategori_id}
              aktif={seciliKategori === k.kategori_id}
              onClick={() => setSeciliKategori(k.kategori_id)}
              etiket={k.ad}
            />
          ))}
        </div>

        {/* Ürün grid */}
        {yukleniyor ? (
          <div
            className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm"
            style={{ color: GRI_METIN }}
          >
            Yükleniyor...
          </div>
        ) : urunler.length === 0 ? (
          <div
            className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm"
            style={{ color: GRI_METIN }}
          >
            Bu kategoride aktif ürün yok.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {urunler.map((u) => (
              <UrunKarti
                key={u.urun_id}
                urun={u}
                bakiye={bakiye}
                onTikla={() => router.push(`/store/${u.urun_id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Alt bileşenler ──────────────────────────────────────────────────────────

function KategoriButon({
  aktif,
  onClick,
  etiket,
}: {
  aktif: boolean;
  onClick: () => void;
  etiket: string;
}) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-1.5 rounded-full text-xs cursor-pointer border whitespace-nowrap flex-shrink-0"
      style={{
        fontFamily: "'Nunito', sans-serif",
        background: aktif ? BORDO : "white",
        color: aktif ? "white" : KOYU_METIN,
        borderColor: aktif ? BORDO : "#e5e7eb",
      }}
    >
      {etiket}
    </button>
  );
}

function UrunKarti({
  urun,
  bakiye,
  onTikla,
}: {
  urun: Urun;
  bakiye: number;
  onTikla: () => void;
}) {
  const stokYok = urun.stok === 0;
  const stokAz = urun.stok > 0 && urun.stok <= STOK_AZ_ESIK;
  const yetersizBakiye = bakiye < urun.puan_fiyati;

  return (
    <div
      onClick={onTikla}
      className="bg-white border border-gray-200 rounded-xl overflow-hidden cursor-pointer transition-shadow hover:shadow-md flex flex-col"
      style={{ fontFamily: "'Nunito', sans-serif" }}
    >
      {/* Görsel alanı */}
      <div
        className="w-full aspect-square flex items-center justify-center"
        style={{ background: "#f9fafb" }}
      >
        {urun.gorsel_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urun.gorsel_url}
            alt={urun.ad}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="text-xs"
            style={{ color: GRI_METIN }}
          >
            Görsel yok
          </div>
        )}
      </div>

      {/* Bilgi alanı */}
      <div className="px-4 py-3 flex flex-col gap-1.5 flex-1">
        <div
          className="text-sm font-semibold truncate"
          style={{ color: KOYU_METIN }}
        >
          {urun.ad}
        </div>

        <div
          className="text-lg font-bold"
          style={{ color: yetersizBakiye ? GRI_METIN : BORDO }}
        >
          {urun.puan_fiyati} HapPuan
        </div>

        {/* Durum rozetleri */}
        <div className="flex gap-1.5 flex-wrap mt-auto pt-1.5">
          {stokYok && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                color: BORDO,
                background: "#fef2f2",
                border: "0.5px solid #fecaca",
              }}
            >
              Stok yok
            </span>
          )}
          {stokAz && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                color: SARI_TEXT,
                background: "#fefce8",
                border: "0.5px solid #fde68a",
              }}
            >
              Son {urun.stok}
            </span>
          )}
          {!stokYok && !stokAz && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                color: YESIL,
                background: "#f0fdf4",
                border: "0.5px solid #bbf7d0",
              }}
            >
              Stokta
            </span>
          )}
          {yetersizBakiye && !stokYok && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                color: GRI_METIN,
                background: "#f3f4f6",
                border: "0.5px solid #e5e7eb",
              }}
            >
              Yetersiz puan
            </span>
          )}
        </div>
      </div>
    </div>
  );
}