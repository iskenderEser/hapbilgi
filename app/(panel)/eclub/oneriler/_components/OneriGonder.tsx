"use client";

import { Suspense, useMemo, useState } from "react";
import KlasorGrid from "@/app/(panel)/yayindaki-videolar/_components/KlasorGrid";
import VideoOynatici from "@/components/izle/VideoOynatici";
import { ListeArama, useListe } from "@/components/liste";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";
import type { OneriYayin, OneriKisi, OneriGonderSonuc, OneriLimitler } from "../_types";
import { ATLANMA_SEBEP_ETIKETLERI, ROL_ETIKETLERI } from "../_types";

interface Props {
  yayinlar: OneriYayin[];
  kisiler: OneriKisi[];
  limitler: OneriLimitler | null;
  gonderLoading: boolean;
  onGonder: (yayin_id: string, kisi_idler: string[]) => Promise<OneriGonderSonuc | null>;
}

export function OneriGonder({ yayinlar, kisiler, limitler, gonderLoading, onGonder }: Props) {
  const [oneriModu, setOneriModu] = useState(false);
  const [seciliYayinId, setSeciliYayinId] = useState<string | null>(null);
  const [aliciId, setAliciId] = useState("");
  const [aktifVideo, setAktifVideo] = useState<OneriYayin | null>(null);
  const [sonRapor, setSonRapor] = useState<OneriGonderSonuc | null>(null);

  const liste = useListe({
    veri: yayinlar,
    adim: Infinity,
    aramaAlanlari: [
      { anahtar: "ad", etiket: "Ürün / Eğitim", deger: (video: OneriYayin) => video.urun_adi },
      { anahtar: "teknik", etiket: "Teknik", deger: (video: OneriYayin) => video.teknik_adi },
    ],
  });

  const seciliYayin = yayinlar.find((yayin) => yayin.yayin_id === seciliYayinId) ?? null;
  const hedefRolEtiketi = (video: OneriYayin) =>
    video.hedef_roller.map((hedefRol) => ROL_ETIKETLERI[hedefRol]).join(" ve ");
  const uygunKisiler = useMemo(() => {
    if (!seciliYayin) return [];
    return kisiler
      .filter((kisi) => kisi.aktif_mi && !!kisi.auth_user_id && seciliYayin.hedef_roller.includes(kisi.rol))
      .sort((a, b) => {
        const eczaneSirasi = (a.eczane_adi ?? "").localeCompare(b.eczane_adi ?? "", "tr");
        return eczaneSirasi || `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, "tr");
      });
  }, [kisiler, seciliYayin]);

  const eczaneGruplari = useMemo(() => {
    const gruplar = new Map<string, OneriKisi[]>();
    for (const kisi of uygunKisiler) {
      const eczane = kisi.eczane_adi || "Eczane bilgisi bulunmuyor";
      gruplar.set(eczane, [...(gruplar.get(eczane) ?? []), kisi]);
    }
    return [...gruplar.entries()];
  }, [uygunKisiler]);

  const atlananGruplu = useMemo(() => {
    if (!sonRapor) return [];
    const gruplar = new Map<string, number>();
    for (const kayit of sonRapor.atlanan) {
      gruplar.set(kayit.sebep, (gruplar.get(kayit.sebep) ?? 0) + 1);
    }
    return [...gruplar.entries()];
  }, [sonRapor]);

  const aylikHakVar = !limitler || limitler.aylik.kalan > 0;
  const gonderilebilir = !!seciliYayin && !!aliciId && aylikHakVar && !gonderLoading;

  const oneriModunuKapat = () => {
    setOneriModu(false);
    setSeciliYayinId(null);
    setAliciId("");
    setSonRapor(null);
  };

  const yayinSec = (video: OneriYayin) => {
    setSeciliYayinId((mevcut) => mevcut === video.yayin_id ? null : video.yayin_id);
    setAliciId("");
    setSonRapor(null);
  };

  const gonder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!gonderilebilir || !seciliYayin) return;
    const rapor = await onGonder(seciliYayin.yayin_id, [aliciId]);
    if (!rapor) return;
    setSonRapor(rapor);
    if (rapor.gonderilen_sayisi > 0) {
      setSeciliYayinId(null);
      setAliciId("");
    }
  };

  if (aktifVideo) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#dfe7f1] bg-white px-4 py-3 shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#4f7fb7]">E‑Club video kütüphanesi</p>
            <p className="truncate text-sm font-extrabold text-[#243957]">{aktifVideo.urun_adi} · {aktifVideo.teknik_adi}</p>
          </div>
          <button type="button" onClick={() => setAktifVideo(null)} className="shrink-0 rounded-xl border border-[#d9e4f0] bg-white px-3 py-2 text-xs font-extrabold text-[#617894] hover:bg-[#f5f8fc]">
            Videolara Dön
          </button>
        </div>
        <VideoOynatici
          key={aktifVideo.yayin_id}
          video={aktifVideo}
          tuketici={false}
          onizlemeYuzeyi
          onKapat={() => setAktifVideo(null)}
          onVeriYenile={() => {}}
          hata={() => {}}
          basari={() => {}}
          uyari={() => {}}
        />
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="eclub-video-katalogu-baslik">
      <div className="flex flex-col gap-3 rounded-2xl border border-[#dfe7f1] bg-white px-4 py-3.5 shadow-[0_6px_18px_rgba(31,55,90,0.035)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="eclub-video-katalogu-baslik" className="text-base font-extrabold text-[#203653]">Video Kütüphanesi</h2>
          <p className="mt-0.5 text-xs text-[#7b8da5]">
            {oneriModu ? "Önereceğiniz videoyu seçin." : "Videoları inceleyin veya eczacı ve teknisyenlerinize önerin."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="w-fit rounded-full bg-[#eef5fd] px-2.5 py-1 text-[10px] font-extrabold text-[#4479b7]">{liste.toplam} video</span>
          <ListeArama arama={liste.arama} />
          <button
            type="button"
            onClick={() => oneriModu ? oneriModunuKapat() : setOneriModu(true)}
            className={`w-fit rounded-xl px-3 py-2 text-[11px] font-extrabold transition-colors ${oneriModu ? "border border-[#d9e4f0] bg-white text-[#617894] hover:bg-[#f5f8fc]" : "bg-[#2f7fc7] text-white hover:bg-[#256daf]"}`}
          >
            {oneriModu ? "Öneri Seçimini Kapat" : "Video Önermek İstiyorum"}
          </button>
        </div>
      </div>

      {oneriModu && (
        <section aria-labelledby="eclub-oneri-paneli-baslik" className="rounded-2xl border border-[#a9caeb] bg-white shadow-[0_12px_30px_rgba(31,83,137,0.09)]">
          <div className="flex flex-col gap-2 border-b border-[#e4edf6] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#2f7fc7]">E‑Club öneri işlemi</p>
              <h3 id="eclub-oneri-paneli-baslik" className="text-base font-extrabold text-[#203653]">Seçilen videoyu öner</h3>
            </div>
            {limitler && (
              <span className="w-fit rounded-full bg-[#eef5fd] px-2.5 py-1 text-[10px] font-extrabold text-[#4479b7]">
                Aylık öneri {limitler.aylik.kullanilan}/{limitler.aylik.kota}
              </span>
            )}
          </div>

          <form onSubmit={gonder} className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#435a76]">Seçilen video</span>
                <span className="text-[10px] font-bold text-[#7c8fa7]">{seciliYayin ? "1/1" : "0/1"}</span>
              </div>
              {!seciliYayin ? (
                <div className="rounded-xl border border-dashed border-[#cbd9e8] bg-[#f8fbff] px-4 py-6 text-center text-xs font-semibold text-[#71859d]">
                  Katalogdan bir video seçin.
                </div>
              ) : (
                <article className="flex min-w-0 items-center gap-3 rounded-xl border border-[#dfe7f1] bg-[#f8fbff] p-2.5">
                  <button type="button" onClick={() => setAktifVideo(seciliYayin)} className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-[#d9e8f7]">
                    {(seciliYayin.thumbnail_url ?? thumbnailUrlUret(seciliYayin.video_url)) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={seciliYayin.thumbnail_url ?? thumbnailUrlUret(seciliYayin.video_url) ?? ""} alt="" className="h-full w-full object-cover" />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-[#10233a]/25">
                      <svg aria-hidden="true" width="8" height="10" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z" /></svg>
                    </span>
                  </button>
                  <button type="button" onClick={() => setAktifVideo(seciliYayin)} className="min-w-0 flex-1 text-left">
                    <strong className="block truncate text-sm text-[#2e4663]">{seciliYayin.urun_adi}</strong>
                    <small className="mt-0.5 block truncate text-[11px] text-[#7a8da5]">{seciliYayin.teknik_adi || "Teknik belirtilmedi"}</small>
                    <span className="mt-1 inline-block rounded-md bg-[#eef5fd] px-2 py-0.5 text-[10px] font-bold text-[#4d79aa]">{hedefRolEtiketi(seciliYayin)}</span>
                  </button>
                  <button type="button" onClick={() => yayinSec(seciliYayin)} aria-label="Video seçimini kaldır" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-[#8a9bb0] hover:bg-white hover:text-[#bc2d0d]">×</button>
                </article>
              )}
            </div>

            <div className="grid gap-3 rounded-xl bg-[#f7f9fc] p-3">
              <label>
                <span className="mb-1 block text-[11px] font-extrabold text-[#566d88]">
                  {seciliYayin ? `Önerilecek ${hedefRolEtiketi(seciliYayin)}` : "Önerilecek kişi"}
                </span>
                <select value={aliciId} onChange={(event) => setAliciId(event.target.value)} disabled={!seciliYayin || uygunKisiler.length === 0} required className="w-full rounded-lg border border-[#d5e0eb] bg-white px-3 py-2 text-xs font-semibold text-[#2d4562] outline-none disabled:bg-[#edf2f7] focus:border-[#56aeff]">
                  <option value="">{!seciliYayin ? "Önce video seçin" : uygunKisiler.length === 0 ? "Uygun alıcı bulunmuyor" : "Eczane ve kişi seçin"}</option>
                  {eczaneGruplari.map(([eczane, grup]) => (
                    <optgroup key={eczane} label={eczane}>
                      {grup.map((kisi) => <option key={kisi.kisi_id} value={kisi.kisi_id}>{kisi.ad} {kisi.soyad} · {ROL_ETIKETLERI[kisi.rol]}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>

              <p className="m-0 text-[10px] font-semibold leading-4 text-[#71859d]">
                Gönderim, RedBook’taki E‑Club kredi, tekrar ve alıcı koruma kurallarıyla denetlenir.
              </p>
              {!aylikHakVar && <p className="m-0 text-[10px] font-bold text-[#bc2d0d]">Aylık öneri hakkınız doldu.</p>}
              <button type="submit" disabled={!gonderilebilir} className="w-full rounded-xl bg-[#2f7fc7] px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition-colors hover:bg-[#256daf] disabled:cursor-not-allowed disabled:bg-[#a8b8ca]">
                {gonderLoading ? "Gönderiliyor..." : "Videoyu Öner"}
              </button>
            </div>
          </form>

          {sonRapor && (
            <div className="mx-4 mb-4 rounded-xl border border-[#dfe7f1] bg-[#f8fbff] p-3">
              <p className="m-0 text-xs font-extrabold text-[#2e4663]">{sonRapor.gonderilen_sayisi} öneri gönderildi.</p>
              {atlananGruplu.map(([sebep, adet]) => (
                <p key={sebep} className="mt-1 text-[11px] text-[#6f829a]">{adet} gönderim: {ATLANMA_SEBEP_ETIKETLERI[sebep] ?? sebep}</p>
              ))}
            </div>
          )}
        </section>
      )}

      {liste.toplam === 0 ? (
        <div className="rounded-2xl border border-[#dfe7f1] bg-white py-16 text-center text-sm text-[#6b7f9b] shadow-[0_6px_18px_rgba(31,55,90,0.03)]">
          {yayinlar.length === 0 ? "Önerilebilecek E‑Club videosu yok." : "Aramanıza uyan video bulunamadı."}
        </div>
      ) : (
        <Suspense fallback={null}>
          <KlasorGrid
            videolar={liste.gorunen}
            onVideoSec={(video) => setAktifVideo(video as OneriYayin)}
            oneriModu={oneriModu}
            secilenYayinlar={seciliYayinId ? [seciliYayinId] : []}
            onOneriSec={(video) => yayinSec(video as OneriYayin)}
          />
        </Suspense>
      )}
    </section>
  );
}
