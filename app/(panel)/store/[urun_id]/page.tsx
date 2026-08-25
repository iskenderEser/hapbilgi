// app/(panel)/store/[urun_id]/page.tsx
//
// Ürün detay + satın alma akışı sayfası.
// Genel site dokusuna (1480px, Nunito, kurumsal tasarım dili) uygun olarak modernize edilmiştir.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
  ChevronLeft,
  Minus,
  Package,
  Plus,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { STORE_ALABILEN_ROLLER } from "@/lib/utils/roller";
import { useAuth } from "@/app/providers/AuthProvider";
import { STOK_AZ_ESIK } from "@/lib/tclub/store/sabitler";
import type { Urun, Adres } from "@/lib/tclub/store/tipler";
import { hbstoreBakiyesiDegistiBildir } from "@/lib/tclub/store/olay";

interface UrunDetay extends Urun {
  kategori_adi: string | null;
}

export default function UrunDetayPage() {
  const router = useRouter();
  const params = useParams();
  const urun_id = params?.urun_id as string;

  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
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
    if (!yetkiKontrolEdildi) return;
    verileriYukle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yetkiKontrolEdildi, urun_id]);

  const toplamPuan = (urun?.puan_fiyati ?? 0) * adet;
  const seciliAdres = adresler.find((a) => a.adres_id === seciliAdresId);

  const handleSatinAl = () => {
    if (!urun) return;
    if (adresler.length === 0) {
      hata("Sipariş vermeden önce teslimat adresi eklemelisin.", "adres");
      return;
    }
    if (!seciliAdresId) {
      hata("Lütfen bir teslimat adresi seçin.", "adres");
      return;
    }
    if (toplamPuan > bakiye) {
      hata("Bu sipariş için yeterli bakiyeniz bulunmuyor.", "bakiye");
      return;
    }
    if (adet > urun.stok) {
      hata(`Maksimum ${urun.stok} adet sipariş verebilirsin.`, "stok");
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
          adet,
          adres_id: seciliAdresId,
        }),
      });

      const d = await res.json();

      if (!res.ok) {
        hata(d.hata ?? "Sipariş verilemedi.", d.adim, d.detay);
        setSiparisVeriliyor(false);
        setOnayModal(false);
        return;
      }

      basari("Siparişiniz başarıyla alındı.");
      hbstoreBakiyesiDegistiBildir();
      router.push("/store/siparislerim");
    } catch (err) {
      hata("Sipariş verilirken hata oluştu.", "fetch", String(err));
      setSiparisVeriliyor(false);
      setOnayModal(false);
    }
  };

  if (authYukleniyor || !yetkiKontrolEdildi) {
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

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        {/* Geri Dönüş Linki */}
        <Link
          href="/store"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#71859d] transition-colors hover:text-[#237ac8]"
        >
          <ChevronLeft size={16} /> HBStore Mağazaya Dön
        </Link>

        {yukleniyor ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#dfe7f1] bg-white py-20 text-center shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
            <svg
              className="h-7 w-7 animate-spin text-[#237ac8]"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="mt-3 text-xs font-extrabold text-[#627791]">Ürün detayları yükleniyor...</p>
          </div>
        ) : !urun ? (
          <div className="rounded-2xl border border-[#dfe7f1] bg-white p-12 text-center shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
            <h3 className="text-base font-extrabold text-[#203653]">Ürün bulunamadı</h3>
            <p className="mt-1 text-xs font-semibold text-[#8090a4]">İstediğiniz ürün mevcut değil veya kaldırılmış olabilir.</p>
            <Link
              href="/store"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#237ac8] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#1d69aa]"
            >
              Mağazaya Dön
            </Link>
          </div>
        ) : !urun.aktif_mi ? (
          <div className="rounded-2xl border border-[#dfe7f1] bg-white p-12 text-center shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
            <h3 className="text-base font-extrabold text-[#203653]">Bu ürün şu an satışta değil</h3>
            <p className="mt-1 text-xs font-semibold text-[#8090a4]">Ürün geçici olarak siparişe kapatılmıştır.</p>
            <Link
              href="/store"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#237ac8] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#1d69aa]"
            >
              Diğer Ürünlere Göz At
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            {/* Sol: Görsel */}
            <div className="flex flex-col gap-3 md:col-span-6">
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white p-6 shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
                {urun.gorsel_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={urun.gorsel_url}
                    alt={urun.ad}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-[#9aa9b9]">
                    <Package size={48} strokeWidth={1.5} />
                    <span className="text-xs font-bold">Görsel Yok</span>
                  </div>
                )}

                {/* Stok Rozeti */}
                <div className="absolute right-3.5 top-3.5">
                  {urun.stok === 0 ? (
                    <span className="rounded-full bg-[#b42318] px-3 py-1 text-[10px] font-black text-white shadow-sm">
                      Tükendi
                    </span>
                  ) : urun.stok <= STOK_AZ_ESIK ? (
                    <span className="rounded-full bg-[#fef3c7] px-3 py-1 text-[10px] font-extrabold text-[#92400e] shadow-sm">
                      Son {urun.stok} Ürün
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#ecfdf3] px-3 py-1 text-[10px] font-extrabold text-[#027a48] shadow-sm">
                      Stokta Var
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Sağ: Bilgi & Satın Alma */}
            <div className="flex flex-col gap-4 md:col-span-6">
              {/* Ürün Tanım Kartı */}
              <div className="flex flex-col gap-3 rounded-2xl border border-[#dfe7f1] bg-white p-5 shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
                {urun.kategori_adi && (
                  <span className="w-fit rounded-lg bg-[#eef6fd] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#237ac8]">
                    {urun.kategori_adi}
                  </span>
                )}
                <h1 className="text-xl font-black text-[#1a2d42] md:text-2xl">
                  {urun.ad}
                </h1>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-[#16865f]">
                    {urun.puan_fiyati.toLocaleString("tr-TR")}
                  </span>
                  <span className="text-sm font-extrabold text-[#16865f]">HapPuan</span>
                </div>

                {urun.aciklama && (
                  <div className="border-t border-[#f0f4f8] pt-3 text-xs font-semibold leading-relaxed text-[#6c7f96] whitespace-pre-line">
                    {urun.aciklama}
                  </div>
                )}
              </div>

              {/* Satın Alma Form Kartı */}
              {urun.stok > 0 && (
                <div className="flex flex-col gap-4 rounded-2xl border border-[#dfe7f1] bg-white p-5 shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
                  {/* Adet Seçici */}
                  <div>
                    <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-[#7a8da5]">
                      Sipariş Adedi
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAdet((a) => Math.max(1, a - 1))}
                        disabled={adet <= 1}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#dce5ee] bg-[#f8fafc] text-sm font-bold text-[#475b75] hover:bg-[#edf3f8] disabled:opacity-40"
                      >
                        <Minus size={14} />
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
                        className="h-9 w-16 rounded-xl border border-[#dce5ee] bg-white text-center text-sm font-black text-[#1f334d] focus:border-[#237ac8] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setAdet((a) => Math.min(urun.stok, a + 1))}
                        disabled={adet >= urun.stok}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#dce5ee] bg-[#f8fafc] text-sm font-bold text-[#475b75] hover:bg-[#edf3f8] disabled:opacity-40"
                      >
                        <Plus size={14} />
                      </button>
                      <span className="ml-2 text-xs font-semibold text-[#8a9bb0]">
                        (Maks. {urun.stok} stok)
                      </span>
                    </div>
                  </div>

                  {/* Adres Seçici */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="block text-xs font-extrabold uppercase tracking-wider text-[#7a8da5]">
                        Teslimat Adresi
                      </label>
                      <Link
                        href="/store/adreslerim"
                        className="text-xs font-bold text-[#237ac8] hover:underline"
                      >
                        Adresleri Yönet
                      </Link>
                    </div>

                    {adresler.length === 0 ? (
                      <div className="rounded-xl border border-[#fde68a] bg-[#fefce8] p-3 text-xs font-semibold text-[#92400e]">
                        Kayıtlı teslimat adresiniz bulunmuyor.{" "}
                        <Link href="/store/adreslerim" className="font-extrabold underline">
                          Adres ekleyin
                        </Link>
                      </div>
                    ) : (
                      <select
                        value={seciliAdresId}
                        onChange={(e) => setSeciliAdresId(e.target.value)}
                        className="w-full rounded-xl border border-[#dce5ee] bg-[#f8fafc] px-3.5 py-2.5 text-xs font-bold text-[#1f334d] transition-colors focus:border-[#237ac8] focus:bg-white focus:outline-none"
                      >
                        {adresler.map((a) => (
                          <option key={a.adres_id} value={a.adres_id}>
                            {a.baslik} — {a.ilce} / {a.il} {a.varsayilan_mi ? "★ (Varsayılan)" : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Özet Şerit */}
                  <div className="flex flex-col gap-2 rounded-xl bg-[#f8fafc] p-3.5 text-xs">
                    <div className="flex items-center justify-between text-[#7b8da5]">
                      <span className="font-semibold">Toplam Tutar:</span>
                      <strong className="text-sm font-black text-[#1a2d42]">
                        {toplamPuan.toLocaleString("tr-TR")} Puan
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-[#7b8da5]">
                      <span className="font-semibold">Mevcut Bakiyeniz:</span>
                      <strong className={`font-black ${toplamPuan > bakiye ? "text-[#b42318]" : "text-[#16865f]"}`}>
                        {bakiye.toLocaleString("tr-TR")} Puan
                      </strong>
                    </div>
                  </div>

                  {/* Satın Alma Butonu */}
                  <button
                    type="button"
                    onClick={handleSatinAl}
                    disabled={adresler.length === 0 || !seciliAdresId || toplamPuan > bakiye}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-extrabold transition-colors ${
                      toplamPuan > bakiye
                        ? "cursor-not-allowed bg-[#fee4e2] text-[#b42318]"
                        : adresler.length === 0
                        ? "cursor-not-allowed bg-[#e2e8f0] text-[#94a3b8]"
                        : "bg-[#237ac8] text-white shadow-sm hover:bg-[#1d69aa]"
                    }`}
                  >
                    <ShoppingBag size={16} />
                    {toplamPuan > bakiye
                      ? "Yetersiz Bakiye"
                      : adresler.length === 0
                      ? "Teslimat Adresi Gerekli"
                      : "Siparişi Onayla & Satın Al"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Onay Modalı */}
      {onayModal && urun && seciliAdres && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-[#dfe7f1] bg-white p-6 shadow-2xl">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#3589d8]">
                <Sparkles size={14} /> Sipariş Onayı
              </div>
              <h2 className="mt-1 text-lg font-extrabold text-[#1a2d42]">
                Siparişi Tamamlamak İstiyor Musunuz?
              </h2>
            </div>

            <p className="text-xs font-semibold leading-relaxed text-[#627791]">
              <strong className="text-[#1a2d42]">{adet} adet {urun.ad}</strong> için toplam{" "}
              <strong className="text-[#16865f]">{toplamPuan.toLocaleString("tr-TR")} HapPuan</strong> bakiyenizden düşülecektir.
            </p>

            <div className="rounded-xl border border-[#e4ecf3] bg-[#f8fafc] p-3.5 text-xs text-[#5f738c]">
              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[#8a9bb0]">
                Teslimat Adresi
              </span>
              <strong className="mt-1 block text-sm text-[#1e3450]">{seciliAdres.alici_adi}</strong>
              <span className="block text-[11px] font-medium text-[#7b8ca5]">{seciliAdres.telefon}</span>
              <p className="mt-1 text-xs text-[#475b75]">{seciliAdres.adres_detay}</p>
              <span className="mt-0.5 block text-xs font-bold text-[#203653]">{seciliAdres.ilce} / {seciliAdres.il}</span>
            </div>

            <p className="text-[11px] font-semibold text-[#8a9bb0]">
              ℹ️ Siparişinizi 12 saat içinde iptal edebilirsiniz. Kargo sürecine geçtikten sonra iptal işlemi yapılamaz.
            </p>

            <div className="flex gap-2.5 justify-end pt-2">
              <button
                type="button"
                onClick={() => setOnayModal(false)}
                disabled={siparisVeriliyor}
                className="rounded-xl border border-[#dce5ee] bg-white px-4 py-2.5 text-xs font-extrabold text-[#5f738c] hover:bg-[#f8fafc]"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleOnayla}
                disabled={siparisVeriliyor}
                className="rounded-xl bg-[#237ac8] px-5 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-[#1d69aa] disabled:opacity-50"
              >
                {siparisVeriliyor ? "Sipariş Veriliyor..." : "Onayla ve Siparişi Tamamla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
