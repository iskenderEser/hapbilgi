// app/store/page.tsx
//
// HBStore vitrin sayfası. UTT/KD_UTT/BM görür.
//
// İki blok:
//   - Kategori filtresi: yatay scroll pill bar
//   - Ürün grid: 1/2/3/4 responsive sütun
//
// Kart: görsel + ad + HapPuan + stok + "Detay" butonu (ürün detay sayfasına yönlendirir).
//
// Firma erişim kontrolü (hbstore_aktif) proxy.ts HBStore bekçisinde merkezi olarak yapılır.
//
// İlgili sayfalar:
//   - /store/[urun_id] — ürün detay + satın alma akışı
//   - /store/adreslerim — adres yönetimi
//   - /store/siparislerim — sipariş geçmişi

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Package } from "lucide-react";
import HataMesaji, { useHataMesaji } from "@/components/HataMesaji";
import { STORE_ALABILEN_ROLLER } from "@/lib/utils/roller";
import { useAuth } from "@/app/providers/AuthProvider";
import type { Urun, Kategori } from "@/lib/store/tipler";
import { STOK_AZ_ESIK } from "@/lib/store/sabitler";

const BORDO = "#bc2d0d";
const GRI_METIN = "#737373";
const KOYU_METIN = "#111827";
const GRI_ZEMIN = "#f9fafb";
const YESIL = "#16a34a";
const SARI_TEXT = "#854d0e";

export default function StorePage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();

  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);
  const [seciliKategori, setSeciliKategori] = useState<string | null>(null);
  const [urunler, setUrunler] = useState<Urun[]>([]);
  const [bakiye, setBakiye] = useState<number | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  const { mesajlar, hata } = useHataMesaji();
  const rolKucu = kullanici?.rol?.toLowerCase() ?? "";
  const yetkili = Boolean(kullanici && STORE_ALABILEN_ROLLER.includes(rolKucu));

  // Auth + yetki — AuthProvider'dan gelen kullanıcı bilgisini kullan
  useEffect(() => {
    if (authYukleniyor) return; // AuthProvider hâlâ yüklüyorsa bekle

    if (!kullanici) {
      router.push("/login");
      return;
    }

    if (!STORE_ALABILEN_ROLLER.includes(rolKucu)) {
      router.push("/ana-sayfa");
      return;
    }
  }, [kullanici, authYukleniyor, rolKucu, router]);

  // Başlangıç verileri (kategoriler + bakiye)
  useEffect(() => {
    if (!yetkili) return;

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
  }, [yetkili]);

  // Ürünler (kategori değiştikçe yenile)
  useEffect(() => {
    if (!yetkili) return;

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
  }, [yetkili, seciliKategori]);


  // Loading — auth veya yetki hazır değilse bekle
  if (authYukleniyor || !yetkili) {
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

      <div className="fixed top-20 right-4 z-40 flex flex-col gap-2 max-w-sm">
        {mesajlar.map((m, i) => (
          <HataMesaji key={i} {...m} />
        ))}
      </div>

      <div className="mx-auto max-w-6xl px-3 py-4 md:px-6 md:py-6">
        <div className="mb-5">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#71859d]">
            HBStore
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#203653]">
            Mağazam
          </h1>
          <p className="mt-1 text-xs font-medium text-[#8190a3]">
            Sipariş puanınızla alabileceğiniz ürünleri inceleyin.
          </p>
        </div>

        {/* Kategori filtresi */}
        <div
          className="mb-5 flex gap-2 overflow-x-auto rounded-2xl border border-[#dfe7f1] bg-white p-2 shadow-[0_6px_18px_rgba(31,55,90,0.035)]"
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
  bakiye: number | null;
  onTikla: () => void;
}) {
  const stokYok = urun.stok === 0;
  const stokAz = urun.stok > 0 && urun.stok <= STOK_AZ_ESIK;
  const yetersizBakiye = bakiye !== null && bakiye < urun.puan_fiyati;

  return (
    <button
      type="button"
      onClick={onTikla}
      className="flex w-full flex-col overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white text-left shadow-[0_6px_18px_rgba(31,55,90,0.035)] transition-all hover:-translate-y-0.5 hover:border-[#cbd8e6] hover:shadow-[0_10px_24px_rgba(31,55,90,0.08)]"
      style={{ fontFamily: "'Nunito', sans-serif" }}
    >
      {/* Görsel alanı */}
      <div
        className="flex aspect-[4/3] w-full items-center justify-center border-b border-[#edf1f5] bg-[linear-gradient(145deg,#f8fafc,#eef3f8)]"
      >
        {urun.gorsel_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urun.gorsel_url}
            alt={urun.ad}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-[#9aa9b9]">
            <Package size={28} strokeWidth={1.5} />
            <span className="text-[11px] font-bold">Ürün görseli</span>
          </div>
        )}
      </div>

      {/* Bilgi alanı */}
      <div className="flex flex-1 flex-col gap-1.5 px-4 py-3.5">
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
          {urun.puan_fiyati.toLocaleString("tr-TR")} HapPuan
        </div>

        {/* Durum rozetleri */}
        <div className="flex gap-1.5 flex-wrap mt-auto pt-1.5">
          {stokYok && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
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
              className="text-[10px] px-2 py-0.5 rounded-full"
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
              className="text-[10px] px-2 py-0.5 rounded-full"
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
              className="text-[10px] px-2 py-0.5 rounded-full"
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
    </button>
  );
}
