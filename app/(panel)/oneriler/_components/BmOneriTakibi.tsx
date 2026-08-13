"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DahaFazlaGoster, useListe } from "@/components/liste";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";
import { PERIYOTLAR, type Periyot } from "@/lib/utils/raporUtils";
import reportStyles from "@/app/(panel)/raporlar/utt/utt-report.module.css";

export interface OneriKaydi {
  oneri_id: string;
  yayin_id: string;
  oneren_id: string;
  kullanici_id: string;
  oneri_baslangic: string;
  oneri_bitis: string;
  izlendi_mi: boolean;
  created_at: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  kullanici_adi: string;
  video_puani?: number | null;
  begeni_sayisi: number;
  favori_sayisi: number;
  begeni_mi: boolean;
  favori_mi: boolean;
}

type KayitDurumu = "planlandi" | "bekliyor" | "tamamlandi" | "suresi_gecmis";
type DurumFiltresi = "tum" | "acik" | KayitDurumu;

const DURUMLAR: Record<KayitDurumu, { etiket: string; renk: string; zemin: string }> = {
  planlandi: { etiket: "Planlandı", renk: "#9a6700", zemin: "#fff8d6" },
  bekliyor: { etiket: "Bekliyor", renk: "#476b96", zemin: "#eef5fd" },
  tamamlandi: { etiket: "Tamamlandı", renk: "#167453", zemin: "#ecfdf5" },
  suresi_gecmis: { etiket: "Süresi Geçti", renk: "#bc2d0d", zemin: "#fce8e3" },
};

const kayitDurumu = (oneri: OneriKaydi): KayitDurumu => {
  if (oneri.izlendi_mi) return "tamamlandi";
  const simdi = Date.now();
  if (new Date(oneri.oneri_bitis).getTime() < simdi) return "suresi_gecmis";
  if (new Date(oneri.oneri_baslangic).getTime() > simdi) return "planlandi";
  return "bekliyor";
};

const tarih = (deger: string) => {
  const nesne = new Date(deger);
  return Number.isNaN(nesne.getTime()) ? "—" : nesne.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
};

interface Props {
  oneriler: OneriKaydi[];
  periyot: Periyot;
  onPeriyotDegistir: (periyot: Periyot) => void;
}

