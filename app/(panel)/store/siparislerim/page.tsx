// app/(panel)/store/siparislerim/page.tsx
//
// Kullanıcının kendi sipariş geçmişi. UTT/KD_UTT/BM görür.
// Genel site dokusuna (1480px, Nunito, kurumsal stat kartları) uygun olarak modernize edilmiştir.

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  Clock3,
  ExternalLink,
  MapPin,
  Package,
  ShoppingBag,
  Sparkles,
  Truck,
  XCircle,
} from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { STORE_ALABILEN_ROLLER } from "@/lib/utils/roller";
import { useAuth } from "@/app/providers/AuthProvider";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import { DURUM_ETIKETLERI, DURUM_RENKLERI, IPTAL_SURE_SAATI } from "@/lib/tclub/store/sabitler";
import { kargoTakipUrl } from "@/lib/tclub/store/kargo";
import type { SiparisGosterim, AdresSnapshot } from "@/lib/tclub/store/tipler";
import { hbstoreBakiyesiDegistiBildir } from "@/lib/tclub/store/olay";

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

export default function SiparislerimPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const [yetkiKontrolEdildi, setYetkiKontrolEdildi] = useState(false);

  const [siparisler, setSiparisler] = useState<SiparisGosterim[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);

  const [iptalEdilecek, setIptalEdilecek] = useState<SiparisGosterim | null>(null);
  const [iptalIslemi, setIptalIslemi] = useState(false);

  const [teslimEdilecek, setTeslimEdilecek] = useState<SiparisGosterim | null>(null);
  const [teslimIslemi, setTeslimIslemi] = useState(false);

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

  const siparisleriYukle = async (sessiz = false) => {
    if (sessiz) setYenileniyor(true);
    else setYukleniyor(true);
    try {
      const res = await fetch("/store/api/siparis");
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Siparişler yüklenemedi.", d.adim, d.detay);
        return;
      }
      setSiparisler(d.siparisler ?? []);
    } catch (err) {
      hata("Siparişler yüklenirken hata oluştu.", "fetch", String(err));
    } finally {
      if (sessiz) setYenileniyor(false);
      else setYukleniyor(false);
    }
  };

  useEffect(() => {
    if (!yetkiKontrolEdildi) return;
    siparisleriYukle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yetkiKontrolEdildi]);

  const handleIptalOnayla = async () => {
    if (!iptalEdilecek) return;
    setIptalIslemi(true);

    try {
      const res = await fetch(`/store/api/siparis/${iptalEdilecek.siparis_id}/iptal`, {
        method: "POST",
      });
      const d = await res.json();

      if (!res.ok) {
        hata(d.hata ?? "Sipariş iptal edilemedi.", d.adim, d.detay);
        setIptalIslemi(false);
        setIptalEdilecek(null);
        return;
      }

      basari("Siparişiniz iptal edildi ve puanınız iade edildi.");
      setIptalEdilecek(null);
      setIptalIslemi(false);
      hbstoreBakiyesiDegistiBildir();
      await siparisleriYukle(true);
    } catch (err) {
      hata("İptal sırasında hata oluştu.", "fetch", String(err));
      setIptalIslemi(false);
      setIptalEdilecek(null);
    }
  };

  const handleTeslimOnayla = async () => {
    if (!teslimEdilecek) return;
    setTeslimIslemi(true);

    try {
      const res = await fetch(`/store/api/siparis/${teslimEdilecek.siparis_id}/teslim`, {
        method: "POST",
      });
      const d = await res.json();

      if (!res.ok) {
        hata(d.hata ?? "İşlem tamamlanamadı.", d.adim, d.detay);
        setTeslimIslemi(false);
        setTeslimEdilecek(null);
        return;
      }

      basari("Sipariş teslim edildi olarak işaretlendi.");
      setTeslimEdilecek(null);
      setTeslimIslemi(false);
      await siparisleriYukle(true);
    } catch (err) {
      hata("İşlem sırasında hata oluştu.", "fetch", String(err));
      setTeslimIslemi(false);
      setTeslimEdilecek(null);
    }
  };

  const iptalEdilebilirMi = (s: SiparisGosterim) => {
    if (s.durum !== "beklemede") return false;
    const olusturmaZamani = new Date(s.created_at).getTime();
    const simdi = Date.now();
    const farkSaat = (simdi - olusturmaZamani) / (1000 * 60 * 60);
    return farkSaat <= IPTAL_SURE_SAATI;
  };

  const tarihFormatla = (dStr: string) => {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dStr));
  };

  const ozet = useMemo(() => {
    const bekleyen = siparisler.filter((s) => s.durum === "beklemede").length;
    const kargoda = siparisler.filter((s) => s.durum === "kargoda").length;
    const teslim = siparisler.filter((s) => s.durum === "teslim_edildi").length;
    return {
      toplam: siparisler.length,
      aktif: bekleyen + kargoda,
      teslim,
    };
  }, [siparisler]);

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
              <Sparkles className="size-3.5" /> HBStore · Sipariş Geçmişi
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">
              Siparişlerim
            </h1>
            <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-[#7b8da3] md:text-sm">
              Verdiğiniz siparişlerin durumlarını, kargo takibini ve teslimat dökümünü inceleyin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <YenileButonu
              yenileniyor={yenileniyor}
              onYenile={() => siparisleriYukle(true)}
              disabled={iptalIslemi || teslimIslemi}
            />
            <Link
              href="/store"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#d7e1ec] bg-white px-3.5 py-2 text-xs font-extrabold text-[#45627f] shadow-sm transition-colors hover:bg-[#f6f9fc]"
            >
              <ShoppingBag size={14} /> Mağazaya Dön
            </Link>
            <Link
              href="/store/adreslerim"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#d7e1ec] bg-white px-3.5 py-2 text-xs font-extrabold text-[#45627f] shadow-sm transition-colors hover:bg-[#f6f9fc]"
            >
              <MapPin size={14} /> Adreslerim
            </Link>
          </div>
        </header>

        <section aria-label="Sipariş Özeti" className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatKarti
            ikon={Package}
            etiket="Toplam Siparişim"
            deger={ozet.toplam}
            detay="HBStore'dan verilen tüm siparişler"
            renk="#237ac8"
            zemin="#edf6fd"
          />
          <StatKarti
            ikon={Truck}
            etiket="Aktif Siparişler"
            deger={ozet.aktif}
            detay="Hazırlanan ve kargodaki gönderiler"
            renk="#b7791f"
            zemin="#fff7e8"
          />
          <StatKarti
            ikon={CheckCircle2}
            etiket="Teslim Edilenler"
            deger={ozet.teslim}
            detay="Başarıyla tamamlanan siparişler"
            renk="#16865f"
            zemin="#edf9f4"
          />
        </section>

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
            <p className="mt-3 text-xs font-extrabold text-[#627791]">Sipariş geçmişi yükleniyor...</p>
          </div>
        ) : siparisler.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#dfe7f1] bg-white py-16 text-center shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-[#f0f4f9] text-[#7a8da5]">
              <Package size={24} />
            </span>
            <h3 className="mt-3 text-sm font-extrabold text-[#203653]">Henüz siparişiniz yok</h3>
            <p className="mt-1 max-w-sm text-xs font-semibold text-[#7b8da5]">
              Mağazadan puanlarınızla ürün seçip ilk siparişinizi hemen oluşturabilirsiniz.
            </p>
            <Link
              href="/store"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#237ac8] px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-[#1d69aa]"
            >
              Mağazaya Git
            </Link>
          </div>
        ) : (
          <section className="flex flex-col gap-3">
            {siparisler.map((s) => {
              const durumStili = DURUM_RENKLERI[s.durum];
              const durumEtiketi = DURUM_ETIKETLERI[s.durum];
              const adres = s.adres_snapshot as AdresSnapshot;
              const urunAdi = s.store_urunler?.ad ?? "Ürün";
              const urunGorsel = s.store_urunler?.gorsel_url ?? null;
              const iptalUygun = iptalEdilebilirMi(s);
              const kargoUrl = kargoTakipUrl(s.kargo_firmasi, s.kargo_takip_no);

              return (
                <article
                  key={s.siparis_id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_6px_18px_rgba(31,55,90,0.035)] transition-all hover:border-[#cbd8e6]"
                >
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between md:p-5">
                    <div className="flex items-start gap-3.5">
                      <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#e8eff6] bg-[#f8fafc] p-1.5 sm:size-20">
                        {urunGorsel ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={urunGorsel} alt={urunAdi} className="h-full w-full object-contain" />
                        ) : (
                          <Package size={24} className="text-[#9aa9b9]" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <strong className="block text-sm font-extrabold text-[#1a2d42] md:text-base">
                          {urunAdi}
                        </strong>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#7c8ea5]">
                          <span>{s.adet} Adet</span>
                          <span>·</span>
                          <strong className="text-[#16865f]">
                            {s.toplam_puan.toLocaleString("tr-TR")} HapPuan
                          </strong>
                          <span>·</span>
                          <span>{tarihFormatla(s.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className="rounded-full px-3 py-1 text-xs font-extrabold shadow-sm"
                        style={{
                          color: durumStili.metin,
                          backgroundColor: durumStili.arka,
                          border: `1px solid ${durumStili.kenar}`,
                        }}
                      >
                        {durumEtiketi}
                      </span>
                    </div>
                  </div>

                  {s.durum === "kargoda" && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f0f4f8] bg-[#fdfaf5] px-4 py-3 md:px-5">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#8c6014]">
                        <Truck size={16} className="text-[#b7791f]" />
                        <span>Kargo Firması: <strong>{s.kargo_firmasi}</strong></span>
                        {s.kargo_takip_no && (
                          <span>(Takip No: <strong>{s.kargo_takip_no}</strong>)</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {kargoUrl && (
                          <a
                            href={kargoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-extrabold text-[#237ac8] hover:underline"
                          >
                            Kargo Takip <ExternalLink size={12} />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setTeslimEdilecek(s)}
                          disabled={teslimIslemi}
                          className="rounded-xl bg-[#16865f] px-3 py-1.5 text-xs font-extrabold text-white shadow-sm hover:bg-[#126f4f]"
                        >
                          Teslim Aldım ✓
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 border-t border-[#edf1f5] bg-[#f8fafc] px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between md:px-5">
                    <div className="flex items-start gap-2 text-[#647891]">
                      <MapPin size={14} className="mt-0.5 shrink-0 text-[#8ba0b7]" />
                      <span>
                        <strong className="text-[#203653]">{adres.baslik}:</strong> {adres.alici_adi} · {adres.telefon} — {adres.adres_detay} ({adres.ilce} / {adres.il})
                      </span>
                    </div>

                    {iptalUygun && (
                      <button
                        type="button"
                        onClick={() => setIptalEdilecek(s)}
                        disabled={iptalIslemi}
                        className="shrink-0 text-xs font-extrabold text-[#b42318] hover:underline"
                      >
                        Siparişi İptal Et
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>

      {iptalEdilecek && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-[#dfe7f1] bg-white p-6 shadow-2xl">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#b42318]">
                <XCircle size={14} /> Sipariş İptali
              </div>
              <h2 className="mt-1 text-lg font-extrabold text-[#1a2d42]">
                Siparişi İptal Etmek İstiyor Musunuz?
              </h2>
            </div>

            <p className="text-xs font-semibold leading-relaxed text-[#627791]">
              <strong className="text-[#1a2d42]">{iptalEdilecek.store_urunler?.ad}</strong> siparişiniz iptal edilecek ve harcanan{" "}
              <strong className="text-[#16865f]">{iptalEdilecek.toplam_puan.toLocaleString("tr-TR")} HapPuan</strong> bakiyenize anında iade edilecektir.
            </p>

            <div className="flex gap-2.5 justify-end pt-2">
              <button
                type="button"
                onClick={() => setIptalEdilecek(null)}
                disabled={iptalIslemi}
                className="rounded-xl border border-[#dce5ee] bg-white px-4 py-2.5 text-xs font-extrabold text-[#5f738c] hover:bg-[#f8fafc]"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleIptalOnayla}
                disabled={iptalIslemi}
                className="rounded-xl bg-[#b42318] px-5 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-[#991b1b] disabled:opacity-50"
              >
                {iptalIslemi ? "İptal Ediliyor..." : "Siparişi İptal Et"}
              </button>
            </div>
          </div>
        </div>
      )}

      {teslimEdilecek && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-[#dfe7f1] bg-white p-6 shadow-2xl">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#16865f]">
                <CheckCircle2 size={14} /> Teslimat Onayı
              </div>
              <h2 className="mt-1 text-lg font-extrabold text-[#1a2d42]">
                Ürünü Teslim Aldığınızı Onaylıyor Musunuz?
              </h2>
            </div>

            <p className="text-xs font-semibold leading-relaxed text-[#627791]">
              <strong className="text-[#1a2d42]">{teslimEdilecek.store_urunler?.ad}</strong> siparişiniz teslim edildi olarak kaydedilecektir.
            </p>

            <div className="flex gap-2.5 justify-end pt-2">
              <button
                type="button"
                onClick={() => setTeslimEdilecek(null)}
                disabled={teslimIslemi}
                className="rounded-xl border border-[#dce5ee] bg-white px-4 py-2.5 text-xs font-extrabold text-[#5f738c] hover:bg-[#f8fafc]"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleTeslimOnayla}
                disabled={teslimIslemi}
                className="rounded-xl bg-[#16865f] px-5 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-[#126f4f] disabled:opacity-50"
              >
                {teslimIslemi ? "İşleniyor..." : "Teslim Aldım"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
