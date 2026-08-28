"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minus, Plus } from "lucide-react";

type PdfViewport = { width: number; height: number };
type PdfRenderGorevi = { promise: Promise<void>; cancel?: () => void };
type PdfSayfasi = {
  getViewport: (girdi: { scale: number }) => PdfViewport;
  render: (girdi: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
  }) => PdfRenderGorevi;
};
type PdfBelgesi = {
  numPages: number;
  getPage: (sayfa: number) => Promise<PdfSayfasi>;
};
type PdfYuklemeGorevi = {
  promise: Promise<PdfBelgesi>;
  destroy: () => Promise<void>;
};

interface Props {
  aracId: string;
  yayinId: string;
  bagId?: string | null;
  baslat: () => Promise<{
    izlemeId: string;
    ilerleme?: Record<string, unknown> | null;
  }>;
  bitir: (izlemeId: string) => Promise<void>;
  onTamamlandi?: () => void | Promise<void>;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
}

function PdfTuval({
  belge,
  sayfa,
  olcek,
  kucuk = false,
}: {
  belge: PdfBelgesi;
  sayfa: number;
  olcek: number;
  kucuk?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let iptal = false;
    let gorev: { promise: Promise<void>; cancel?: () => void } | null = null;
    void belge.getPage(sayfa).then((pdfSayfasi) => {
      if (iptal || !ref.current) return;
      const viewport = pdfSayfasi.getViewport({ scale: kucuk ? 0.18 : olcek });
      const canvas = ref.current;
      const context = canvas.getContext("2d");
      if (!context) return;
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      gorev = pdfSayfasi.render({ canvas, canvasContext: context, viewport });
      return gorev.promise;
    }).catch(() => undefined);
    return () => {
      iptal = true;
      gorev?.cancel?.();
    };
  }, [belge, sayfa, olcek, kucuk]);
  return (
    <canvas
      ref={ref}
      className={kucuk
        ? "h-20 max-w-full bg-white object-contain"
        : "h-auto max-w-full bg-white shadow-md"}
    />
  );
}

