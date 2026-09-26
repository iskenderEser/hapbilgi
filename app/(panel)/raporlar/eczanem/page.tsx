"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Package,
  Pill,
  Sparkles,
  Store,
} from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import RaporPeriyotSecici from "@/components/raporlar/RaporPeriyotSecici";
import { ECZANEM_RAPOR_GOREN_ROLLER, ECZANEM_TALEP_ACAN_ROLLER, YONETICI_ROLLER } from "@/lib/utils/roller";
import { KIRMIZI, type Periyot } from "@/lib/utils/raporUtils";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";
import IndirimliSatisTablosu from "./_components/IndirimliSatisTablosu";
import type { IndirimliSatisSatiri } from "@/lib/eczanem/dokum";
import { useRapor } from "@/hooks/useRapor";
import styles from "../utt/utt-report.module.css";

const DEFAULT_PERIYOT: Periyot = "bu_ay";

const PERIYOT_KAPSAM_ADI: Record<Periyot, string> = {
  bu_gun: "Bugün",
  bu_hafta: "Bu hafta",
  bu_ay: "Bu ay",
  bu_donem: "Bu dönem",
  bu_yil: "Bu yıl",
};

const PERIYOT_SATIS_ADI: Record<Periyot, string> = {
  bu_gun: "Günlük",
  bu_hafta: "Haftalık",
  bu_ay: "Aylık",
  bu_donem: "Dönemlik",
  bu_yil: "Yıllık",
};

interface KullaniciBilgisi {
  ad: string;
  soyad: string;
  rol: string;
  bolge_adi: string | null;
  takim_adi: string | null;
  firma_adi: string | null;
}

interface PmUrunSatiri {
  urun_id: string;
  urun_adi: string;
  kutu: number;
  indirim_tl: number;
}

interface CascadeEczaneSatiri {
  eczane_id: string;
  toplam_kutu: number;
  toplam_tl: number;
}

interface RaporApiData {
  aktif: boolean;
  tip?: "cascade" | "pm";
  kullanici?: KullaniciBilgisi;
  urunler?: PmUrunSatiri[];
  eczaneler?: CascadeEczaneSatiri[];
  satislar?: IndirimliSatisSatiri[];
  toplam_kutu?: number;
  toplam_tl?: number;
}

function EczanemRaporSkeleton() {
  return (
    <div className={`${styles.page} animate-pulse`} role="status" aria-label="Eczanem Raporları yükleniyor">
      <div className={styles.container}>
        <div className="mb-3 h-4 w-20 rounded bg-slate-200" />
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="h-8 w-52 rounded-lg bg-slate-200" />
            <div className="mt-2 h-4 w-80 max-w-full rounded bg-slate-200" />
          </div>
          <div className="h-11 w-full rounded-[14px] bg-white sm:w-96" />
        </div>
        <div className="mb-5 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-24 rounded-2xl bg-white" />)}
        </div>
        <div className="h-72 rounded-[18px] bg-white" />
      </div>
    </div>
  );
}

