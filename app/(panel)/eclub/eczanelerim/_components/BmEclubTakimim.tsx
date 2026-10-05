"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Gift, LoaderCircle, RefreshCw, UserCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";
import bmStyles from "@/app/(panel)/raporlar/bm/bm-report.module.css";
import { eclubBmGruplari } from "@/lib/eclub/bmGruplari";

interface BmKisi {
  kisi_id: string;
  rol: string;
  ad: string;
  soyad: string;
  eposta: string;
  telefon: string;
}

interface BmEczane {
  eczane_id: string;
  gln: string;
  eczane_adi: string;
  il: string | null;
  ilce: string | null;
  kisiler: BmKisi[];
}

interface BmUtt {
  bm_id: string | null;
  bm_adi: string;
  utt_id: string;
  utt_adi: string;
  takim_adi: string;
  bolge_adi: string;
  ozel_takim_adi: string | null;
  eczaneler: BmEczane[];
}

interface BmTakimYaniti {
  uttler: BmUtt[];
}

const ROL_ETIKETLERI: Record<string, string> = {
  eczaci: "Eczacı",
  ikinci_eczaci: "İkinci Eczacı",
  yardimci_eczaci: "Yardımcı Eczacı",
  eczane_teknisyeni: "Eczane Teknisyeni",
};

const unvanaGoreSay = (eczaneler: BmEczane[], roller: string[]) => eczaneler
  .flatMap((eczane) => eczane.kisiler)
  .filter((kisi) => roller.includes(kisi.rol)).length;