export default function BmOneriTakibi({ oneriler, periyot, onPeriyotDegistir }: Props) {
  const router = useRouter();
  const [konuFiltresi, setKonuFiltresi] = useState("");
  const [uttFiltresi, setUttFiltresi] = useState("");
  const [durumFiltresi, setDurumFiltresi] = useState<DurumFiltresi>("tum");

  const sayilar = useMemo(() => {
    const tamamlanan = oneriler.filter((oneri) => kayitDurumu(oneri) === "tamamlandi").length;
    const suresiGecmis = oneriler.filter((oneri) => kayitDurumu(oneri) === "suresi_gecmis").length;
    return {
      toplam: oneriler.length,
      tamamlanan,
      bekleyen: oneriler.length - tamamlanan - suresiGecmis,
      suresiGecmis,
    };
  }, [oneriler]);

  const uttler = useMemo(
    () => Array.from(new Set(oneriler.map((oneri) => oneri.kullanici_adi).filter(Boolean))).sort((a, b) => a.localeCompare(b, "tr")),
    [oneriler],
  );

  const konuSecenekleri = useMemo(() => ({
    urunler: Array.from(new Set(oneriler.map((oneri) => oneri.urun_adi).filter(Boolean))).sort((a, b) => a.localeCompare(b, "tr")),
    teknikler: Array.from(new Set(oneriler.map((oneri) => oneri.teknik_adi).filter(Boolean))).sort((a, b) => a.localeCompare(b, "tr")),
  }), [oneriler]);

  const filtrelenmis = useMemo(() => {
    return [...oneriler]
      .filter((oneri) => {
        if (konuFiltresi.startsWith("urun:")) return oneri.urun_adi === konuFiltresi.slice(5);
        if (konuFiltresi.startsWith("teknik:")) return oneri.teknik_adi === konuFiltresi.slice(7);
        return true;
      })
      .filter((oneri) => !uttFiltresi || oneri.kullanici_adi === uttFiltresi)
      .filter((oneri) => {
        const durum = kayitDurumu(oneri);
        if (durumFiltresi === "tum") return true;
        if (durumFiltresi === "acik") return durum === "planlandi" || durum === "bekliyor";
        return durum === durumFiltresi;
      })
      .sort((a, b) => new Date(b.oneri_baslangic).getTime() - new Date(a.oneri_baslangic).getTime());
  }, [oneriler, konuFiltresi, uttFiltresi, durumFiltresi]);

  const liste = useListe({
    veri: filtrelenmis,
    adim: 12,
  });

  const kartlar: { anahtar: DurumFiltresi; etiket: string; deger: number; aciklama: string; renk: string; zemin: string }[] = [
    { anahtar: "tum", etiket: "Toplam Öneri", deger: sayilar.toplam, aciklama: "Gönderilen bütün öneriler", renk: "#2f7fc7", zemin: "#eef6ff" },
    { anahtar: "tamamlandi", etiket: "Tamamlanan", deger: sayilar.tamamlanan, aciklama: "UTT tarafından izlendi", renk: "#167453", zemin: "#ecfdf5" },
    { anahtar: "acik", etiket: "Bekleyen", deger: sayilar.bekleyen, aciklama: "Planlanan ve izlenecek", renk: "#9a6700", zemin: "#fff8d6" },
    { anahtar: "suresi_gecmis", etiket: "Süresi Geçmiş", deger: sayilar.suresiGecmis, aciklama: "Süresinde tamamlanmadı", renk: "#bc2d0d", zemin: "#fce8e3" },
  ];

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#4f7fb7]">Saha gelişim desteği</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">Öneri Takibi</h1>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-[#6b7f9b]">Bölgenizdeki UTT’lere gönderdiğiniz video önerilerini ve izlenme durumlarını takip edin.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          <div className={reportStyles.periods} aria-label="Öneri takip dönemi">
            {PERIYOTLAR.map((secenek) => (
              <button
                type="button"
                key={secenek.key}
                onClick={() => onPeriyotDegistir(secenek.key)}
                aria-pressed={periyot === secenek.key}
                className={`${reportStyles.periodButton} ${periyot === secenek.key ? reportStyles.periodActive : ""}`}
              >
                {secenek.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => router.push("/yayindaki-videolar")} className="w-fit rounded-xl bg-[#2f7fc7] px-4 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-[#256daf]">
            Yayındaki Videolardan Öner
          </button>
        </div>
      </header>

      <section aria-label="Öneri durumu özeti" className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        {kartlar.map((kart) => {
          const secili = durumFiltresi === kart.anahtar;
          return (
            <button key={kart.anahtar} type="button" onClick={() => setDurumFiltresi(kart.anahtar)} aria-pressed={secili} className={`rounded-2xl border bg-white p-3.5 text-left shadow-[0_6px_18px_rgba(31,55,90,0.035)] transition-all hover:-translate-y-0.5 ${secili ? "ring-2 ring-[#b7d7f2]" : "border-[#dfe7f1]"}`} style={{ borderLeft: `4px solid ${kart.renk}` }}>
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.1em]" style={{ color: kart.renk }}>{kart.etiket}</span>
              <strong className="mt-1 block text-2xl font-black text-[#243957]">{kart.deger}</strong>
              <small className="mt-1 hidden text-[11px] font-semibold text-[#7b8ca5] sm:block">{kart.aciklama}</small>
            </button>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
        <div className="flex flex-col gap-3 border-b border-[#e5ecf4] px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-extrabold text-[#203653]">Öneri Takip Listesi</h2>
            <p className="mt-0.5 text-[11px] font-semibold text-[#7b8da5]">{liste.toplam}{liste.toplam !== oneriler.length ? ` / ${oneriler.length}` : ""} kayıt gösteriliyor</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select value={konuFiltresi} onChange={(event) => setKonuFiltresi(event.target.value)} className="rounded-lg border border-[#d8e2ed] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#586f8a] outline-none">
              <option value="">Öneri Konusu</option>
              {konuSecenekleri.urunler.length > 0 && (
                <optgroup label="Ürün / Eğitim">
                  {konuSecenekleri.urunler.map((urun) => <option key={`urun:${urun}`} value={`urun:${urun}`}>{urun}</option>)}
                </optgroup>
              )}
              {konuSecenekleri.teknikler.length > 0 && (
                <optgroup label="Teknik">
                  {konuSecenekleri.teknikler.map((teknik) => <option key={`teknik:${teknik}`} value={`teknik:${teknik}`}>{teknik}</option>)}
                </optgroup>
              )}
            </select>
            <select value={uttFiltresi} onChange={(event) => setUttFiltresi(event.target.value)} className="rounded-lg border border-[#d8e2ed] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#586f8a] outline-none">
              <option value="">UTT Listesi</option>
              {uttler.map((utt) => <option key={utt} value={utt}>{utt}</option>)}
            </select>
            <select value={durumFiltresi} onChange={(event) => setDurumFiltresi(event.target.value as DurumFiltresi)} className="rounded-lg border border-[#d8e2ed] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#586f8a] outline-none">
              <option value="tum">Tüm durumlar</option>
              <option value="planlandi">Planlandı</option>
              <option value="bekliyor">Bekliyor</option>
              <option value="tamamlandi">Tamamlandı</option>
              <option value="suresi_gecmis">Süresi Geçti</option>
            </select>
          </div>
        </div>

        {liste.toplam === 0 ? (
          <div className="px-4 py-14 text-center text-sm font-semibold text-[#8090a4]">Filtrelerle eşleşen öneri bulunamadı.</div>
        ) : (
          <>
            <div className="grid gap-2.5 p-3 md:hidden">
              {liste.gorunen.map((oneri) => {
                const durum = DURUMLAR[kayitDurumu(oneri)];
                const kapak = oneri.thumbnail_url ?? thumbnailUrlUret(oneri.video_url);
                return (
                  <article key={oneri.oneri_id} className="rounded-xl border border-[#e0e8f1] bg-white p-3">
                    <div className="flex gap-3">
                      <span className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-[#d9e8f7]">{kapak && <img src={kapak} alt="" className="h-full w-full object-cover" />}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2"><strong className="truncate text-sm text-[#263e5b]">{oneri.urun_adi}</strong><span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold" style={{ color: durum.renk, backgroundColor: durum.zemin }}>{durum.etiket}</span></div>
                        <p className="mt-1 truncate text-[11px] font-semibold text-[#71859d]">{oneri.teknik_adi || "Teknik belirtilmedi"}</p>
                        <p className="mt-2 text-xs font-extrabold text-[#435a76]">{oneri.kullanici_adi}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-[#f7f9fc] px-2.5 py-2"><small className="block text-[9px] font-bold uppercase text-[#8a9bb0]">Başlangıç</small><strong className="text-[11px] text-[#536a84]">{tarih(oneri.oneri_baslangic)}</strong></div>
                      <div className="rounded-lg bg-[#f7f9fc] px-2.5 py-2"><small className="block text-[9px] font-bold uppercase text-[#8a9bb0]">Bitiş</small><strong className="text-[11px] text-[#536a84]">{tarih(oneri.oneri_bitis)}</strong></div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-[#f7f9fc] text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#7d8fa5]"><tr><th className="px-4 py-3">Video</th><th className="px-4 py-3">UTT/KD_UTT</th><th className="px-4 py-3">Başlangıç</th><th className="px-4 py-3">Bitiş</th><th className="px-4 py-3">Durum</th></tr></thead>
                <tbody>
                  {liste.gorunen.map((oneri) => {
                    const durum = DURUMLAR[kayitDurumu(oneri)];
                    const kapak = oneri.thumbnail_url ?? thumbnailUrlUret(oneri.video_url);
                    return (
                      <tr key={oneri.oneri_id} className="border-t border-[#edf1f6] hover:bg-[#fbfcfe]">
                        <td className="px-4 py-3"><div className="flex min-w-[220px] items-center gap-3"><span className="h-10 w-16 shrink-0 overflow-hidden rounded-lg bg-[#d9e8f7]">{kapak && <img src={kapak} alt="" className="h-full w-full object-cover" />}</span><span className="min-w-0"><strong className="block truncate text-xs text-[#2d4562]">{oneri.urun_adi}</strong><small className="mt-0.5 block truncate text-[10px] text-[#7a8da5]">{oneri.teknik_adi || "Teknik belirtilmedi"}</small></span></div></td>
                        <td className="px-4 py-3 font-extrabold text-[#405873]">{oneri.kullanici_adi}</td>
                        <td className="px-4 py-3 font-semibold text-[#718198]">{tarih(oneri.oneri_baslangic)}</td>
                        <td className="px-4 py-3 font-semibold text-[#718198]">{tarih(oneri.oneri_bitis)}</td>
                        <td className="px-4 py-3"><span className="rounded-full px-2.5 py-1 text-[10px] font-extrabold" style={{ color: durum.renk, backgroundColor: durum.zemin }}>{durum.etiket}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <DahaFazlaGoster dahaVar={liste.dahaVar} gorunenSayi={liste.gorunen.length} toplam={liste.toplam} onGoster={liste.dahaFazlaGoster} />
          </>
        )}
      </section>
    </div>
  );
}
