// HBStore ekip sipariş listesi. Masaüstünde tablo, tablet/mobilde açılır satır.
// Tarih, ürün, alıcı, adet, puan, durum, kargo ve teslimat sözleşmesi korunur.

"use client";

import { useState } from "react";
import { ChevronDown, MapPin, Package, Truck } from "lucide-react";
import type { SiparisSatiri } from "../_types";
import type { AdresSnapshot } from "@/lib/store/tipler";
import { DURUM_ETIKETLERI, DURUM_RENKLERI } from "@/lib/store/sabitler";
import { kargoTakipUrl } from "@/lib/store/kargo";

interface SiparisTablosuProps {
  siparisler: SiparisSatiri[];
  toplam: number;
  dahaVar: boolean;
  yukleniyor: boolean;
  dahaYukleniyor: boolean;
  dahaFazlaYukle: () => void;
}

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  borderBottom: "1px solid #e8edf3",
  fontWeight: 800,
  color: "#61748b",
  fontSize: "10px",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  background: "#f7f9fc",
  fontFamily: "'Nunito', sans-serif",
};

const tdStyle: React.CSSProperties = {
  padding: "11px 12px",
  borderBottom: "1px solid #eef2f6",
  color: "#203653",
  fontSize: "12px",
  fontFamily: "'Nunito', sans-serif",
  verticalAlign: "middle",
};

const tarihFormatla = (iso: string | null): string => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function DurumRozeti({ durum }: { durum: SiparisSatiri["durum"] }) {
  const stil = DURUM_RENKLERI[durum];
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-extrabold"
      style={{ color: stil.metin, background: stil.arka, border: `1px solid ${stil.kenar}` }}
    >
      {DURUM_ETIKETLERI[durum]}
    </span>
  );
}