export default function BmEclubTakimim({ rol = "bm" }: { rol?: "bm" | "tm" }) {
  const router = useRouter();
  const [veri, setVeri] = useState<BmTakimYaniti | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");
  const [acikUttler, setAcikUttler] = useState<Set<string>>(new Set());
  const [acikEczaneler, setAcikEczaneler] = useState<Set<string>>(new Set());

  const veriCek = useCallback(async () => {
    setYukleniyor(true);
    setHata("");
    try {
      const yanit = await fetch("/eclub/eczanelerim/api", { cache: "no-store" });
      const govde = await yanit.json();
      if (!yanit.ok) throw new Error(govde.hata ?? "E-Club takım bilgileri alınamadı.");
      setVeri(govde as BmTakimYaniti);
    } catch (err) {
      setHata(err instanceof Error ? err.message : "E-Club takım bilgileri alınamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => { void veriCek(); }, [veriCek]);

  const eczaneler = useMemo(() => veri?.uttler.flatMap((utt) => utt.eczaneler) ?? [], [veri]);
  const toplamKisi = useMemo(() => eczaneler.reduce((toplam, eczane) => toplam + eczane.kisiler.length, 0), [eczaneler]);

  const uttDegistir = (uttId: string) => setAcikUttler((mevcut) => {
    const sonraki = new Set(mevcut);
    if (sonraki.has(uttId)) sonraki.delete(uttId); else sonraki.add(uttId);
    return sonraki;
  });
  const eczaneDegistir = (eczaneId: string) => setAcikEczaneler((mevcut) => {
    const sonraki = new Set(mevcut);
    if (sonraki.has(eczaneId)) sonraki.delete(eczaneId); else sonraki.add(eczaneId);
    return sonraki;
  });

  return (
    <div className="min-h-full bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center">
              <h1 className="text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">E-Club Takımım</h1>
              <SayfaRehberi anahtar="eclub-eczanelerim" className="ml-1.5 -translate-y-1.5" />
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-[#6b7f9b]">{rol === "tm" ? "Takımınızdaki BM ve UTT’lerin E-Club eczane ve kadro yapılarını inceleyin." : "Bölgenizdeki UTT’lerin E-Club eczane ve kadro yapılarını inceleyin."}</p>
          </div>
          <div className="flex flex-col items-stretch gap-2">
            <Button type="button" size="sm" onClick={() => router.push("/eclub/hediye-takip")} className="h-9 gap-2 border border-[#bfdbfe] bg-[#eaf4ff] px-3 text-xs font-extrabold text-[#1d4ed8] shadow-none hover:bg-[#dbeafe]">
              <Gift className="size-4" /> Hediye Takip
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void veriCek()} disabled={yukleniyor} className="gap-2 border-[#d8e2ed] text-[#60758d]">
              <RefreshCw className={`size-3.5 ${yukleniyor ? "animate-spin" : ""}`} /> Yenile
            </Button>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <OzetKart ikon={<Users className="size-3.5 text-[#2563eb]" />} etiket="UTT" deger={veri?.uttler.length ?? 0} />
          <OzetKart ikon={<Building2 className="size-3.5 text-[#2563eb]" />} etiket="Bağlı Eczane" deger={eczaneler.length} />
          <OzetKart ikon={<UserCheck className="size-3.5 text-[#dc2626]" />} etiket="Eczacı" deger={unvanaGoreSay(eczaneler, ["eczaci", "ikinci_eczaci", "yardimci_eczaci"])} />
          <OzetKart ikon={<Users className="size-3.5 text-[#16a34a]" />} etiket="Toplam Kadro" deger={toplamKisi} />
        </section>

        {yukleniyor && !veri ? (
          <div className="flex min-h-52 items-center justify-center rounded-2xl border border-[#dfe7f1] bg-white"><LoaderCircle className="size-6 animate-spin text-[#60758d]" /></div>
        ) : hata ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{hata}</div>
        ) : !veri?.uttler.length ? (
          <div className="rounded-xl border border-gray-200 bg-white px-5 py-8 text-center text-sm text-gray-400">{rol === "tm" ? "Takımınıza" : "Bölgenize"} bağlı aktif UTT bulunmuyor.</div>
        ) : (
          <TakimHiyerarsisi rol={rol} uttler={veri.uttler} renderUttler={(uttler) => (
          <div className={bmStyles.tableWrap}>
            <table className={bmStyles.table}>
              <thead><tr><th>UTT Adı</th><th>Takım / Bölge</th><th>Eczane</th><th>Eczacı</th><th>Teknisyen</th></tr></thead>
              <tbody>
                {uttler.map((utt) => {
                  const uttAcik = acikUttler.has(utt.utt_id);
                  const eczaciSayisi = unvanaGoreSay(utt.eczaneler, ["eczaci", "ikinci_eczaci", "yardimci_eczaci"]);
                  const teknisyenSayisi = unvanaGoreSay(utt.eczaneler, ["eczane_teknisyeni"]);
                  return (
                    <Fragment key={utt.utt_id}>
                      <tr className={uttAcik ? bmStyles.openRow : undefined}>
                        <td><button type="button" className={bmStyles.uttToggle} onClick={() => uttDegistir(utt.utt_id)} aria-expanded={uttAcik}><strong>{utt.utt_adi}</strong><small>{utt.ozel_takim_adi ?? "E-Club Takımı"}</small><ChevronDown size={14} className={uttAcik ? bmStyles.chevronOpen : bmStyles.chevron} /></button></td>
                        <td>{utt.takim_adi} · {utt.bolge_adi}</td>
                        <td>{utt.eczaneler.length}</td>
                        <td>{eczaciSayisi}</td>
                        <td>{teknisyenSayisi}</td>
                      </tr>
                      {uttAcik && (
                        <tr className={bmStyles.detailRow}>
                          <td colSpan={5}>
                            {utt.eczaneler.length === 0 ? <div className={bmStyles.empty}>Bu UTT’ye bağlı aktif E-Club eczanesi bulunmuyor.</div> : (
                              <div className="overflow-hidden rounded-xl border border-[#dfe8f1] bg-white">
                                <table className="w-full min-w-[720px] border-collapse text-[11px]">
                                  <thead className="bg-[#f7f9fc] text-left text-[9px] font-extrabold uppercase tracking-[0.04em] text-[#7d8ea2]"><tr><th className="px-3 py-2.5">Eczane Adı</th><th className="px-3 py-2.5">Konum</th><th className="px-3 py-2.5">GLN</th><th className="px-3 py-2.5">Kadro</th></tr></thead>
                                  <tbody>{utt.eczaneler.map((eczane) => {
                                    const eczaneAcik = acikEczaneler.has(eczane.eczane_id);
                                    return <Fragment key={eczane.eczane_id}>
                                      <tr className={`border-t border-[#edf1f5] text-[#40556d] ${eczaneAcik ? "bg-[#f0f7fe]" : ""}`}>
                                        <td className="px-3 py-3"><button type="button" onClick={() => eczaneDegistir(eczane.eczane_id)} aria-expanded={eczaneAcik} className="inline-flex min-w-44 items-center gap-2 text-left font-extrabold"><span>{eczane.eczane_adi}</span><ChevronDown size={13} className={`text-[#6f91ad] transition-transform ${eczaneAcik ? "rotate-180" : ""}`} /></button></td>
                                        <td className="px-3 py-3 font-bold">{[eczane.il, eczane.ilce].filter(Boolean).join(" / ") || "—"}</td>
                                        <td className="px-3 py-3 font-mono font-bold">{eczane.gln}</td>
                                        <td className="px-3 py-3 font-bold">{eczane.kisiler.length} kişi</td>
                                      </tr>
                                      {eczaneAcik && <tr className="border-t border-[#e5eef7] bg-[#f8fbfe]"><td colSpan={4} className="p-3"><KadroListesi kisiler={eczane.kisiler} /></td></tr>}
                                    </Fragment>;
                                  })}</tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          )} />
        )}
      </div>
    </div>
  );
}

function TakimHiyerarsisi({ rol, uttler, renderUttler }: {
  rol: "bm" | "tm";
  uttler: BmUtt[];
  renderUttler: (uttler: BmUtt[]) => React.ReactNode;
}) {
  const [acikBmler, setAcikBmler] = useState<Set<string>>(new Set());
  const gruplar = useMemo(() => eclubBmGruplari(uttler), [uttler]);
  if (rol === "bm") return renderUttler(uttler);
  return <div className={bmStyles.tableWrap}>
    <table className={bmStyles.table}>
      <thead><tr><th>BM Adı</th><th>Bölge</th><th>UTT</th><th>Eczane</th><th>Kadro</th></tr></thead>
      <tbody>{gruplar.map((bm) => {
        const acik = acikBmler.has(bm.id);
        const eczaneler = bm.uttler.flatMap((utt) => utt.eczaneler);
        return <Fragment key={bm.id}>
          <tr className={acik ? bmStyles.openRow : undefined}>
            <td><button type="button" className={bmStyles.uttToggle} aria-expanded={acik} onClick={() => setAcikBmler((mevcut) => {
              const sonraki = new Set(mevcut);
              if (sonraki.has(bm.id)) sonraki.delete(bm.id); else sonraki.add(bm.id);
              return sonraki;
            })}><strong>{bm.ad}</strong><ChevronDown size={14} className={acik ? bmStyles.chevronOpen : bmStyles.chevron} /></button></td>
            <td>{bm.bolgeler.join(" / ")}</td><td>{bm.uttler.length}</td><td>{eczaneler.length}</td><td>{eczaneler.reduce((toplam, eczane) => toplam + eczane.kisiler.length, 0)}</td>
          </tr>
          {acik && <tr className={bmStyles.detailRow}><td colSpan={5}>{renderUttler(bm.uttler)}</td></tr>}
        </Fragment>;
      })}</tbody>
    </table>
  </div>;
}

function OzetKart({ ikon, etiket, deger }: { ikon: React.ReactNode; etiket: string; deger: number }) {
  return <div className="rounded-xl border border-[#dfe7f1] bg-white p-3.5 shadow-sm"><div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wide text-[#7b8da5]">{ikon}{etiket}</div><strong className="mt-1 block text-2xl font-black text-[#1e293b]">{deger}</strong></div>;
}

function KadroListesi({ kisiler }: { kisiler: BmKisi[] }) {
  if (kisiler.length === 0) return <div className="py-3 text-center text-xs font-semibold text-[#8a99aa]">Bu eczanede kayıtlı aktif kişi bulunmuyor.</div>;
  const kisiGrid = { gridTemplateColumns: "minmax(180px,1.2fr) minmax(130px,.8fr) minmax(200px,1.2fr) minmax(120px,.7fr)" };
  return <div className={bmStyles.nestedUttWrap}>
    <div className={bmStyles.nestedUttHeader} style={kisiGrid}><span>Kişi</span><span>Unvan</span><span>E-posta</span><span>Telefon</span></div>
    {kisiler.map((kisi) => <div key={kisi.kisi_id} className={bmStyles.nestedUttGroup}>
      <div className={bmStyles.nestedUttRow} style={kisiGrid}>
        <span className={bmStyles.nestedUttIdentity}><strong>{kisi.ad} {kisi.soyad}</strong><small>Kişi bilgileri</small></span>
        <span><Badge variant="outline" className="border-[#d9e5f0] bg-[#f7fafe] text-[9px] text-[#60758d]">{ROL_ETIKETLERI[kisi.rol] ?? kisi.rol}</Badge></span>
        <span className="truncate">{kisi.eposta}</span>
        <span>{kisi.telefon}</span>
      </div>
    </div>)}
  </div>;
}
