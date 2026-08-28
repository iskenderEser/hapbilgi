"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Package,
  Pill,
  Sparkles,
  Store,
  User,
} from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import { ECZANEM_RAPOR_GOREN_ROLLER, ECZANEM_TALEP_ACAN_ROLLER, YONETICI_ROLLER, ROL_ADLARI } from "@/lib/utils/roller";
import { GRI_METIN, KIRMIZI, PERIYOTLAR, type Periyot } from "@/lib/utils/raporUtils";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";
import OgrenmeAraciPerformansi from "@/components/raporlar/OgrenmeAraciPerformansi";
import type { AracTuruRaporSatiri } from "@/lib/rapor/paylasilan/aracTuruDagilimi";
import styles from "../utt/utt-report.module.css";

const DEFAULT_PERIYOT: Periyot = "bu_ay";

const PERIYOT_KAPSAM_ADI: Record<Periyot, string> = {
  bu_gun: "Bugün",
  bu_hafta: "Bu hafta",
  bu_ay: "Bu ay",
  bu_donem: "Bu dönem",
  bu_yil: "Bu yıl",
};

interface KullaniciBilgisi {
  ad: string;
  soyad: string;
  rol: string;
  bolge_adi: string | null;
  takim_adi: string | null;
  firma_adi: string | null;
}

interface EczaneSatiri {
  eczane_adi: string;
  kutu: number;
  indirim_tl: number;
}

interface UttSatiri {
  utt_adi: string;
  kutu: number;
  indirim_tl: number;
  eczaneler: EczaneSatiri[];
}

interface BolgeSatiri {
  bolge_adi: string;
  kutu: number;
  indirim_tl: number;
  uttler: UttSatiri[];
}

interface PmUrunSatiri {
  urun_id: string;
  urun_adi: string;
  kutu: number;
  indirim_tl: number;
  bolgeler: BolgeSatiri[];
}

interface CascadeUrunSatiri {
  urun_id: string;
  urun_adi: string;
  kutu: number;
  indirim_tl: number;
}

interface CascadeEczaneSatiri {
  eczane_id: string;
  eczane_adi: string;
  utt_adi: string | null;
  toplam_kutu: number;
  toplam_tl: number;
  urunler: CascadeUrunSatiri[];
}

interface RaporApiData {
  arac_turu_dagilimi?: AracTuruRaporSatiri[];
  aktif: boolean;
  tip?: "cascade" | "pm";
  kullanici?: KullaniciBilgisi;
  urunler?: PmUrunSatiri[];
  eczaneler?: CascadeEczaneSatiri[];
  toplam_kutu?: number;
  toplam_tl?: number;
}