function UrunKimligi({ siparis }: { siparis: SiparisSatiri }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#f3f6fa] text-[#8190a3]">
        {siparis.urun_gorsel_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={siparis.urun_gorsel_url} alt={siparis.urun_adi} className="h-full w-full object-cover" />
        ) : (
          <Package size={15} />
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate font-bold text-[#203653]">{siparis.urun_adi}</div>
        <div className="mt-0.5 text-[10px] font-medium text-[#8190a3]">{siparis.adet} adet</div>
      </div>
    </div>
  );
}

function KargoBilgisi({ siparis }: { siparis: SiparisSatiri }) {
  const kargoUrl = kargoTakipUrl(siparis.kargo_firmasi, siparis.kargo_takip_no);
  if (!siparis.kargo_firmasi) return <span className="text-[#9aa8b8]">—</span>;
  return (
    <div>
      <div className="font-semibold text-[#203653]">{siparis.kargo_firmasi}</div>
      {kargoUrl ? (
        <a href={kargoUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-[#185fa5] underline underline-offset-2">
          {siparis.kargo_takip_no}
        </a>
      ) : (
        <div className="text-[11px] text-[#8190a3]">{siparis.kargo_takip_no}</div>
      )}
    </div>
  );
}

export default function SiparisTablosu(p: SiparisTablosuProps) {
  const [acikSiparis, setAcikSiparis] = useState<string | null>(null);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8edf3] px-4 py-3.5">
        <div>
          <h2 className="text-sm font-extrabold text-[#203653]">Sipariş Listesi</h2>
          <p className="mt-0.5 text-[11px] font-medium text-[#8190a3]">
            {p.yukleniyor ? "Siparişler yükleniyor..." : `${p.siparisler.length} / ${p.toplam} sipariş gösteriliyor`}
          </p>
        </div>
        <div className="rounded-xl bg-[#f3f7fb] px-3 py-1.5 text-xs font-extrabold text-[#45627f]">
          Toplam {p.toplam}
        </div>
      </div>

      {p.yukleniyor ? (
        <div className="px-4 py-12 text-center text-sm font-medium text-[#8190a3]">Yükleniyor...</div>
      ) : p.siparisler.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <Package className="mx-auto h-7 w-7 text-[#b8c4d1]" />
          <p className="mt-2 text-sm font-bold text-[#61748b]">Bu filtrelerle eşleşen sipariş yok.</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th style={thStyle}>Tarih</th>
                  <th style={thStyle}>Ürün</th>
                  <th style={thStyle}>Alıcı</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Toplam Puan</th>
                  <th style={thStyle}>Durum</th>
                  <th style={thStyle}>Kargo</th>
                  <th style={thStyle}>Teslimat</th>
                </tr>
              </thead>
              <tbody>
                {p.siparisler.map((siparis) => {
                  const adres = siparis.adres_snapshot as AdresSnapshot;
                  return (
                    <tr key={siparis.siparis_id} className="transition-colors hover:bg-[#fbfcfe]">
                      <td style={{ ...tdStyle, whiteSpace: "nowrap", color: "#71859d" }}>{tarihFormatla(siparis.created_at)}</td>
                      <td style={{ ...tdStyle, minWidth: 210 }}><UrunKimligi siparis={siparis} /></td>
                      <td style={tdStyle}>
                        <div className="font-bold">{siparis.alici_ad} {siparis.alici_soyad}</div>
                        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#8190a3]">{siparis.alici_rol}</div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", color: "#bc2d0d", fontWeight: 800 }}>{siparis.toplam_puan.toLocaleString("tr-TR")}</td>
                      <td style={tdStyle}><DurumRozeti durum={siparis.durum} /></td>
                      <td style={tdStyle}><KargoBilgisi siparis={siparis} /></td>
                      <td style={{ ...tdStyle, color: "#71859d", minWidth: 130 }}>{adres.ilce} / {adres.il}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-[#e8edf3] lg:hidden">
            {p.siparisler.map((siparis) => {
              const adres = siparis.adres_snapshot as AdresSnapshot;
              const acik = acikSiparis === siparis.siparis_id;
              return (
                <div key={siparis.siparis_id}>
                  <button
                    type="button"
                    className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 text-left transition-colors ${acik ? "bg-[#f7faff]" : "bg-white hover:bg-[#fbfcfe]"}`}
                    onClick={() => setAcikSiparis(acik ? null : siparis.siparis_id)}
                    aria-expanded={acik}
                  >
                    <div className="min-w-0">
                      <UrunKimligi siparis={siparis} />
                      <div className="mt-2 flex flex-wrap items-center gap-2 pl-[46px]">
                        <span className="text-[11px] font-bold text-[#45627f]">{siparis.alici_ad} {siparis.alici_soyad}</span>
                        <DurumRozeti durum={siparis.durum} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <strong className="whitespace-nowrap text-sm text-[#bc2d0d]">{siparis.toplam_puan.toLocaleString("tr-TR")}</strong>
                      <ChevronDown size={16} className={`text-[#71859d] transition-transform ${acik ? "rotate-180" : ""}`} />
                    </div>
                  </button>

                  {acik && (
                    <div className="grid gap-3 border-t border-[#edf1f5] bg-[#fbfcfe] px-4 py-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-[#e8edf3] bg-white p-3">
                        <div className="text-[10px] font-extrabold uppercase tracking-wide text-[#8190a3]">Sipariş</div>
                        <div className="mt-1 text-xs font-bold text-[#203653]">{tarihFormatla(siparis.created_at)}</div>
                        <div className="mt-1 text-[11px] text-[#71859d]">{siparis.adet} adet · birim {siparis.puan_birim_fiyat.toLocaleString("tr-TR")} puan</div>
                      </div>
                      <div className="rounded-xl border border-[#e8edf3] bg-white p-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[#8190a3]"><Truck size={12} /> Kargo</div>
                        <div className="mt-1 text-xs"><KargoBilgisi siparis={siparis} /></div>
                      </div>
                      <div className="rounded-xl border border-[#e8edf3] bg-white p-3 sm:col-span-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[#8190a3]"><MapPin size={12} /> Teslimat</div>
                        <div className="mt-1 text-xs font-bold text-[#203653]">{adres.alici_adi} · {adres.ilce} / {adres.il}</div>
                        <div className="mt-1 text-[11px] leading-4 text-[#71859d]">{adres.adres_detay}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {p.dahaVar && !p.yukleniyor && (
        <div className="border-t border-[#e8edf3] px-4 py-4 text-center">
          <button
            onClick={p.dahaFazlaYukle}
            disabled={p.dahaYukleniyor}
            className="rounded-xl border border-[#d7e1ec] bg-white px-5 py-2 text-xs font-extrabold text-[#45627f] transition-colors hover:bg-[#f6f9fc] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {p.dahaYukleniyor ? "Yükleniyor..." : "Daha Fazla Yükle"}
          </button>
        </div>
      )}
    </section>
  );
}
