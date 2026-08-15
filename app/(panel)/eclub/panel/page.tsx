"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  CirclePlay,
  Clock3,
  Coins,
  Play,
  ShoppingBag,
  Sparkles,
  Trophy,
  Video,
} from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  EclubKisiBaslik,
  EclubKisiBosDurum,
  EclubKisiSayfa,
  EclubKisiStat,
  EclubKisiYukleniyor,
} from "@/components/eclub/EclubKisiSayfa";
import { useEclubPanel, type PanelOneri } from "./_hooks/useEclubPanel";
import EclubVideoOynatici from "./_components/EclubVideoOynatici";

const KISI_ROL_ETIKETLERI: Record<string, string> = {
  eczaci: "Eczacı",
  eczane_teknisyeni: "Eczane Teknisyeni",
};

type VideoFiltresi = "tumu" | "bekleyen" | "tamamlanan" | "suresi_gecmis";

const FILTRELER: Array<{ key: VideoFiltresi; etiket: string }> = [
  { key: "tumu", etiket: "Tümü" },
  { key: "bekleyen", etiket: "Bekleyen" },
  { key: "tamamlanan", etiket: "Tamamlanan" },
  { key: "suresi_gecmis", etiket: "Süresi Geçen" },
];

function videoDurumu(oneri: PanelOneri): Exclude<VideoFiltresi, "tumu"> {
  if (oneri.izlendi_mi) return "tamamlanan";
  return oneri.oneri_durumu === "suresi_gecmis" ? "suresi_gecmis" : "bekleyen";
}

