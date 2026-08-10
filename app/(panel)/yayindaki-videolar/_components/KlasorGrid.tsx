// app/yayindaki-videolar/_components/KlasorGrid.tsx
// Yayındaki videoları DEPARTMAN klasörlerine ayırır. İki görünüm:
//   - Klasör grid: departman adı + video sayısı (boş departman gösterilmez).
//   - Klasör seçiliyken: o departmanın videoları mevcut VideoBolumu ile (kutu kutu)
//     + "Klasörler" geri butonu.
// Video seçimi (tam sayfa oynatıcı) sayfada yönetilir → onVideoSec ile yukarı geçer.

"use client";

import { useState } from "react";
import YayindakiVideoBolumu from "./YayindakiVideoBolumu";
import type { YayindakiVideo } from "@/lib/video/yayindakiVideolar";
import type { AnaSayfaVideo } from "@/lib/video/anaSayfaVideolari";
import { DEPARTMAN_SIRA, DEPARTMAN_ETIKET, DEPARTMAN_RENK, departmanKey, type DepartmanKey } from "@/lib/video/departman";

interface Props {
  videolar: YayindakiVideo[];
  onVideoSec: (video: AnaSayfaVideo) => void;
}

export default function KlasorGrid({ videolar, onVideoSec }: Props) {
  const [secili, setSecili] = useState<DepartmanKey | null>(null);

  const gruplar = new Map<DepartmanKey, YayindakiVideo[]>();
  for (const v of videolar) {
    const key = departmanKey(v.ureten_rol);
    if (!gruplar.has(key)) gruplar.set(key, []);
    gruplar.get(key)!.push(v);
  }
  const doluDepartmanlar = DEPARTMAN_SIRA.filter((k) => (gruplar.get(k)?.length ?? 0) > 0);

  if (secili) {
    const grup = gruplar.get(secili) ?? [];
    const renk = DEPARTMAN_RENK[secili];
    const ureticiSayisi = new Set(grup.map((video) => `${video.ureten_rol}:${video.ureten_ad_soyad}`)).size;
    const izlenmeSayisi = grup.reduce((toplam, video) => toplam + video.izlenme_sayisi, 0);
    // Klasör içi dört bölüm — her biri ilk 5 (UTT ana sayfası deseni).
    const enYeni = [...grup]
      .sort((a, b) => new Date(b.yayin_tarihi).getTime() - new Date(a.yayin_tarihi).getTime())
      .slice(0, 5);
    const enCokIzlenen = [...grup].filter((v) => v.izlenme_sayisi > 0).sort((a, b) => b.izlenme_sayisi - a.izlenme_sayisi).slice(0, 5);
    const enCokBegenilen = [...grup].filter((v) => v.begeni_sayisi > 0).sort((a, b) => b.begeni_sayisi - a.begeni_sayisi).slice(0, 5);
    const enCokFavorilenen = [...grup].filter((v) => v.favori_sayisi > 0).sort((a, b) => b.favori_sayisi - a.favori_sayisi).slice(0, 5);
    const bolumler: { baslik: string; aciklama: string; liste: YayindakiVideo[] }[] = [
      { baslik: "Yeni Yayınlar", aciklama: "Birimin kataloğa en son eklediği içerikler", liste: enYeni },
      { baslik: "En Çok İzlenenler", aciklama: "Tamamlanan izlemelerde öne çıkanlar", liste: enCokIzlenen },
      { baslik: "En Çok Beğenilenler", aciklama: "Kullanıcı beğenisi en yüksek yayınlar", liste: enCokBegenilen },
      { baslik: "En Çok Favorilenenler", aciklama: "Daha sonra erişmek için en çok kaydedilenler", liste: enCokFavorilenen },
    ];
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-[#dfe7f1] bg-white p-4 shadow-[0_6px_18px_rgba(31,55,90,0.035)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ color: renk, backgroundColor: `${renk}14` }}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M3 7h6l2 2h10v10H3V7Z" /><path d="M3 7V5h7l2 2" /></svg>
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: renk }}>Üretici birim</p>
              <h3 className="truncate text-base font-extrabold text-[#203653]">{DEPARTMAN_ETIKET[secili]}</h3>
              <p className="mt-0.5 text-xs text-[#7b8da5]">{grup.length} yayın · {ureticiSayisi} üretici · {izlenmeSayisi} tamamlanan izleme</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSecili(null)}
            className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-[#d9e4f0] bg-[#f8fbff] px-3 py-2 text-xs font-extrabold text-[#476b96] transition-colors hover:bg-[#eef5fd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56aeff]"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path d="m15 18-6-6 6-6" /></svg>
            Tüm birimler
          </button>
        </div>
        {bolumler.map((b) =>
          b.liste.length === 0 ? null : (
            <section key={b.baslik} className="rounded-2xl border border-[#dfe7f1] bg-white p-3.5 shadow-[0_6px_18px_rgba(31,55,90,0.035)] md:p-4">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h4 className="text-sm font-extrabold text-[#243957]">{b.baslik}</h4>
                  <p className="mt-0.5 text-[11px] text-[#7b8ca5]">{b.aciklama}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#f0f5fb] px-2.5 py-1 text-[10px] font-extrabold text-[#637b99]">{b.liste.length} yayın</span>
              </div>
              <YayindakiVideoBolumu videolar={b.liste} onVideoSec={onVideoSec} />
            </section>
          )
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
      {doluDepartmanlar.map((k) => {
        const grup = gruplar.get(k) ?? [];
        const sayi = grup.length;
        const ureticiSayisi = new Set(grup.map((video) => `${video.ureten_rol}:${video.ureten_ad_soyad}`)).size;
        const izlenmeSayisi = grup.reduce((toplam, video) => toplam + video.izlenme_sayisi, 0);
        const renk = DEPARTMAN_RENK[k];
        return (
          <button
            type="button"
            key={k}
            onClick={() => setSecili(k)}
            className="group flex min-h-36 flex-col justify-between rounded-2xl border bg-white p-4 text-left shadow-[0_6px_18px_rgba(31,55,90,0.035)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(31,55,90,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56aeff]"
            style={{ borderColor: `${renk}45` }}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ color: renk, backgroundColor: `${renk}14` }}>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M3 7h6l2 2h10v10H3V7Z" /><path d="M3 7V5h7l2 2" /></svg>
              </span>
              <span className="rounded-full px-2.5 py-1 text-[10px] font-extrabold" style={{ color: renk, backgroundColor: `${renk}10` }}>{sayi} yayın</span>
            </div>
            <div className="mt-5">
              <span className="block text-sm font-extrabold text-[#243957]">{DEPARTMAN_ETIKET[k]}</span>
              <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[#7b8ca5]">
                <span>{ureticiSayisi} üretici · {izlenmeSayisi} izleme</span>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" style={{ color: renk }}><path d="m9 18 6-6-6-6" /></svg>
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
