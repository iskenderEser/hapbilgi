// app/(panel)/store/page.tsx
//
// HBStore vitrin sayfası. UTT/KD_UTT/BM görür.
// Genel site dokusuna (1480px, Nunito, kurumsal stat kartları, modern filtreler) uygun olarak modernize edilmiştir.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Coins,
  Inbox,
  Layers3,
  MapPin,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { STORE_ALABILEN_ROLLER } from "@/lib/utils/roller";
import { useAuth } from "@/app/providers/AuthProvider";
import type { Urun, Kategori } from "@/lib/tclub/store/tipler";
import { STOK_AZ_ESIK } from "@/lib/tclub/store/sabitler";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";

function StatKarti({
  ikon: Icon,
  etiket,
  deger,
  detay,
  renk = "#237ac8",
  zemin = "#edf6fd",
}: {
  ikon: React.ComponentType<{ className?: string; size?: number }>;
  etiket: string;
  deger: string | number;
  detay: string;
  renk?: string;
  zemin?: string;
}) {
  return (
    <article
      className="flex items-start justify-between gap-3 rounded-2xl border border-[#dfe7f1] bg-white p-4 shadow-[0_6px_18px_rgba(31,55,90,0.035)]"
      style={{ borderLeft: `4px solid ${renk}` }}
    >
      <div className="min-w-0">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#7d8fa5]">{etiket}</span>
        <strong className="mt-1 block text-2xl font-black tracking-tight text-[#1e3450]">{deger}</strong>
        <span className="mt-1 block truncate text-xs font-semibold text-[#8292a7]">{detay}</span>
      </div>
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-xl"
        style={{ color: renk, backgroundColor: zemin }}
      >
        <Icon size={20} />
      </span>
    </article>
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
    <article
      className="group flex flex-col overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white text-left shadow-[0_6px_18px_rgba(31,55,90,0.035)] transition-all duration-200 hover:-translate-y-1 hover:border-[#b7d3f2] hover:shadow-[0_12px_28px_rgba(31,55,90,0.08)]"
    >
      {/* Görsel Alanı */}
      <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-[#edf1f5] bg-[#f8fafc] p-3">
        {urun.gorsel_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urun.gorsel_url}
            alt={urun.ad}
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-[#9aa9b9]">
            <Package size={32} strokeWidth={1.5} />
            <span className="text-[10px] font-bold">Görsel Yok</span>
          </div>
        )}

        {/* Stok Rozetleri */}
        <div className="absolute right-2.5 top-2.5 flex flex-col items-end gap-1">
          {stokYok ? (
            <span className="rounded-full bg-[#b42318] px-2.5 py-0.5 text-[9px] font-black text-white shadow-sm">
              Tükendi
            </span>
          ) : stokAz ? (
            <span className="rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-[9px] font-extrabold text-[#92400e] shadow-sm">
              Son {urun.stok} Ürün
            </span>
          ) : (
            <span className="rounded-full bg-[#ecfdf3] px-2.5 py-0.5 text-[9px] font-extrabold text-[#027a48] shadow-sm">
              Stokta
            </span>
          )}
        </div>
      </div>

      {/* İçerik Alanı */}
      <div className="flex flex-1 flex-col justify-between p-4">
        <div className="min-w-0">
          <h3 className="line-clamp-1 text-sm font-extrabold text-[#1a2d42]" title={urun.ad}>
            {urun.ad}
          </h3>
          {urun.aciklama && (
            <p className="mt-1 line-clamp-2 text-xs font-semibold leading-relaxed text-[#7c8ea5]">
              {urun.aciklama}
            </p>
          )}
        </div>

        <div className="mt-4 border-t border-[#edf1f5] pt-3">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8292a7]">Puan Değeri</span>
            <strong className={`text-base font-black ${yetersizBakiye ? "text-[#7a8da5]" : "text-[#16865f]"}`}>
              {urun.puan_fiyati.toLocaleString("tr-TR")} Puan
            </strong>
          </div>

          <button
            type="button"
            onClick={onTikla}
            disabled={stokYok}
            className={`flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-colors ${
              stokYok
                ? "cursor-not-allowed bg-[#e2e8f0] text-[#94a3b8]"
                : yetersizBakiye
                ? "bg-[#edf4fc] text-[#237ac8] hover:bg-[#dfeefb]"
                : "bg-[#237ac8] text-white shadow-sm hover:bg-[#1d69aa]"
            }`}
          >
            {stokYok ? "Tükendi" : "İncele & Sipariş Ver"}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function StorePage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();

  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);
  const [seciliKategori, setSeciliKategori] = useState<string | null>(null);
  const [arama, setArama] = useState("");
  const [urunler, setUrunler] = useState<Urun[]>([]);
  const [bakiye, setBakiye] = useState<number | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);

  const { mesajlar, hata } = useHataMesaji();
  const rolKucu = kullanici?.rol?.toLowerCase() ?? "";
  const yetkili = Boolean(kullanici && STORE_ALABILEN_ROLLER.includes(rolKucu));

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) {
      router.push("/login");
      return;
    }
    if (!STORE_ALABILEN_ROLLER.includes(rolKucu)) {
      router.push("/ana-sayfa");
      return;
    }
  }, [kullanici, authYukleniyor, rolKucu, router]);

  const baslangicYukle = useCallback(async () => {
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
  }, [hata]);

  useEffect(() => {
    if (yetkili) void baslangicYukle();
  }, [yetkili, baslangicYukle]);

  const urunleriYukle = useCallback(
    async (ilkYukleme = false) => {
      if (ilkYukleme) setYukleniyor(true);
      try {
        let url = "/store/api?tip=urunler";
        if (seciliKategori) url += `&kategori_id=${seciliKategori}`;

        const res = await fetch(url);
        const d = await res.json();
        if (!res.ok) {
          hata(d.hata ?? "Ürünler yüklenemedi.", d.adim, d.detay);
          return;
        }
        setUrunler(d.urunler ?? []);
      } catch (err) {
        hata("Ürünler yüklenirken hata oluştu.", "fetch", String(err));
      } finally {
        if (ilkYukleme) setYukleniyor(false);
      }
    },
    [seciliKategori, hata]
  );

  useEffect(() => {
    if (yetkili) void urunleriYukle(true);
  }, [yetkili, urunleriYukle]);

  const tumunuYenile = async () => {
    setYenileniyor(true);
    try {
      await Promise.all([baslangicYukle(), urunleriYukle()]);
    } finally {
      setYenileniyor(false);
    }
  };

  const filtrelenmisUrunler = useMemo(() => {
    if (!arama.trim()) return urunler;
    const query = arama.trim().toLocaleLowerCase("tr-TR");
    return urunler.filter((u) => u.ad.toLocaleLowerCase("tr-TR").includes(query));
  }, [urunler, arama]);

  if (authYukleniyor || !yetkili) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f9fc]">
        <svg
          className="h-6 w-6 animate-spin text-[#7a8da5]"
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
    <div className="min-h-full bg-[#f7f9fc] pb-20 md:pb-8" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <HataMesajiContainer mesajlar={mesajlar} />

      <main className="mx-auto flex w-full max-w-[1480px] flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#4f7fb7]">
              <Sparkles className="size-3.5" /> HBStore · T-Club Puan Mağazası
            </p>
            <div className="inline-flex items-center">
              <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">
                Mağazam
              </h1>
              <SayfaRehberi anahtar="store-magaza" className="ml-1.5 -translate-y-1.5" />
            </div>
            <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-[#7b8da3] md:text-sm">
              Kazandığınız başarı puanlarıyla ürünleri inceleyin, sipariş verin ve teslimat durumunu takip edin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <YenileButonu yenileniyor={yenileniyor} onYenile={tumunuYenile} />
            <Link
              href="/store/siparislerim"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#d7e1ec] bg-white px-3.5 py-2 text-xs font-extrabold text-[#45627f] shadow-sm transition-colors hover:bg-[#f6f9fc]"
            >
              <Package size={14} /> Siparişlerim
            </Link>
            <Link
              href="/store/adreslerim"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#d7e1ec] bg-white px-3.5 py-2 text-xs font-extrabold text-[#45627f] shadow-sm transition-colors hover:bg-[#f6f9fc]"
            >
              <MapPin size={14} /> Adreslerim
            </Link>
          </div>
        </header>

        {/* 3'lü Stat Kartları */}
        <section aria-label="Mağaza Durum Özeti" className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatKarti
            ikon={Coins}
            etiket="Kullanılabilir Puanım"
            deger={bakiye !== null ? `${bakiye.toLocaleString("tr-TR")} P` : "—"}
            detay="Sipariş için harcanabilir bakiye"
            renk="#16865f"
            zemin="#edf9f4"
          />
          <StatKarti
            ikon={ShoppingBag}
            etiket="Mağazadaki Ürünler"
            deger={urunler.length}
            detay="Aktif siparişe açık ürün çeşidi"
            renk="#237ac8"
            zemin="#edf6fd"
          />
          <StatKarti
            ikon={Layers3}
            etiket="Kategori Çeşitliliği"
            deger={kategoriler.length}
            detay="Farklı ürün grubu"
            renk="#6550b9"
            zemin="#f2effc"
          />
        </section>

        {/* Arama ve Kategori Filtre Alanı */}
        <section className="flex flex-col gap-3 rounded-2xl border border-[#dfe7f1] bg-white p-4 shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Arama Çubuğu */}
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8fa0b5]" />
              <input
                type="text"
                value={arama}
                onChange={(e) => setArama(e.target.value)}
                placeholder="Ürün adı ara..."
                className="w-full rounded-xl border border-[#dce5ee] bg-[#f8fafc] py-2 pl-9 pr-3.5 text-xs font-bold text-[#1f334d] placeholder-[#8fa0b5] transition-colors focus:border-[#237ac8] focus:bg-white focus:outline-none"
              />
            </div>

            <span className="text-xs font-extrabold text-[#7b8da5]">
              {filtrelenmisUrunler.length} ürün listeleniyor
            </span>
          </div>

          {/* Kategori Pilleri */}
          <div className="flex gap-1.5 overflow-x-auto pt-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSeciliKategori(null)}
              className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs transition-colors ${
                seciliKategori === null
                  ? "bg-[#237ac8] font-black text-white shadow-sm"
                  : "border border-[#dce5ee] bg-[#f8fafc] font-extrabold text-[#556987] hover:bg-[#edf3f8]"
              }`}
            >
              Tümü
            </button>
            {kategoriler.map((k) => (
              <button
                type="button"
                key={k.kategori_id}
                onClick={() => setSeciliKategori(k.kategori_id)}
                className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs transition-colors ${
                  seciliKategori === k.kategori_id
                    ? "bg-[#237ac8] font-black text-white shadow-sm"
                    : "border border-[#dce5ee] bg-[#f8fafc] font-extrabold text-[#556987] hover:bg-[#edf3f8]"
                }`}
              >
                {k.ad}
              </button>
            ))}
          </div>
        </section>

        {/* Ürünler Grid */}
        {yukleniyor ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#dfe7f1] bg-white py-16 text-center shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
            <svg
              className="h-7 w-7 animate-spin text-[#237ac8]"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="mt-3 text-xs font-extrabold text-[#627791]">Ürünler yükleniyor...</p>
          </div>
        ) : filtrelenmisUrunler.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#dfe7f1] bg-white py-16 text-center shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-[#f0f4f9] text-[#7a8da5]">
              <Inbox size={24} />
            </span>
            <h3 className="mt-3 text-sm font-extrabold text-[#203653]">Ürün bulunamadı</h3>
            <p className="mt-1 max-w-sm text-xs font-semibold text-[#7b8da5]">
              {arama.trim()
                ? `"${arama}" aramasına uygun ürün bulunamadı.`
                : "Seçtiğiniz kategoride şu an aktif ürün bulunmuyor."}
            </p>
          </div>
        ) : (
          <section aria-label="Mağaza Ürün Listesi" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtrelenmisUrunler.map((u) => (
              <UrunKarti
                key={u.urun_id}
                urun={u}
                bakiye={bakiye}
                onTikla={() => router.push(`/store/${u.urun_id}`)}
              />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