function VideoKart({ oneri, onIzle }: { oneri: PanelOneri; onIzle: () => void }) {
  const durum = videoDurumu(oneri);
  const kazanilan = oneri.kazanilan_izleme_puani + oneri.kazanilan_cevaplama_puani;
  const netPuan = Math.max(0, kazanilan - oneri.ileri_sarma_kaybi);
  const durumStili = durum === "tamamlanan"
    ? "border-[#bce8d4] bg-[#effaf5] text-[#16865f]"
    : durum === "suresi_gecmis"
      ? "border-[#fed7aa] bg-[#fff7ed] text-[#b45309]"
      : "border-[#bfdbfe] bg-[#eff6ff] text-[#2563a8]";

  return (
    <article className="overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
      <div className="grid md:grid-cols-[180px_minmax(0,1fr)]">
        <button type="button" onClick={onIzle} className="group relative min-h-[150px] overflow-hidden bg-[#edf3f8] text-left">
          {oneri.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={oneri.thumbnail_url} alt={oneri.urun_adi} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
          ) : (
            <span className="flex h-full min-h-[150px] items-center justify-center text-[#9babbc]"><Video size={28} /></span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-[#10213d]/10 transition group-hover:bg-[#10213d]/20">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[#237ac8] shadow-lg"><Play size={18} fill="currentColor" /></span>
          </span>
        </button>

        <div className="flex min-w-0 flex-col gap-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-extrabold text-[#203653]">{oneri.urun_adi}</h3>
              <p className="mt-0.5 truncate text-[11px] font-semibold text-[#8190a3]">{oneri.teknik_adi || "Ürün eğitimi"}</p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[9px] font-extrabold ${durumStili}`}>
              {durum === "tamamlanan" ? "Tamamlandı" : durum === "suresi_gecmis" ? "Süresi Geçti" : `${oneri.kalan_gun} Gün Kaldı`}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-[#f5f8fb] px-2.5 py-2"><small className="block text-[9px] font-bold text-[#8190a3]">Video Puanı</small><strong className="mt-0.5 block text-xs text-[#237ac8]">+{oneri.video_puani}</strong></div>
            <div className="rounded-xl bg-[#f5f8fb] px-2.5 py-2"><small className="block text-[9px] font-bold text-[#8190a3]">Soru Puanı</small><strong className="mt-0.5 block text-xs text-[#7358c7]">+{oneri.soru_puani} / soru</strong></div>
            <div className="rounded-xl bg-[#f5f8fb] px-2.5 py-2"><small className="block text-[9px] font-bold text-[#8190a3]">Cevaplar</small><strong className="mt-0.5 block text-xs text-[#40556d]">{oneri.dogru_cevap} doğru · {oneri.yanlis_cevap} yanlış</strong></div>
            <div className="rounded-xl bg-[#eef9f4] px-2.5 py-2"><small className="block text-[9px] font-bold text-[#6b907f]">Net Puan</small><strong className="mt-0.5 block text-xs text-[#16865f]">{netPuan} puan</strong>{oneri.ileri_sarma_kaybi > 0 && <small className="mt-0.5 block text-[9px] font-bold text-[#b23b31]">−{oneri.ileri_sarma_kaybi} ileri sarma</small>}</div>
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[#edf1f5] pt-3">
            <span className="text-[10px] font-semibold text-[#8a99aa]">
              {oneri.soru_sayisi > 0 ? `${oneri.soru_sayisi} soru` : "Soru bulunmuyor"}
              {oneri.oneri_durumu === "suresi_gecmis" ? " · Puansız tekrar izleme" : ""}
            </span>
            <button type="button" onClick={onIzle} className="inline-flex items-center gap-1.5 rounded-xl bg-[#237ac8] px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-[#1d69aa]">
              <CirclePlay size={14} /> {oneri.izlendi_mi ? "Tekrar İzle" : "İzle"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function EclubPanelPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const { mesajlar, hata, basari, uyari } = useHataMesaji();
  const eclubKisi = !!kullanici && kullanici.kimlik_turu === "eclub_kisi";
  const hazir = !authYukleniyor && eclubKisi;
  const { kisi, oneriler, firmaOzetleri, ozet, loading, veriCek } = useEclubPanel({ hazir, hata });
  const [seciliOneri, setSeciliOneri] = useState<PanelOneri | null>(null);
  const [filtre, setFiltre] = useState<VideoFiltresi>("tumu");

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (!eclubKisi) { router.replace("/ana-sayfa"); }
  }, [kullanici, authYukleniyor, eclubKisi, router]);

  const filtreliOneriler = useMemo(() => (
    filtre === "tumu" ? oneriler : oneriler.filter((oneri) => videoDurumu(oneri) === filtre)
  ), [filtre, oneriler]);
  const firmaGruplari = useMemo(() => firmaOzetleri.map((firma) => ({
    ...firma,
    oneriler: filtreliOneriler.filter((oneri) => oneri.firma_id === firma.firma_id),
  })).filter((firma) => firma.oneriler.length > 0 || filtre === "tumu"), [filtre, filtreliOneriler, firmaOzetleri]);

  if (authYukleniyor || !kullanici || loading) return <EclubKisiYukleniyor />;

  const bekleyen = oneriler.filter((oneri) => videoDurumu(oneri) === "bekleyen").length;
  const tamamlanan = oneriler.filter((oneri) => videoDurumu(oneri) === "tamamlanan").length;

  return (
    <EclubKisiSayfa>
      {seciliOneri ? (
        <EclubVideoOynatici
          oneri={{
            oneri_id: seciliOneri.oneri_id,
            yayin_id: seciliOneri.yayin_id,
            urun_adi: seciliOneri.urun_adi,
            teknik_adi: seciliOneri.teknik_adi,
            video_url: seciliOneri.video_url,
          }}
          onKapat={() => { setSeciliOneri(null); void veriCek(); }}
          onTamamlandi={veriCek}
          hata={hata}
          basari={basari}
          uyari={uyari}
        />
      ) : (
        <>
          <EclubKisiBaslik
            ikon={Sparkles}
            baslik={`Merhaba${kisi ? `, ${kisi.ad}` : ""}`}
            aciklama={`${kisi ? KISI_ROL_ETIKETLERI[kisi.rol] ?? kisi.rol : ""} · Firmalarınızın sizin için seçtiği videoları izleyin, soruları yanıtlayın ve puan kazanın.`}
            aksiyon={(
              <Link href="/eclub/store" className="inline-flex items-center gap-2 rounded-xl border border-[#cfe3f4] bg-white px-4 py-2.5 text-xs font-extrabold text-[#237ac8] shadow-sm hover:bg-[#f4f9fd]">
                <ShoppingBag size={15} /> Mağazaya Git
              </Link>
            )}
          />

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <EclubKisiStat ikon={Clock3} etiket="Bekleyen Video" deger={bekleyen} detay="Süresi devam eden" renk="#d78022" zemin="#fff6e8" />
            <EclubKisiStat ikon={CheckCircle2} etiket="Tamamlanan" deger={tamamlanan} detay="İzlediğiniz videolar" renk="#16865f" zemin="#ebf8f2" />
            <EclubKisiStat ikon={Trophy} etiket="Net Puan" deger={Math.max(0, ozet.toplam_kazanilan_puan - ozet.ileri_sarma_kaybi).toLocaleString("tr-TR")} detay={`${ozet.dogru_cevap} doğru · ${ozet.ileri_sarma_kaybi} ileri sarma kaybı`} renk="#7358c7" zemin="#f2efff" />
            <EclubKisiStat ikon={Coins} etiket="Kullanılabilir Puan" deger={ozet.harcanabilir_puan.toLocaleString("tr-TR")} detay="E‑Club Store bakiyesi" />
          </section>

          <section className="rounded-2xl border border-[#dfe7f1] bg-white p-2 shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
            <div className="flex gap-1 overflow-x-auto">
              {FILTRELER.map((secenek) => (
                <button key={secenek.key} type="button" onClick={() => setFiltre(secenek.key)} className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-[11px] font-extrabold transition ${filtre === secenek.key ? "bg-[#237ac8] text-white shadow-sm" : "text-[#71859d] hover:bg-[#f3f7fa]"}`}>
                  {secenek.etiket}
                </button>
              ))}
            </div>
          </section>

          {firmaGruplari.length === 0 ? (
            <EclubKisiBosDurum ikon={Video} baslik="Bu bölümde video bulunmuyor" aciklama="Yeni bir video gönderildiğinde veya filtreyi değiştirdiğinizde burada görüntülenecek." />
          ) : (
            <div className="grid gap-4">
              {firmaGruplari.map((firma, index) => (
                <details key={firma.firma_id} className="group overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_7px_22px_rgba(31,55,90,0.04)]" open={index === 0 ? true : undefined}>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-4 marker:hidden md:px-5">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf6fd] text-[#237ac8]"><Building2 size={18} /></span>
                      <span className="min-w-0"><strong className="block truncate text-sm text-[#203653]">{firma.firma_adi}</strong><small className="mt-0.5 block text-[10px] font-semibold text-[#8190a3]">{firma.oneriler.length} video</small></span>
                    </span>
                    <span className="grid grid-cols-2 gap-2">
                      <span className="rounded-xl bg-[#f5f8fb] px-3 py-1.5 text-right"><small className="block text-[9px] font-bold text-[#8190a3]">Net</small><strong className="text-xs text-[#7358c7]">{Math.max(0, firma.kazanilan_puan - firma.kaybedilen_puan).toLocaleString("tr-TR")} p</strong></span>
                      <span className="rounded-xl bg-[#eef9f4] px-3 py-1.5 text-right"><small className="block text-[9px] font-bold text-[#6b907f]">Kullanılabilir</small><strong className="text-xs text-[#16865f]">{firma.harcanabilir_puan.toLocaleString("tr-TR")} p</strong></span>
                    </span>
                  </summary>
                  <div className="grid gap-3 border-t border-[#e7edf4] bg-[#f7f9fc] p-3 md:p-4">
                    {firma.oneriler.length > 0
                      ? firma.oneriler.map((oneri) => <VideoKart key={oneri.oneri_id} oneri={oneri} onIzle={() => setSeciliOneri(oneri)} />)
                      : <div className="py-6 text-center text-xs font-semibold text-[#8190a3]">Bu firmadan gösterilecek video bulunmuyor.</div>}
                  </div>
                </details>
              ))}
            </div>
          )}
        </>
      )}
      <HataMesajiContainer mesajlar={mesajlar} />
    </EclubKisiSayfa>
  );
}
