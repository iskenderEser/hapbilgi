// components/raporlar/YayinDetayModal.tsx
"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle2, HelpCircle, Film, Sparkles, Award, Layers, Clock, AlertCircle } from "lucide-react";
import OgrenmeAraciOnizleme from "@/components/ogrenme-araci/OgrenmeAraciOnizleme";
import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";
import { YayinTuruPill } from "@/components/ogrenme-araci/YayinTuruPill";
import { HedefRolPilleri } from "@/components/pill/HedefRolPill";
import type { HedefRol } from "@/lib/utils/roller";

interface SoruSecenegi {
  harf: string;
  metin: string;
  dogru?: boolean;
}

interface SoruDetay {
  soru_metni: string;
  secenekler: SoruSecenegi[];
  dogru_cevap?: string;
  puan?: number;
}

interface YayinDetayVerisi {
  yayin_id: string;
  talep_no: number | null;
  durum: string;
  yayin_tarihi: string;
  urun_adi: string | null;
  teknik_adi: string | null;
  egitim_turu?: string | null;
  icerik_turu?: string | null;
  hedef_roller: HedefRol[];
  video_url: string | null;
  thumbnail_url: string | null;
  video_puani: number | null;
  soru_puani: number | null;
  arac_id: string | null;
  arac_turu: OgrenmeAraciTuru;
  sorular: SoruDetay[] | null;
}

interface Props {
  yayinId: string | null;
  onKapat: () => void;
}