export default function FlipPdfOynatici({
  aracId,
  yayinId,
  bagId,
  baslat,
  bitir,
  onTamamlandi,
  hata,
}: Props) {
  const alanRef = useRef<HTMLDivElement>(null);
  const [belge, setBelge] = useState<PdfBelgesi | null>(null);
  const [sayfa, setSayfa] = useState(1);
  const [olcek, setOlcek] = useState(1);
  const [cift, setCift] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [izlemeId, setIzlemeId] = useState<string | null>(null);
  const [sayfaSureleri, setSayfaSureleri] = useState<Record<string, number>>({});
  const [islem, setIslem] = useState(false);

  useEffect(() => {
    const sorgu = window.matchMedia("(min-width: 768px)");
    const degistir = () => setCift(sorgu.matches);
    degistir(); sorgu.addEventListener("change", degistir);
    return () => sorgu.removeEventListener("change", degistir);
  }, []);

  useEffect(() => {
    let acik = true;
    let yuklemeGorevi: PdfYuklemeGorevi | null = null;
    setYukleniyor(true);
    void fetch(`/api/ogrenme-araclari/${aracId}/erisim${bagId ? `?bag_id=${encodeURIComponent(bagId)}` : ""}`, { cache: "no-store" })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.hata ?? "Flip PDF erişimi alınamadı."); return d.erisim_url as string; })
      .then(async (url) => {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        yuklemeGorevi = pdfjs.getDocument({ url }) as unknown as PdfYuklemeGorevi;
        const yuklenen = await yuklemeGorevi.promise;
        if (acik) {
          setBelge(yuklenen);
          const oturum = await baslat();
          const ilerleme = oturum.ilerleme as { sonSayfa?: number; aktifSayfaSaniyeleri?: Record<string, number> } | null | undefined;
          setIzlemeId(oturum.izlemeId);
          setSayfa(Math.min(yuklenen.numPages, Math.max(1, Number(ilerleme?.sonSayfa ?? 1))));
          setSayfaSureleri(ilerleme?.aktifSayfaSaniyeleri ?? {});
        }
      })
      .catch((e) => hata(e instanceof Error ? e.message : "Flip PDF açılamadı.", "Flip PDF erişimi"))
      .finally(() => { if (acik) setYukleniyor(false); });
    return () => {
      acik = false;
      if (yuklemeGorevi) void yuklemeGorevi.destroy();
    };
    // callbacks are intentionally excluded; consuming screens pass inline handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aracId, bagId]);

  useEffect(() => {
    if (!belge || !izlemeId) return;
    const sayac = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setSayfaSureleri((onceki) => {
        const yeni = { ...onceki, [String(sayfa)]: (onceki[String(sayfa)] ?? 0) + 1 };
        if (cift && sayfa < belge.numPages) yeni[String(sayfa + 1)] = (onceki[String(sayfa + 1)] ?? 0) + 1;
        return yeni;
      });
    }, 1000);
    return () => window.clearInterval(sayac);
  }, [belge, izlemeId, sayfa, cift]);

  const ilerlemeKaydet = async (tamamla = false) => {
    if (!izlemeId) return false;
    const r = await fetch("/api/ogrenme-araclari/flip-pdf-ilerleme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        izleme_id: izlemeId,
        yayin_id: yayinId,
        arac_id: aracId,
        son_sayfa: sayfa,
        sayfa_sureleri: sayfaSureleri,
        tamamla,
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.hata ?? "Flip PDF ilerlemesi kaydedilemedi.");
    return true;
  };

  const sayfayaGit = (hedef: number) => {
    void ilerlemeKaydet(false).catch(() => undefined);
    setSayfa(hedef);
  };

  const tamamla = async () => {
    if (!izlemeId || islem) return;
    setIslem(true);
    try {
      await ilerlemeKaydet(true);
      await bitir(izlemeId);
      await onTamamlandi?.();
    } catch (error) {
      hata(
        "Flip PDF tamamlanamadı.",
        "Flip PDF tamamlanması",
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      setIslem(false);
    }
  };

  if (yukleniyor) {
    return (
      <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">
        Flip PDF yükleniyor…
      </div>
    );
  }
  if (!belge) return null;
  const adim = cift ? 2 : 1;
  const sonrakiVar = sayfa + adim <= belge.numPages;
  const okunanSayisi = Array.from({ length: belge.numPages }, (_, i) => i + 1).filter((n) => (sayfaSureleri[String(n)] ?? 0) >= 2).length;

  return (
    <div ref={alanRef} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Uzaklaştır"
            onClick={() => setOlcek((value) => Math.max(0.6, +(value - 0.1).toFixed(1)))}
            className="rounded-lg p-2 hover:bg-slate-100"
          >
            <Minus size={16} />
          </button>
          <span className="w-12 text-center text-xs font-bold text-slate-600">
            %{Math.round(olcek * 100)}
          </span>
          <button
            type="button"
            aria-label="Yakınlaştır"
            onClick={() => setOlcek((value) => Math.min(2, +(value + 0.1).toFixed(1)))}
            className="rounded-lg p-2 hover:bg-slate-100"
          >
            <Plus size={16} />
          </button>
        </div>
        <span className="text-xs font-bold text-slate-600">
          {sayfa}{cift && sayfa < belge.numPages ? `–${sayfa + 1}` : ""} / {belge.numPages}
        </span>
        <button
          type="button"
          aria-label="Tam ekran"
          onClick={() => void alanRef.current?.requestFullscreen()}
          className="rounded-lg p-2 hover:bg-slate-100"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      <div className={`grid min-h-[420px] place-items-center gap-4 overflow-auto p-4 ${cift ? "grid-cols-2" : "grid-cols-1"}`}>
        <PdfTuval belge={belge} sayfa={sayfa} olcek={olcek} />
        {cift && sayfa < belge.numPages && (
          <PdfTuval belge={belge} sayfa={sayfa + 1} olcek={olcek} />
        )}
      </div>

      <div className="flex items-center justify-between border-y border-slate-200 bg-white px-3 py-2">
        <button
          type="button"
          disabled={sayfa === 1}
          onClick={() => sayfayaGit(Math.max(1, sayfa - adim))}
          className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-35"
        >
          <ChevronLeft size={16} /> Önceki
        </button>
        <span className="text-[11px] font-bold text-slate-500">
          {okunanSayisi}/{belge.numPages} sayfa okundu
        </span>
        <button
          type="button"
          disabled={!sonrakiVar}
          onClick={() => sayfayaGit(Math.min(belge.numPages, sayfa + adim))}
          className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-35"
        >
          Sonraki <ChevronRight size={16} />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto bg-slate-50 p-3">
        {Array.from({ length: belge.numPages }, (_, index) => index + 1).map((sayfaNo) => (
          <button
            type="button"
            key={sayfaNo}
            onClick={() => sayfayaGit(cift && sayfaNo % 2 === 0 ? sayfaNo - 1 : sayfaNo)}
            className={`w-16 shrink-0 rounded-md border p-1 ${
              sayfaNo === sayfa || (cift && sayfaNo === sayfa + 1)
                ? "border-[#bc2d0d] bg-red-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <PdfTuval belge={belge} sayfa={sayfaNo} olcek={1} kucuk />
            <span className="mt-1 block text-[10px] font-bold text-slate-500">{sayfaNo}</span>
          </button>
        ))}
      </div>

      <div className="flex justify-end border-t border-slate-200 bg-white p-3">
        <button
          type="button"
          disabled={islem || okunanSayisi < belge.numPages}
          onClick={() => void tamamla()}
          className="rounded-lg border-0 bg-[#56aeff] px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          Okumayı tamamla
        </button>
      </div>
    </div>
  );
}
