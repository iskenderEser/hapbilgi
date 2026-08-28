"use client";

import { useEffect, useState } from "react";
import type { BekleyenDosya } from "@/app/(panel)/talepler/_types";

export function FlipPdfTalepAlanlari({ hazir, pdf, onSec, onSil }: { hazir: boolean; pdf: BekleyenDosya | null; onSec: (e: React.ChangeEvent<HTMLInputElement>) => void; onSil: () => void }) {
  const [onizleme, setOnizleme] = useState("");
  useEffect(() => {
    if (!pdf) { setOnizleme(""); return; }
    const url = URL.createObjectURL(pdf.dosya);
    setOnizleme(url);
    return () => URL.revokeObjectURL(url);
  }, [pdf]);

  return <div className="rounded-2xl border border-[#dfe8f3] bg-white p-4"><h3 className="text-sm font-extrabold text-[#263b58]">Literatür</h3><p className="mt-1 text-xs text-[#7a8ca5]">İçerik üreticisi literatürü nihai PDF dosyası olarak hazırlayacaktır.</p>{hazir && <div className="mt-3 rounded-xl border border-dashed border-[#56aeff] bg-[#f6faff] p-3"><label className="text-xs font-extrabold text-[#287fce]">Hazır literatür PDF'sini seçin<input type="file" accept=".pdf,application/pdf" className="mt-2 block w-full text-xs" onChange={onSec} /></label>{pdf && <><div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs"><span className="truncate">{pdf.preview.dosya_adi}</span><button type="button" onClick={onSil} className="text-[#bc2d0d]">Sil</button></div>{onizleme && <iframe src={onizleme} title="Hazır literatür PDF ön izlemesi" className="mt-3 h-72 w-full rounded-lg border border-[#dfe8f3] bg-white" />}</>}</div>}</div>;
}
