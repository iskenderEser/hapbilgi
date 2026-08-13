"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { YayindakiVideo } from "@/lib/video/yayindakiVideolar";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";
import { trGunEkle, trGunu } from "@/lib/zaman/kontrol";

interface Alici {
  kullanici_id: string;
  ad: string;
  soyad: string;
  rol: string;
  haftalik_mevcut: number;
  haftalik_kalan: number;
}

interface Limitler {
  haftalik_ust_sinir: number;
  aylik: {
    mevcut: number;
    kota: number;
    kalan: number;
    utt_sayisi: number;
  };
}

interface Props {
  videolar: YayindakiVideo[];
  onVideoSec: (video: YayindakiVideo) => void;
  onVideoKaldir: (yayinId: string) => void;
  onVazgec: () => void;
  onBasarili: () => void;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export default function BmOneriPaneli({ videolar, onVideoSec, onVideoKaldir, onVazgec, onBasarili, hata, basari }: Props) {
  const [alicilar, setAlicilar] = useState<Alici[]>([]);
  const [limitler, setLimitler] = useState<Limitler | null>(null);
  const [aliciId, setAliciId] = useState("");
  const [baslangic, setBaslangic] = useState("");
  const [bitis, setBitis] = useState("");
  const [yukleniyor, setYukleniyor] = useState(true);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const hataRef = useRef(hata);

  const yarin = trGunEkle(trGunu(), 1);
  const bitisAltSiniri = baslangic ? trGunEkle(baslangic, 1) : "";
  const seciliAlici = useMemo(() => alicilar.find((alici) => alici.kullanici_id === aliciId) ?? null, [alicilar, aliciId]);
  const haftalikUygun = !seciliAlici || videolar.length <= seciliAlici.haftalik_kalan;
  const aylikUygun = !limitler || videolar.length <= limitler.aylik.kalan;
  const gonderilebilir = videolar.length > 0 && Boolean(aliciId && baslangic && bitis) && haftalikUygun && aylikUygun;

  useEffect(() => { hataRef.current = hata; }, [hata]);

  useEffect(() => {
    let aktif = true;
    const alicilariCek = async () => {
      setYukleniyor(true);
      try {
        const yanit = await fetch("/oneriler/api/kullanicilar");
        const veri = await yanit.json();
        if (!yanit.ok) {
          hataRef.current(veri.hata ?? "Öneri alıcıları alınamadı.", veri.adim, veri.detay);
          return;
        }
        if (aktif) {
          setAlicilar(veri.kullanicilar ?? []);
          setLimitler(veri.limitler ?? null);
        }
      } catch {
        hataRef.current("Öneri alıcıları alınamadı.");
      } finally {
        if (aktif) setYukleniyor(false);
      }
    };
    alicilariCek();
    return () => { aktif = false; };
  }, []);

  const baslangicDegistir = (deger: string) => {
    setBaslangic(deger);
    if (bitis && deger >= bitis) setBitis("");
  };

  const gonder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!gonderilebilir) return;
    setGonderiliyor(true);
    try {
      const yanit = await fetch("/oneriler/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oneriler: videolar.map((video) => ({
            yayin_id: video.yayin_id,
            kullanici_id: aliciId,
            oneri_baslangic: baslangic,
            oneri_bitis: bitis,
          })),
        }),
      });
      const veri = await yanit.json();
      if (!yanit.ok) {
        hata(veri.hata ?? "Öneri gönderilemedi.", veri.adim, veri.detay);
        return;
      }
      basari(`${veri.oneriler?.length ?? videolar.length} öneri başarıyla gönderildi.`);
      onBasarili();
    } catch {
      hata("Öneri gönderilemedi.");
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <section aria-labelledby="bm-oneri-paneli-baslik" className="rounded-2xl border border-[#a9caeb] bg-white shadow-[0_12px_30px_rgba(31,83,137,0.09)]">
      <div className="flex flex-col gap-2 border-b border-[#e4edf6] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#2f7fc7]">BM öneri işlemi</p>
          <h2 id="bm-oneri-paneli-baslik" className="text-base font-extrabold text-[#203653]">Seçilen videoları öner</h2>
        </div>
        <div className="flex items-center gap-2">
          {limitler && (
            <span className="rounded-full bg-[#eef5fd] px-2.5 py-1 text-[10px] font-extrabold text-[#4479b7]">
              Aylık öneri {limitler.aylik.mevcut}/{limitler.aylik.kota}
            </span>
          )}
          <button type="button" onClick={onVazgec} className="rounded-lg border border-[#d9e4f0] px-2.5 py-1.5 text-[11px] font-extrabold text-[#617894] hover:bg-[#f5f8fc]">
            Vazgeç
          </button>
        </div>
      </div>

      <form onSubmit={gonder} className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#435a76]">Seçilen videolar</span>
            <span className="text-[10px] font-bold text-[#7c8fa7]">{videolar.length}/3</span>
          </div>
          {videolar.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#cbd9e8] bg-[#f8fbff] px-4 py-6 text-center text-xs font-semibold text-[#71859d]">
              Katalogdan en fazla 3 video seçin.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {videolar.map((video) => {
                const kapak = video.thumbnail_url ?? thumbnailUrlUret(video.video_url);
                return (
                  <article key={video.yayin_id} className="flex min-w-0 items-center gap-2 rounded-xl border border-[#dfe7f1] bg-[#f8fbff] p-2">
                    <button type="button" onClick={() => onVideoSec(video)} aria-label={`${video.urun_adi} yayınını görüntüle`} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56aeff]">
                      <span className="relative h-10 w-16 shrink-0 overflow-hidden rounded-lg bg-[#d9e8f7]">
                        {kapak && <img src={kapak} alt="" className="h-full w-full object-cover" />}
                        <span className="absolute inset-0 flex items-center justify-center bg-[#10233a]/20"><svg aria-hidden="true" width="7" height="9" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z" /></svg></span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-[11px] text-[#2e4663]">{video.urun_adi}</strong>
                        <small className="block truncate text-[10px] text-[#7a8da5]">{video.teknik_adi || "Teknik belirtilmedi"}</small>
                      </span>
                    </button>
                    <button type="button" onClick={() => onVideoKaldir(video.yayin_id)} aria-label={`${video.urun_adi} seçimini kaldır`} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold text-[#8a9bb0] hover:bg-white hover:text-[#bc2d0d]">×</button>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid gap-3 rounded-xl bg-[#f7f9fc] p-3 sm:grid-cols-2 xl:grid-cols-1">
          <label className="sm:col-span-2 xl:col-span-1">
            <span className="mb-1 block text-[11px] font-extrabold text-[#566d88]">Önerilecek UTT/KD_UTT</span>
            <select value={aliciId} onChange={(event) => setAliciId(event.target.value)} disabled={yukleniyor} required className="w-full rounded-lg border border-[#d5e0eb] bg-white px-3 py-2 text-xs font-semibold text-[#2d4562] outline-none focus:border-[#56aeff]">
              <option value="">{yukleniyor ? "Yükleniyor..." : "Kişi seçin"}</option>
              {alicilar.map((alici) => (
                <option key={alici.kullanici_id} value={alici.kullanici_id} disabled={alici.haftalik_kalan === 0}>
                  {alici.ad} {alici.soyad} · haftalık kalan {alici.haftalik_kalan}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-[11px] font-extrabold text-[#566d88]">Öneri başlangıç günü</span>
            <input type="date" value={baslangic} onChange={(event) => baslangicDegistir(event.target.value)} min={yarin} required className="w-full rounded-lg border border-[#d5e0eb] bg-white px-3 py-2 text-xs font-semibold text-[#2d4562] outline-none focus:border-[#56aeff]" />
          </label>
          <label>
            <span className="mb-1 block text-[11px] font-extrabold text-[#566d88]">Öneri bitiş günü</span>
            <input type="date" value={bitis} onChange={(event) => setBitis(event.target.value)} min={bitisAltSiniri} disabled={!baslangic} required className="w-full rounded-lg border border-[#d5e0eb] bg-white px-3 py-2 text-xs font-semibold text-[#2d4562] outline-none disabled:bg-[#edf2f7] focus:border-[#56aeff]" />
          </label>

          <div className="sm:col-span-2 xl:col-span-1">
            {seciliAlici && (
              <p className={`mb-2 text-[10px] font-bold ${haftalikUygun ? "text-[#65809e]" : "text-[#bc2d0d]"}`}>
                Bu kişi için haftalık kullanım {seciliAlici.haftalik_mevcut}/{limitler?.haftalik_ust_sinir ?? 3}; seçimin ardından {Math.max(0, seciliAlici.haftalik_kalan - videolar.length)} hak kalır.
              </p>
            )}
            {!aylikUygun && <p className="mb-2 text-[10px] font-bold text-[#bc2d0d]">Seçilen video sayısı aylık kalan kotayı aşıyor.</p>}
            <button type="submit" disabled={!gonderilebilir || gonderiliyor || yukleniyor} className="w-full rounded-xl bg-[#2f7fc7] px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition-colors hover:bg-[#256daF] disabled:cursor-not-allowed disabled:bg-[#a8b8ca]">
              {gonderiliyor ? "Gönderiliyor..." : `${videolar.length || 0} videoyu öner`}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