export default function EczanemRaporPage() {
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const [periyot, setPeriyot] = useState<Periyot>(DEFAULT_PERIYOT);
  const [data, setData] = useState<RaporApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  // Akordiyon state
  const [acikOgeler, setAcikOgeler] = useState<Set<string>>(new Set());

  const rolKucu = (kullanici?.rol ?? "").toLowerCase();

  const veriCek = async (sessiz = false) => {
    if (sessiz) setYenileniyor(true);
    else setLoading(true);
    setHata(null);

    try {
      const res = await fetch(`/raporlar/api/eczanem?periyot=${periyot}`);
      const d = await res.json();

      if (!res.ok || !d.success) {
        setHata(d.hata ?? "Eczanem rapor verisi çekilemedi.");
        return;
      }

      setData(d.data ?? null);

      // İlk yüklemede PM ise tüm ürünleri açık getir
      if (!sessiz && d.data?.tip === "pm" && d.data.urunler) {
        setAcikOgeler(new Set(d.data.urunler.map((u: PmUrunSatiri) => u.urun_id)));
      }
    } catch {
      setHata("Bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
      setYenileniyor(false);
    }
  };

  useEffect(() => {
    if (kullanici && ECZANEM_RAPOR_GOREN_ROLLER.includes(rolKucu)) {
      veriCek();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periyot, kullanici]);

  const toggleOge = (key: string) => {
    setAcikOgeler((onceki) => {
      const yeni = new Set(onceki);
      if (yeni.has(key)) yeni.delete(key);
      else yeni.add(key);
      return yeni;
    });
  };

  if (authYukleniyor || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm" style={{ color: GRI_METIN }}>Yükleniyor...</div>
      </div>
    );
  }

  if (hata) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm" style={{ color: KIRMIZI }}>Hata: {hata}</div>
      </div>
    );
  }

  if (!kullanici || !data) return null;

  const donemAdi = PERIYOT_KAPSAM_ADI[periyot];

  const k: KullaniciBilgisi = data.kullanici ?? {
    ad: kullanici.ad ?? "",
    soyad: kullanici.soyad ?? "",
    rol: kullanici.rol ?? "",
    bolge_adi: null,
    takim_adi: null,
    firma_adi: null,
  };

  const rolKodu = (k.rol || rolKucu).toLowerCase();
  const rolMetni = (k.rol || rolKucu).toUpperCase();

  // Rol-spesifik başlık, eyebrow ve kimlik satırı (BM, TM, PM, Yönetici uyumlu)
  let eyebrowMetni = "Eczanem dağıtım & erişim analizi";
  let baslikMetni = "Eczanem Raporları";
  let kimlikMetni = `${k.ad} ${k.soyad} · ${rolMetni}`;

  if (rolKodu === "bm" && k.bolge_adi) {
    eyebrowMetni = "Bölge Eczanem dağıtım analizi";
    baslikMetni = `${k.bolge_adi} Bölgesi`;
    kimlikMetni = `${rolMetni} · ${k.ad} ${k.soyad}${k.takim_adi ? ` · ${k.takim_adi}` : ""}`;
  } else if (rolKodu === "tm" && k.takim_adi) {
    eyebrowMetni = "Takım Eczanem dağıtım analizi";
    baslikMetni = `${k.takim_adi} Takımı`;
    kimlikMetni = `${rolMetni} · ${k.ad} ${k.soyad}${k.firma_adi ? ` · ${k.firma_adi}` : ""}`;
  } else if (YONETICI_ROLLER.includes(rolKodu)) {
    eyebrowMetni = "Firma Eczanem dağıtım özeti";
    baslikMetni = k.firma_adi ? `${k.firma_adi}` : "Eczanem Firma Raporu";
    kimlikMetni = `${rolMetni} · ${k.ad} ${k.soyad}`;
  } else if (ECZANEM_TALEP_ACAN_ROLLER.includes(rolKodu)) {
    eyebrowMetni = "Ürün Eczanem dağıtım ve erişim etkisi";
    baslikMetni = "Eczanem Raporları";
    kimlikMetni = `${k.ad} ${k.soyad} · ${rolMetni}${k.takim_adi ? ` · ${k.takim_adi}` : ""}${k.firma_adi ? ` · ${k.firma_adi}` : ""}`;
  }

  // Toplamlar
  let toplamKutu = 0;
  let toplamIndirim = 0;
  let toplamBirimSayisi = 0;

  if (data.tip === "pm") {
    toplamKutu = (data.urunler ?? []).reduce((t, u) => t + (u.kutu || 0), 0);
    toplamIndirim = (data.urunler ?? []).reduce((t, u) => t + (u.indirim_tl || 0), 0);
    toplamBirimSayisi = (data.urunler ?? []).length;
  } else {
    toplamKutu = data.toplam_kutu ?? (data.eczaneler ?? []).reduce((t, e) => t + (e.toplam_kutu || 0), 0);
    toplamIndirim = data.toplam_tl ?? (data.eczaneler ?? []).reduce((t, e) => t + (e.toplam_tl || 0), 0);
    toplamBirimSayisi = (data.eczaneler ?? []).length;
  }

  const metrikKartlari = [
    {
      etiket: "Toplam Dağıtılan Kutu",
      deger: `${toplamKutu.toLocaleString("tr-TR")} Kutu`,
      not: `${donemAdi} dağıtılan`,
      icon: Pill,
      vurgu: "#16865f",
      zemin: "#ebf8f2",
    },
    {
      etiket: "Toplam İndirim Tutarı",
      deger: `₺${toplamIndirim.toLocaleString("tr-TR")}`,
      not: `${donemAdi} uygulanan`,
      icon: Building2,
      vurgu: "#b45309",
      zemin: "#fff7ed",
    },
    {
      etiket: data.tip === "pm" ? "Aktif Ürün Sayısı" : "Kayıtlı Eczane Sayısı",
      deger: toplamBirimSayisi,
      not: data.tip === "pm" ? "Eczanem hedefli ürünler" : "Kapsamdaki eczaneler",
      icon: data.tip === "pm" ? Package : Store,
      vurgu: "#237ac8",
      zemin: "#edf6fd",
    },
  ];

  return (
    <div className={styles.page} style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className={styles.container}>
        <Link href="/ana-sayfa" className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#7890aa] hover:text-[#237ac8]">
          <ArrowLeft className="h-3.5 w-3.5" /> Ana Sayfa
        </Link>

        <header className={styles.header}>
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#3589d8]">
              <Sparkles className="h-3.5 w-3.5" /> {eyebrowMetni}
            </div>
            <div className="inline-flex items-center">
              <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-[#10213d]">
                {baslikMetni}
              </h1>
              <SayfaRehberi anahtar="raporlar-eczanem" className="ml-1.5 -translate-y-1" />
            </div>
            <p className="mt-0.5 text-xs font-semibold text-[#78889d]">
              {kimlikMetni}
            </p>
          </div>

          <div className={styles.periods} aria-label="Rapor dönemi">
            {PERIYOTLAR.map((secenek) => (
              <button
                type="button"
                key={secenek.key}
                onClick={() => setPeriyot(secenek.key)}
                className={`${styles.periodButton} ${periyot === secenek.key ? styles.periodActive : ""}`}
              >
                {secenek.label}
              </button>
            ))}
            <YenileButonu yenileniyor={yenileniyor} onYenile={() => veriCek(true)} />
          </div>
        </header>
        <OgrenmeAraciPerformansi dagilim={data.arac_turu_dagilimi} />

        {/* Metrik Özet Kartları */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5">
          {metrikKartlari.map((kart) => {
            const Icon = kart.icon;
            return (
              <div
                key={kart.etiket}
                className="rounded-2xl border border-[#dfe7f1] bg-white p-4 shadow-sm flex items-center gap-3.5"
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: kart.zemin, color: kart.vurgu }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <span className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wide">
                    {kart.etiket}
                  </span>
                  <strong className="text-lg font-extrabold text-[#111827] block leading-tight mt-0.5">
                    {kart.deger}
                  </strong>
                  <span className="block text-[11px] text-[#9ca3af] font-medium mt-0.5">
                    {kart.not}
                  </span>
                </div>
              </div>
            );
          })}
        </section>

        {/* Ana İçerik Paneli */}
        <section className={`${styles.panel} p-5 md:p-6 mb-8`}>
          <div className="flex items-center justify-between mb-4 border-b border-[#edf2f7] pb-3">
            <div>
              <h2 className="text-base font-extrabold text-[#111827]">
                {data.tip === "pm" ? "Ürün Bazlı Dağıtım Dökümü" : "Eczane Mutabakat & Dağıtım Listesi"}
              </h2>
              <p className="text-xs text-[#6b7280] mt-0.5">
                {data.tip === "pm"
                  ? "Ürünlerin bölge, temsilci ve eczane bazlı dağıtılan kutu ve indirim toplamları"
                  : "Kapsamınızdaki eczanelerin ürün bazlı dağıtım ve indirim detayları"}
              </p>
            </div>
            <span className="text-xs font-bold text-[#237ac8] bg-[#edf6fd] px-3 py-1 rounded-full">
              {donemAdi}
            </span>
          </div>

          {/* PM GÖRÜNÜMÜ */}
          {data.tip === "pm" ? (
            (data.urunler ?? []).length === 0 ? (
              <div className="py-12 text-center text-xs font-semibold text-[#6b7280]">
                Bu dönemde Eczanem dağıtım kaydı bulunamadı.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {(data.urunler ?? []).map((urun) => {
                  const urunAcik = acikOgeler.has(urun.urun_id);

                  return (
                    <div
                      key={urun.urun_id}
                      className="overflow-hidden rounded-xl border border-[#e2e9f2] bg-[#ffffff] transition-all"
                    >
                      {/* Ürün Satırı */}
                      <button
                        type="button"
                        onClick={() => toggleOge(urun.urun_id)}
                        className="flex w-full items-center justify-between bg-[#f8fbff] px-4 py-3.5 text-left transition-colors hover:bg-[#f0f6fc] cursor-pointer border-none"
                      >
                        <div className="flex items-center gap-2.5">
                          {urunAcik ? (
                            <ChevronDown className="h-4 w-4 text-[#237ac8]" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-[#9ca3af]" />
                          )}
                          <span className="font-extrabold text-[#111827] text-sm">{urun.urun_adi}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="font-bold text-[#16865f] bg-[#ebf8f2] px-2.5 py-1 rounded-md">
                            {urun.kutu} Kutu
                          </span>
                          <span className="font-bold text-[#b45309] bg-[#fff7ed] px-2.5 py-1 rounded-md">
                            ₺{urun.indirim_tl.toLocaleString("tr-TR")} İndirim
                          </span>
                        </div>
                      </button>

                      {/* Bölgeler */}
                      {urunAcik && (
                        <div className="border-t border-[#edf2f7] p-3.5 flex flex-col gap-2.5 bg-[#ffffff]">
                          {urun.bolgeler.map((bolge) => {
                            const bolgeKey = `${urun.urun_id}_${bolge.bolge_adi}`;
                            const bolgeAcik = acikOgeler.has(bolgeKey);

                            return (
                              <div
                                key={bolgeKey}
                                className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] overflow-hidden"
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleOge(bolgeKey)}
                                  className="flex w-full items-center justify-between px-3.5 py-2.5 text-left hover:bg-[#f3f4f6] cursor-pointer border-none"
                                >
                                  <div className="flex items-center gap-2 text-xs font-bold text-[#374151]">
                                    <MapPin className="h-3.5 w-3.5 text-[#237ac8]" />
                                    <span>{bolge.bolge_adi} Bölgesi</span>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs">
                                    <span className="font-semibold text-[#4b5563]">{bolge.kutu} Kutu</span>
                                    <span className="font-semibold text-[#6b7280]">
                                      ₺{bolge.indirim_tl.toLocaleString("tr-TR")}
                                    </span>
                                    {bolgeAcik ? (
                                      <ChevronDown className="h-3.5 w-3.5 text-[#6b7280]" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5 text-[#9ca3af]" />
                                    )}
                                  </div>
                                </button>

                                {/* UTT'ler */}
                                {bolgeAcik && (
                                  <div className="border-t border-[#e5e7eb] bg-white p-3 flex flex-col gap-2.5">
                                    {bolge.uttler.map((utt) => {
                                      const uttKey = `${bolgeKey}_${utt.utt_adi}`;
                                      const uttAcik = acikOgeler.has(uttKey);

                                      return (
                                        <div
                                          key={uttKey}
                                          className="rounded-md border border-[#edf2f7] bg-[#ffffff] overflow-hidden"
                                        >
                                          <button
                                            type="button"
                                            onClick={() => toggleOge(uttKey)}
                                            className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[#f8fafc] cursor-pointer text-xs border-none"
                                          >
                                            <div className="flex items-center gap-2 font-bold text-[#1f2937]">
                                              <User className="h-3.5 w-3.5 text-[#6366f1]" />
                                              <span>{utt.utt_adi}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                              <span className="font-semibold text-[#16865f]">
                                                {utt.kutu} Kutu
                                              </span>
                                              <span className="text-[#6b7280]">₺{utt.indirim_tl}</span>
                                              {uttAcik ? (
                                                <ChevronDown className="h-3 w-3 text-[#6b7280]" />
                                              ) : (
                                                <ChevronRight className="h-3 w-3 text-[#9ca3af]" />
                                              )}
                                            </div>
                                          </button>

                                          {/* Eczaneler Tablosu */}
                                          {uttAcik && (
                                            <div className="border-t border-[#edf2f7] bg-[#fafafa] p-2.5 overflow-x-auto">
                                              <table className="w-full text-left text-xs">
                                                <thead>
                                                  <tr className="border-b border-[#e5e7eb] text-[10px] uppercase font-bold text-[#6b7280]">
                                                    <th className="pb-2 pl-2">Eczane Adı</th>
                                                    <th className="pb-2 text-right">Dağıtılan Kutu</th>
                                                    <th className="pb-2 pr-2 text-right">İndirim Tutarı</th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[#f3f4f6]">
                                                  {utt.eczaneler.map((ecz, idx) => (
                                                    <tr key={idx} className="hover:bg-white transition-colors">
                                                      <td className="py-2 pl-2 font-medium text-[#374151]">
                                                        {ecz.eczane_adi}
                                                      </td>
                                                      <td className="py-2 text-right font-bold text-[#16865f]">
                                                        {ecz.kutu}
                                                      </td>
                                                      <td className="py-2 pr-2 text-right font-semibold text-[#b45309]">
                                                        ₺{ecz.indirim_tl}
                                                      </td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* CASCADE GÖRÜNÜMÜ (BM / TM / YÖNETİCİ) */
            (data.eczaneler ?? []).length === 0 ? (
              <div className="py-12 text-center text-xs font-semibold text-[#6b7280]">
                Bu dönemde onaylanmış Eczanem işlemi bulunamadı.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {(data.eczaneler ?? []).map((ecz) => {
                  const eczAcik = acikOgeler.has(ecz.eczane_id);

                  return (
                    <div
                      key={ecz.eczane_id}
                      className="overflow-hidden rounded-xl border border-[#e2e9f2] bg-[#ffffff] transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => toggleOge(ecz.eczane_id)}
                        className="flex w-full items-center justify-between bg-[#f8fbff] px-4 py-3.5 text-left transition-colors hover:bg-[#f0f6fc] cursor-pointer border-none"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {eczAcik ? (
                            <ChevronDown className="h-4 w-4 text-[#237ac8] shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-[#9ca3af] shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span className="font-extrabold text-[#111827] text-sm block truncate">
                              {ecz.eczane_adi}
                            </span>
                            {ecz.utt_adi && (
                              <span className="text-[11px] text-[#6b7280] font-medium flex items-center gap-1 mt-0.5">
                                <User className="h-3 w-3 text-[#6366f1]" /> {ecz.utt_adi}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs shrink-0">
                          <span className="font-bold text-[#16865f] bg-[#ebf8f2] px-2.5 py-1 rounded-md">
                            {ecz.toplam_kutu} Kutu
                          </span>
                          <span className="font-bold text-[#b45309] bg-[#fff7ed] px-2.5 py-1 rounded-md">
                            ₺{(ecz.toplam_tl ?? 0).toLocaleString("tr-TR")}
                          </span>
                        </div>
                      </button>

                      {eczAcik && (
                        <div className="border-t border-[#edf2f7] p-3 bg-white overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-[#e5e7eb] text-[10px] uppercase font-bold text-[#6b7280]">
                                <th className="pb-2 pl-2">Ürün Adı</th>
                                <th className="pb-2 text-right">Dağıtılan Kutu</th>
                                <th className="pb-2 pr-2 text-right">İndirim Tutarı</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f3f4f6]">
                              {ecz.urunler.map((u) => (
                                <tr key={u.urun_id} className="hover:bg-[#f9fafb] transition-colors">
                                  <td className="py-2 pl-2 font-medium text-[#374151]">{u.urun_adi}</td>
                                  <td className="py-2 text-right font-bold text-[#16865f]">{u.kutu}</td>
                                  <td className="py-2 pr-2 text-right font-semibold text-[#b45309]">
                                    ₺{(u.indirim_tl ?? 0).toLocaleString("tr-TR")}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </section>
      </div>
    </div>
  );
}
