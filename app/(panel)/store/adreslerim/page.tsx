// app/(panel)/store/adreslerim/page.tsx
//
// Kullanıcının adres yönetimi sayfası. UTT/KD_UTT/BM görür.
// Genel site dokusuna (1480px, Nunito, kurumsal kartlar) uygun olarak modernize edilmiştir.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Edit2,
  MapPin,
  Package,
  Plus,
  ShoppingBag,
  Sparkles,
  Star,
  Trash2,
  XCircle,
} from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { STORE_ALABILEN_ROLLER } from "@/lib/utils/roller";
import { useAuth } from "@/app/providers/AuthProvider";
import AdresModal from "@/components/store/AdresModal";
import type { Adres } from "@/lib/tclub/store/tipler";

export default function AdreslerimPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const [yetkiKontrolEdildi, setYetkiKontrolEdildi] = useState(false);

  const [adresler, setAdresler] = useState<Adres[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  const [modalAcik, setModalAcik] = useState(false);
  const [duzenlenecek, setDuzenlenecek] = useState<Adres | null>(null);
  const [silinecek, setSilinecek] = useState<Adres | null>(null);
  const [silmeIslemi, setSilmeIslemi] = useState(false);

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
  }, [yetkiKontrolEdildi]);

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
          varsayilan_mi: true,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Varsayılan adres güncellenemedi.", d.adim, d.detay);
        return;
      }
      basari("Varsayılan teslimat adresi güncellendi.");
      await adresleriYukle();
    } catch (err) {
      hata("İşlem sırasında hata oluştu.", "fetch", String(err));
    }
  };

  const handleSilOnayla = async () => {
    if (!silinecek) return;
    setSilmeIslemi(true);
    try {
      const res = await fetch(`/store/api/adres?adres_id=${silinecek.adres_id}`, {
        method: "DELETE",
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Adres silinemedi.", d.adim, d.detay);
        setSilmeIslemi(false);
        return;
      }
      basari("Adres başarıyla silindi.");
      setSilinecek(null);
      setSilmeIslemi(false);
      await adresleriYukle();
    } catch (err) {
      hata("Silme sırasında hata oluştu.", "fetch", String(err));
      setSilmeIslemi(false);
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

      <main className="mx-auto flex w-full max-w-[1480px] flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#4f7fb7]">
              <Sparkles className="size-3.5" /> HBStore · Adres Yönetimi
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">
              Adreslerim
            </h1>
            <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-[#7b8da3] md:text-sm">
              Siparişlerinizde kullanacağınız teslimat adreslerini yönetin ve varsayılan adresinizi belirleyin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleYeniEkle}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#237ac8] px-4 py-2 text-xs font-extrabold text-white shadow-sm transition-colors hover:bg-[#1d69aa]"
            >
              <Plus size={15} /> Yeni Adres Ekle
            </button>
            <Link
              href="/store"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#d7e1ec] bg-white px-3.5 py-2 text-xs font-extrabold text-[#45627f] shadow-sm transition-colors hover:bg-[#f6f9fc]"
            >
              <ShoppingBag size={14} /> Mağaza
            </Link>
            <Link
              href="/store/siparislerim"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#d7e1ec] bg-white px-3.5 py-2 text-xs font-extrabold text-[#45627f] shadow-sm transition-colors hover:bg-[#f6f9fc]"
            >
              <Package size={14} /> Siparişlerim
            </Link>
          </div>
        </header>

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
            <p className="mt-3 text-xs font-extrabold text-[#627791]">Adresler yükleniyor...</p>
          </div>
        ) : adresler.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#dfe7f1] bg-white py-16 text-center shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-[#f0f4f9] text-[#7a8da5]">
              <MapPin size={24} />
            </span>
            <h3 className="mt-3 text-sm font-extrabold text-[#203653]">Kayıtlı adresiniz bulunmuyor</h3>
            <p className="mt-1 max-w-sm text-xs font-semibold text-[#7b8da5]">
              Mağazadan sipariş verebilmek için teslimat adresi tanımlamanız gerekir.
            </p>
            <button
              type="button"
              onClick={handleYeniEkle}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#237ac8] px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-[#1d69aa]"
            >
              <Plus size={15} /> İlk Adresinizi Ekleyin
            </button>
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {adresler.map((a) => (
              <article
                key={a.adres_id}
                className={`flex flex-col justify-between overflow-hidden rounded-2xl border bg-white p-5 shadow-[0_6px_18px_rgba(31,55,90,0.035)] transition-all ${
                  a.varsayilan_mi
                    ? "border-[#a3d3be] ring-2 ring-[#e2f5ec]"
                    : "border-[#dfe7f1] hover:border-[#cbd8e6]"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className={a.varsayilan_mi ? "text-[#16865f]" : "text-[#237ac8]"} />
                      <strong className="text-base font-extrabold text-[#1a2d42]">
                        {a.baslik}
                      </strong>
                    </div>

                    {a.varsayilan_mi && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#ecfdf3] px-2.5 py-0.5 text-[9px] font-black text-[#027a48] shadow-sm">
                        <Check size={10} strokeWidth={3} /> Varsayılan
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-col gap-1 text-xs">
                    <span className="font-extrabold text-[#243a53]">{a.alici_adi}</span>
                    <span className="font-medium text-[#7b8da5]">{a.telefon}</span>
                    <p className="mt-1 text-[#50637a] leading-relaxed">{a.adres_detay}</p>
                    <span className="mt-1 font-bold text-[#203653]">
                      {a.ilce} / {a.il} {a.posta_kodu ? `(${a.posta_kodu})` : ""}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[#edf1f5] pt-3">
                  {!a.varsayilan_mi ? (
                    <button
                      type="button"
                      onClick={() => handleVarsayilanYap(a)}
                      className="inline-flex items-center gap-1 text-xs font-extrabold text-[#237ac8] hover:underline"
                    >
                      <Star size={12} /> Varsayılan Yap
                    </button>
                  ) : (
                    <span className="text-[11px] font-semibold text-[#8a9bb0]">
                      Ana Teslimat Adresi
                    </span>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDuzenle(a)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dce5ee] bg-[#f8fafc] text-[#556987] hover:bg-[#edf3f8]"
                      title="Düzenle"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSilinecek(a)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#fbd5d5] bg-[#fff5f5] text-[#b42318] hover:bg-[#fee2e2]"
                      title="Sil"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>

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

      {silinecek && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-[#dfe7f1] bg-white p-6 shadow-2xl">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#b42318]">
                <XCircle size={14} /> Adres Silme
              </div>
              <h2 className="mt-1 text-lg font-extrabold text-[#1a2d42]">
                Adresi Silmek İstiyor Musunuz?
              </h2>
            </div>

            <p className="text-xs font-semibold leading-relaxed text-[#627791]">
              <strong className="text-[#1a2d42]">{silinecek.baslik}</strong> başlıklı adres kalıcı olarak silinecektir. Bu işlem geri alınamaz.
            </p>

            <div className="flex gap-2.5 justify-end pt-2">
              <button
                type="button"
                onClick={() => setSilinecek(null)}
                disabled={silmeIslemi}
                className="rounded-xl border border-[#dce5ee] bg-white px-4 py-2.5 text-xs font-extrabold text-[#5f738c] hover:bg-[#f8fafc]"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleSilOnayla}
                disabled={silmeIslemi}
                className="rounded-xl bg-[#b42318] px-5 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-[#991b1b] disabled:opacity-50"
              >
                {silmeIslemi ? "Siliniyor..." : "Evet, Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}