export default function EczanemRaporPage() {
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const [periyot, setPeriyot] = useState<Periyot>(DEFAULT_PERIYOT);
  const rolKucu = (kullanici?.rol ?? "").toLowerCase();
  const raporKullaniciId = ECZANEM_RAPOR_GOREN_ROLLER.includes(rolKucu) ? kullanici?.id : undefined;
  const { data, loading, yenileniyor, error: hata, yenile } = useRapor<RaporApiData>(
    "/raporlar/api/eczanem",
    periyot,
    raporKullaniciId,
    { onbellekSuresi: 300_000, yenileParametresi: true, oturumOnbellegi: true },
  );

  if (authYukleniyor || (loading && !data)) {
    return <EczanemRaporSkeleton />;
  }

  if (hata && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm" style={{ color: KIRMIZI }}>Hata: {hata}</div>
      </div>
    );
  }

  if (!kullanici || !data) return null;

  const donemAdi = PERIYOT_KAPSAM_ADI[periyot];

  const k: KullaniciBilgisi = data.kullanici ?? {
    ad: kullanici.ad ?? "",
    soyad: kullanici.soyad ?? "",
    rol: kullanici.rol ?? "",
    bolge_adi: null,
    takim_adi: null,
    firma_adi: null,
  };

  const rolKodu = (k.rol || rolKucu).toLowerCase();
  const rolMetni = (k.rol || rolKucu).toUpperCase();

  // Rol-spesifik başlık, eyebrow ve kimlik satırı (BM, TM, PM, Yönetici uyumlu)
  let eyebrowMetni: string | null = "Eczanem dağıtım & erişim analizi";
  let baslikMetni = "Eczanem Raporları";
  let kimlikMetni = `${k.ad} ${k.soyad} · ${rolMetni}`;

  if (rolKodu === "bm" && k.bolge_adi) {
    eyebrowMetni = "Bölge Eczanem dağıtım analizi";
    baslikMetni = `${k.bolge_adi} Bölgesi`;
    kimlikMetni = `${rolMetni} · ${k.ad} ${k.soyad}${k.takim_adi ? ` · ${k.takim_adi}` : ""}`;
  } else if (rolKodu === "tm" && k.takim_adi) {
    eyebrowMetni = "Takım Eczanem dağıtım analizi";
    baslikMetni = `${k.takim_adi} Takımı`;
    kimlikMetni = `${rolMetni} · ${k.ad} ${k.soyad}${k.firma_adi ? ` · ${k.firma_adi}` : ""}`;
  } else if (YONETICI_ROLLER.includes(rolKodu)) {
    eyebrowMetni = "Firma Eczanem dağıtım özeti";
    baslikMetni = k.firma_adi ? `${k.firma_adi}` : "Eczanem Firma Raporu";
    kimlikMetni = `${rolMetni} · ${k.ad} ${k.soyad}`;
  } else if (ECZANEM_TALEP_ACAN_ROLLER.includes(rolKodu)) {
    eyebrowMetni = null;
    baslikMetni = "Eczanem Raporları";
    kimlikMetni = "Tüketicilerin gerçek ürün bilgisi karşılığında kazandıkları değerleri görebilirsiniz";
  }

  // Toplamlar
  let toplamKutu = 0;
  let toplamIndirim = 0;
  let toplamBirimSayisi = 0;

  if (data.tip === "pm") {
    toplamKutu = (data.urunler ?? []).reduce((t, u) => t + (u.kutu || 0), 0);
    toplamIndirim = (data.urunler ?? []).reduce((t, u) => t + (u.indirim_tl || 0), 0);
    toplamBirimSayisi = (data.urunler ?? []).length;
  } else {
    toplamKutu = data.toplam_kutu ?? (data.eczaneler ?? []).reduce((t, e) => t + (e.toplam_kutu || 0), 0);
    toplamIndirim = data.toplam_tl ?? (data.eczaneler ?? []).reduce((t, e) => t + (e.toplam_tl || 0), 0);
    toplamBirimSayisi = (data.eczaneler ?? []).length;
  }

  const metrikKartlari = [
    {
      etiket: "İndirimli Satılan",
      deger: `${toplamKutu.toLocaleString("tr-TR")} Kutu`,
      not: `${PERIYOT_SATIS_ADI[periyot]} satış adedi`,
      icon: Pill,
      vurgu: "#16865f",
      zemin: "#ebf8f2",
    },
    {
      etiket: "Toplam İndirim",
      deger: `₺${toplamIndirim.toLocaleString("tr-TR")}`,
      not: `${donemAdi} uygulanan`,
      icon: Building2,
      vurgu: "#b45309",
      zemin: "#fff7ed",
    },
    {
      etiket: data.tip === "pm" ? "İndirimli Ürün Sayısı" : "Kayıtlı Eczane Sayısı",
      deger: toplamBirimSayisi,
      not: data.tip === "pm"
        ? (data.urunler ?? []).map((urun) => urun.urun_adi).join(", ") || "İndirim uygulanan ürün yok"
        : "Kapsamdaki eczaneler",
      icon: data.tip === "pm" ? Package : Store,
      vurgu: "#237ac8",
      zemin: "#edf6fd",
    },
  ];

  return (
    <div className={styles.page} style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className={styles.container}>
        <Link href="/ana-sayfa" className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#7890aa] hover:text-[#237ac8]">
          <ArrowLeft className="h-3.5 w-3.5" /> Ana Sayfa
        </Link>

        <header className={styles.header}>
          <div className="min-w-0 flex-1">
            {eyebrowMetni && (
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#3589d8]">
                <Sparkles className="h-3.5 w-3.5" /> {eyebrowMetni}
              </div>
            )}
            <div className="inline-flex items-center">
              <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-[#10213d]">
                {baslikMetni}
              </h1>
              <SayfaRehberi anahtar="raporlar-eczanem" className="ml-1.5 -translate-y-1" />
            </div>
            <p className="mt-0.5 text-xs font-semibold text-[#78889d]">
              {kimlikMetni}
            </p>
          </div>

          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
            <RaporPeriyotSecici deger={periyot} onDegistir={setPeriyot} />
            <YenileButonu yenileniyor={yenileniyor} onYenile={yenile} className="min-w-[88px] justify-center" />
          </div>
        </header>
        {(loading || yenileniyor || hata) && (
          <div
            role="status"
            className={`mb-4 rounded-xl border px-3 py-2 text-[11px] font-bold ${hata ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-100 bg-blue-50 text-blue-700"}`}
          >
            {hata
              ? `${hata} Önceki başarılı rapor gösterilmeye devam ediyor.`
              : "Seçilen dönem için rapor güncelleniyor…"}
          </div>
        )}
        {/* Metrik Özet Kartları */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5">
          {metrikKartlari.map((kart) => {
            const Icon = kart.icon;
            return (
              <div
                key={kart.etiket}
                className="rounded-2xl border border-[#dfe7f1] bg-white p-4 shadow-sm flex items-center gap-3.5"
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: kart.zemin, color: kart.vurgu }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <span className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wide">
                    {kart.etiket}
                  </span>
                  <strong className="text-lg font-extrabold text-[#111827] block leading-tight mt-0.5">
                    {kart.deger}
                  </strong>
                  <span className="block text-[11px] text-[#9ca3af] font-medium mt-0.5">
                    {kart.not}
                  </span>
                </div>
              </div>
            );
          })}
        </section>

        {/* İndirimli satış işlem listesi */}
        <section className={`${styles.panel} p-5 md:p-6 mb-8`}>
          <div className="mb-4 border-b border-[#edf2f7] pb-3">
            <h2 className="text-base font-extrabold text-[#111827]">
              {data.tip === "pm" ? "Ürün-Eczane İndirim Listesi" : "Eczane İndirim Listesi"}
            </h2>
          </div>
          <IndirimliSatisTablosu satislar={data.satislar ?? []} />
        </section>
      </div>
    </div>
  );
}
