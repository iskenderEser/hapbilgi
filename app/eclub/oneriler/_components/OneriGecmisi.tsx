// app/eclub/oneriler/_components/OneriGecmisi.tsx
"use client";

import type { OneriGecmis } from "../_types";
import { ROL_ETIKETLERI } from "../_types";

interface Props {
  gecmis: OneriGecmis[];
}

function tarihKisa(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

// Öneri süresi doldu mu (oneri_bitis geçmiş mi)
function suresiDoldu(oneri_bitis: string): boolean {
  return new Date(oneri_bitis).getTime() < Date.now();
}

export function OneriGecmisi({ gecmis }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 md:px-5 py-3.5 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-900">Gönderdiğim Öneriler</span>
      </div>

      <div className="divide-y divide-gray-100">
        {gecmis.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">Henüz öneri göndermediniz.</p>
        )}

        {gecmis.map((o) => {
          const doldu = suresiDoldu(o.oneri_bitis);
          const durumEtiket = o.izlendi_mi
            ? { metin: "İzlendi", bg: "#f0fdf4", renk: "#16a34a", border: "#bbf7d0" }
            : doldu
              ? { metin: "İzlenmedi (süre doldu)", bg: "#fef2f2", renk: "#bc2d0d", border: "#fecaca" }
              : { metin: "Bekliyor", bg: "#fefce8", renk: "#854d0e", border: "#fde68a" };

          return (
            <div key={o.oneri_id} className="px-4 md:px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-gray-900">{o.urun_adi}</span>
                <span className="text-xs text-gray-500">
                  {o.kisi_ad} {o.kisi_soyad}
                  {o.kisi_rol ? ` · ${ROL_ETIKETLERI[o.kisi_rol]}` : ""}
                  {" · "}{o.eczane_adi}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{tarihKisa(o.created_at)}</span>
                <span className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={{ background: durumEtiket.bg, color: durumEtiket.renk, border: `0.5px solid ${durumEtiket.border}` }}>
                  {durumEtiket.metin}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}