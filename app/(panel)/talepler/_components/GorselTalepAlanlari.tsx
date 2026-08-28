"use client";

import type { BekleyenDosya } from "@/app/(panel)/talepler/_types";

export function GorselTalepAlanlari({ hazir, gorsel, onSec, onSil }: { hazir: boolean; gorsel: BekleyenDosya | null; onSec: (e: React.ChangeEvent<HTMLInputElement>) => void; onSil: () => void }) {
  return <div className="rounded-2xl border border-[#dfe8f3] bg-white p-4"><h3 className="text-sm font-extrabold text-[#263b58]">Görsel öğrenme aracı</h3><p className="mt-1 text-xs text-[#7a8ca5]">İçerik üreticisi JPEG, JPG, PNG veya WebP görsel hazırlayacaktır.</p>{hazir && <div className="mt-3 rounded-xl border border-dashed border-[#56aeff] bg-[#f6faff] p-3"><label className="text-xs font-extrabold text-[#287fce]">Hazır görseli seçin<input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="mt-2 block w-full text-xs" onChange={onSec} /></label>{gorsel && <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs"><span className="truncate">{gorsel.preview.dosya_adi}</span><button type="button" onClick={onSil} className="text-[#bc2d0d]">Sil</button></div>}</div>}</div>;
}
