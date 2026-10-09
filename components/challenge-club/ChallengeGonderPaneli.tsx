"use client";

import { SadeKisiCokluSecimi } from "@/components/kontrol/KisiKontroller";

import { DagitimIcerikOzeti } from "@/components/ogrenme-araci/DagitimIcerikOzeti";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import { useState } from "react";

export interface GonderVideo {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  video_puani: number | null;
  arac_id?: string | null;
  arac_turu?: string | null;
}

interface UygunAlici {
  kullanici_id: string;
  ad: string;
  soyad: string;
  gonderilebilir: boolean;
  sebep?: string;
}

export interface GonderSonuc {
  gonderilen_sayisi: number;
  atlanan: { alan_id: string; sebep: string }[];
}

type HataFn = (mesaj: string, adim?: string, detay?: string) => void;
type GonderFn = (yayin_id: string, alan_idler: string[]) => Promise<GonderSonuc | null>;

interface PanelProps {
  videolar: GonderVideo[];
  kalanKota: number;
  hata: HataFn;
  onGonder: GonderFn;
}

export default function ChallengeGonderPaneli({ videolar, kalanKota, hata, onGonder }: PanelProps) {
  if (videolar.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d8e2ec] bg-white px-5 py-12 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f1f6fa] text-[#8ba0b5]"><BookOpen size={20} /></span>
        <h2 className="mt-3 text-sm font-extrabold text-[#40556d]">Henüz tamamladığınız yayın yok.</h2>
        <p className="mx-auto mt-1 max-w-md text-xs font-semibold leading-5 text-[#8a99aa]">Bir Challenge Club yayınını tamamladığınızda burada listelenir.</p>
      </div>
    );
  }
  return (
    <section className="overflow-visible rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
      <div className="border-b border-[#e5ecf4] px-4 py-3.5">
        <h2 className="text-base font-extrabold text-[#203653]">Gönderilecek Yayınlar</h2>
        <p className="mt-0.5 text-[11px] font-semibold text-[#7b8da5]">{videolar.length} yayın · {kalanKota} gönderim hakkı kaldı</p>
      </div>
      {videolar.map((video) => (
        <ChallengeGonderSatiri key={video.yayin_id} video={video} hata={hata} onGonder={onGonder} />
      ))}
    </section>
  );
}

function ChallengeGonderSatiri({ video, hata, onGonder }: { video: GonderVideo; hata: HataFn; onGonder: GonderFn }) {

  const [aliciler, setAliciler] = useState<UygunAlici[] | null>(null);
  const [aliciLoading, setAliciLoading] = useState(false);
  const [secililer, setSecililer] = useState<string[]>([]);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [sonuc, setSonuc] = useState<GonderSonuc | null>(null);

  const alicilariYukle = async () => {
    if (aliciler) return;
    setAliciLoading(true);
    try {
      const res = await fetch(`/challenge-club/api/uygun-aliciler?yayin_id=${video.yayin_id}`);
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Alıcılar yüklenemedi.", d.adim, d.detay); setAliciLoading(false); return; }
      setAliciler(d.aliciler ?? []);
    } catch (err) { hata("Alıcılar yüklenirken hata oluştu.", "fetch", String(err)); }
    setAliciLoading(false);
  };

  const acKapat = (acik: boolean) => { if (acik) void alicilariYukle(); };

  const gonder = async () => {
    if (secililer.length === 0) return;
    setGonderiliyor(true);
    const rapor = await onGonder(video.yayin_id, secililer);
    setGonderiliyor(false);
    if (!rapor) return;
    setSonuc(rapor);
    if (rapor.gonderilen_sayisi > 0) { setSecililer([]); setAliciler(null); } // liste yeniden yüklensin
  };

  return (
    <article className="border-b border-[#e7edf4] p-3 last:border-b-0 md:p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.4fr)_minmax(120px,0.55fr)_minmax(240px,1fr)] lg:items-center">
        {/* Video */}
        <DagitimIcerikOzeti icerik={video} />

        {/* Bilgi */}
        <div className="min-w-0">
          <span className="block text-[9px] font-bold uppercase tracking-wide text-[#8a99aa]">Yayın puanı</span>
          <strong className="mt-1 block text-[11px] text-[#405976]">{video.video_puani == null ? "—" : `${video.video_puani} puan`}</strong>
        </div>

        {/* Alıcı seçimi + Gönder */}
        <div className="relative">
          <div className="flex flex-col gap-2 sm:flex-row">
            <SadeKisiCokluSecimi
 baslik="Bölge Müdürleri"
 kisiler={(aliciler ?? []).map((a) => ({ deger: a.kullanici_id, adSoyad: a.ad + " " + a.soyad, altBilgi: !a.gonderilebilir ? a.sebep : undefined, disabled: !a.gonderilebilir }))}
 degerler={secililer} onDegistir={(ids) => { setSecililer(ids); setSonuc(null); }}
 onAcikDegistir={acKapat} yukleniyor={aliciLoading} disabled={gonderiliyor}
/>
            <Button type="button" onClick={() => void gonder()} disabled={secililer.length === 0 || gonderiliyor} className="w-full shrink-0 bg-[#237ac8] text-xs font-extrabold hover:bg-[#1d69aa] sm:w-auto">
              {gonderiliyor ? "Gönderiliyor…" : `${secililer.length || ""} ${secililer.length ? "BM'ye Gönder" : "Gönder"}`}
            </Button>
          </div>
          {sonuc && <p className="mt-1.5 text-[10px] font-semibold text-[#617894]">{sonuc.gonderilen_sayisi} gönderildi{sonuc.atlanan.length > 0 ? ` · ${sonuc.atlanan.length} atlandı` : ""}.</p>}
        </div>
      </div>
    </article>
  );
}