export default function YayinDetayModal({ yayinId, onKapat }: Props) {
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [detay, setDetay] = useState<YayinDetayVerisi | null>(null);
  const [aktifSekme, setAktifSekme] = useState<"arac" | "sorular">("arac");

  useEffect(() => {
    if (!yayinId) {
      setDetay(null);
      setHata(null);
      return;
    }

    let iptal = false;
    setYukleniyor(true);
    setHata(null);

    fetch(`/api/raporlar/yayin-detay/${encodeURIComponent(yayinId)}`)
      .then(async (res) => {
        const d = await res.json();
        if (!res.ok) throw new Error(d.hata ?? "Yayın detayları alınamadı.");
        return d.yayin as YayinDetayVerisi;
      })
      .then((veri) => {
        if (iptal) return;
        setDetay(veri);
      })
      .catch((err) => {
        if (iptal) return;
        setHata(err instanceof Error ? err.message : "Detaylar yüklenirken bir hata oluştu.");
      })
      .finally(() => {
        if (!iptal) setYukleniyor(false);
      });

    return () => {
      iptal = true;
    };
  }, [yayinId]);

  if (!yayinId) return null;

  const formatTarih = (t: string) => {
    try {
      return new Date(t).toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    } catch {
      return t;
    }
  };

  const sorularDizisi = Array.isArray(detay?.sorular) ? detay!.sorular : [];

  return (
    <div
      onClick={onKapat}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-[#dbe4ee] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Üst Başlık Barı */}
        <div className="flex items-center justify-between border-b border-[#e9eff5] bg-[#fbfcfd] px-4 py-3 sm:px-6 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef5fc] text-[#237ac8]">
              <Film className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold text-[#19335a] truncate">
                  {detay?.talep_no ? `Talep #${detay.talep_no}` : `Yayın: ${yayinId.slice(0, 8)}`}
                </span>
                {detay?.arac_turu && <YayinTuruPill tur={detay.arac_turu} />}
                {detay?.durum && (
                  <span className="rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[10px] font-bold text-[#167453] border border-[#bbf7d0]">
                    {detay.durum}
                  </span>
                )}
              </div>
              <p className="truncate text-sm font-extrabold text-[#0e1e36]">
                {detay?.urun_adi ?? "Yayın Detayı ve Soru Karnesi"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onKapat}
            aria-label="Kapat"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Gövde Alanı */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#f8fafc]">
          {yukleniyor ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#64748b]">
              <svg className="h-8 w-8 animate-spin text-[#237ac8]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="mt-3 text-xs font-bold">Yayın bilgileri ve sorular getiriliyor...</span>
            </div>
          ) : hata ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="h-10 w-10 text-red-500 mb-2" />
              <p className="text-sm font-bold text-red-600">{hata}</p>
              <button
                type="button"
                onClick={onKapat}
                className="mt-4 rounded-xl bg-white px-4 py-2 text-xs font-bold text-[#64748b] border border-[#cbd5e1] hover:bg-gray-50"
              >
                Pencereyi Kapat
              </button>
            </div>
          ) : detay ? (
            <div className="space-y-5">
              {/* Özet Kartları & Meta Bilgiler */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-[#e2e8f0] bg-white p-3 shadow-sm">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#7e8f9f] block">Teknik</span>
                  <span className="mt-1 block text-xs font-bold text-[#1e293b] truncate">
                    {detay.teknik_adi || "Belirtilmemiş"}
                  </span>
                </div>

                <div className="rounded-xl border border-[#e2e8f0] bg-white p-3 shadow-sm">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#7e8f9f] block">Puan Skalası</span>
                  <span className="mt-1 flex items-center gap-1 text-xs font-extrabold text-[#237ac8]">
                    <Award className="h-3.5 w-3.5" />
                    <span>Araç: {detay.video_puani ?? "—"} p</span>
                    {detay.soru_puani ? <span className="text-[#64748b] font-normal">| Soru: ~{detay.soru_puani} p</span> : null}
                  </span>
                </div>

                <div className="rounded-xl border border-[#e2e8f0] bg-white p-3 shadow-sm">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#7e8f9f] block">Yayın Tarihi</span>
                  <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#334155]">
                    <Clock className="h-3.5 w-3.5 text-[#94a3b8]" />
                    <span>{formatTarih(detay.yayin_tarihi)}</span>
                  </span>
                </div>

                <div className="rounded-xl border border-[#e2e8f0] bg-white p-3 shadow-sm">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#7e8f9f] block">Hedef Kitle</span>
                  <div className="mt-1 flex items-center gap-1 flex-wrap">
                    {detay.hedef_roller?.length ? (
                      <HedefRolPilleri hedefRoller={detay.hedef_roller} />
                    ) : (
                      <span className="text-xs text-[#94a3b8] italic">Tümü</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Sekme Seçicisi */}
              <div className="flex border-b border-[#e2e8f0] gap-4">
                <button
                  type="button"
                  onClick={() => setAktifSekme("arac")}
                  className={`flex items-center gap-1.5 pb-2.5 text-xs font-extrabold transition-colors relative ${
                    aktifSekme === "arac"
                      ? "text-[#237ac8] border-b-2 border-[#237ac8]"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  <Film className="h-3.5 w-3.5" />
                  <span>Öğrenme Aracı Önizleme</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAktifSekme("sorular")}
                  className={`flex items-center gap-1.5 pb-2.5 text-xs font-extrabold transition-colors relative ${
                    aktifSekme === "sorular"
                      ? "text-[#237ac8] border-b-2 border-[#237ac8]"
                      : "text-[#64748b] hover:text-[#0f172a]"
                  }`}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>Atanmış Sorular ve Cevaplar ({sorularDizisi.length})</span>
                </button>
              </div>

              {/* Sekme 1: Öğrenme Aracı */}
              {aktifSekme === "arac" && (
                <div className="rounded-2xl border border-[#e2e8f0] bg-white p-3.5 sm:p-5 shadow-sm">
                  <OgrenmeAraciOnizleme
                    yayinId={detay.yayin_id}
                    aracId={detay.arac_id ?? detay.yayin_id}
                    aracTuru={detay.arac_turu}
                    videoUrl={detay.video_url}
                    urunAdi={detay.urun_adi ?? "Öğrenme Aracı"}
                    hata={(m) => console.error(m)}
                    onBitti={() => {}}
                  />
                </div>
              )}

              {/* Sekme 2: Sorular & Cevaplar */}
              {aktifSekme === "sorular" && (
                <div className="space-y-3">
                  {sorularDizisi.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#cbd5e1] bg-white p-8 text-center text-xs text-[#64748b]">
                      Bu yayına ait kayıtlı soru seti bulunamadı.
                    </div>
                  ) : (
                    sorularDizisi.map((s, idx) => {
                      return (
                        <div
                          key={idx}
                          className="rounded-2xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <h4 className="text-xs sm:text-sm font-extrabold text-[#1e293b] leading-relaxed">
                              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-[#eff6ff] text-[#2563eb] text-[11px] mr-2">
                                {idx + 1}
                              </span>
                              {s.soru_metni}
                            </h4>
                            {s.puan ? (
                              <span className="shrink-0 rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-bold text-[#475569]">
                                {s.puan} puan
                              </span>
                            ) : null}
                          </div>

                          {/* Şıklar */}
                          <div className="mt-3.5 grid gap-2 sm:grid-cols-2">
                            {Array.isArray(s.secenekler) &&
                              s.secenekler.map((sec, sIdx) => {
                                const dogruMu =
                                  sec.dogru === true ||
                                  (s.dogru_cevap &&
                                    s.dogru_cevap.trim().toUpperCase() === sec.harf.trim().toUpperCase());

                                return (
                                  <div
                                    key={sIdx}
                                    className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs font-semibold transition-colors ${
                                      dogruMu
                                        ? "border-[#86efac] bg-[#f0fdf4] text-[#166534] font-bold ring-1 ring-[#86efac]"
                                        : "border-[#f1f5f9] bg-[#f8fafc] text-[#475569]"
                                    }`}
                                  >
                                    <span
                                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg text-[10px] font-extrabold ${
                                        dogruMu
                                          ? "bg-[#22c55e] text-white"
                                          : "bg-[#e2e8f0] text-[#475569]"
                                      }`}
                                    >
                                      {sec.harf}
                                    </span>
                                    <span className="flex-1 leading-snug">{sec.metin}</span>
                                    {dogruMu && (
                                      <span className="shrink-0 text-[10px] font-extrabold text-[#15803d] flex items-center gap-1">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> Doğru
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Alt Footer */}
        <div className="flex items-center justify-between border-t border-[#e2e8f0] bg-white px-4 py-2.5 sm:px-6">
          <span className="text-[11px] font-semibold text-[#64748b]">
            Antigravity İçerik ve Soru Analiz Modülü
          </span>
          <button
            type="button"
            onClick={onKapat}
            className="rounded-xl bg-[#237ac8] px-4 py-1.5 text-xs font-extrabold text-white hover:bg-[#1d69aa] transition-colors shadow-sm"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
