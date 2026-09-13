"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleCheckBig,
  Clock3,
  Coins,
  Copy,
  Gift,
  MapPin,
  Package,
  RotateCcw,
  Send,
  ShieldCheck,
  Store,
  Truck,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import EclubYonetimHiyerarsisi from "@/components/eclub/EclubYonetimHiyerarsisi";
import HataMesaji, { useHataMesaji } from "@/components/HataMesaji";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import {
  ECLUB_SIPARIS_DURUMLARI,
  ECLUB_SIPARIS_DURUM_ETIKETLERI,
  ECLUB_SIPARIS_DURUM_RENKLERI,
  type EclubEkipSiparisSatiri,
  type EclubSiparisApiData,
  type EclubSiparisDurum,
} from "@/lib/eclub/store/ekipSiparis";
import type { EclubYonetimKapsami } from "@/lib/eclub/yonetimKapsami";
import { ECLUB_YONETIM_ROLLERI, eclubKisiRolEtiketi } from "@/lib/utils/roller";

const SAYFA_BOYUTU = 30;

interface Filtreler {
  utt_id: string;
  eczane_id: string;
  kisi_id: string;
  durum: string;
  tarih_baslangic: string;
  tarih_bitis: string;
}

const BOS_FILTRELER: Filtreler = {
  utt_id: "",
  eczane_id: "",
  kisi_id: "",
  durum: "",
  tarih_baslangic: "",
  tarih_bitis: "",
};

interface EclubSiparisSayfaData extends EclubSiparisApiData {
  kapsam_hiyerarsi: EclubYonetimKapsami | null;
  utt_ozetleri: Array<{ utt_id: string; ozet: EclubSiparisApiData["ozet"] }>;
}

const BOS_DATA: EclubSiparisSayfaData = {
  siparisler: [],
  toplam: 0,
  ozet: { toplam: 0, islemde: 0, kargoda: 0, teslim_edildi: 0, iptal: 0, firma_kullanilan_puan: 0 },
  kapsam: { eczaneler: [], kisiler: [] },
  kapsam_hiyerarsi: null,
  utt_ozetleri: [],
};

const selectSinifi = "w-full min-w-0 rounded-xl border border-[#dfe7f1] bg-white px-3 py-2 text-xs font-semibold text-[#40556d] outline-none transition focus:border-[#8abde8] focus:ring-2 focus:ring-[#dceefa]";

function tarihFormatla(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DurumRozeti({ durum }: { durum: EclubSiparisDurum }) {
  const renk = ECLUB_SIPARIS_DURUM_RENKLERI[durum] ?? { metin: "#40556d", arka: "#f1f5f9", kenar: "#cbd5e1" };
  const etiket = ECLUB_SIPARIS_DURUM_ETIKETLERI[durum] ?? durum;
  return (
    <span
      className="inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-extrabold"
      style={{ color: renk.metin, background: renk.arka, borderColor: renk.kenar }}
    >
      {etiket}
    </span>
  );
}

function Urun({ siparis }: { siparis: EclubEkipSiparisSatiri }) {
  const isCek = Boolean(siparis.talep_id) || Boolean(siparis.talep_edilen_cek_tl);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl ${isCek ? "bg-emerald-50 text-emerald-700" : "bg-[#f2f6fa] text-[#8190a3]"}`}>
        {isCek ? (
          <Gift size={20} />
        ) : siparis.urun_gorsel_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={siparis.urun_gorsel_url} alt={siparis.urun_adi} className="h-full w-full object-cover" />
        ) : <Package size={16} />}
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-extrabold text-[#203653]">{siparis.urun_adi}</div>
        {isCek ? (
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-[#8796a8]">
            <span className="font-bold text-emerald-700">Migros Hediye Çeki</span>
            {siparis.siparis_adet ? (
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-extrabold text-blue-700">
                {siparis.siparis_adet} Adet {siparis.siparis_mal_fazlasi ? `+ ${siparis.siparis_mal_fazlasi} MF` : ""}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="mt-0.5 text-[10px] font-semibold text-[#8796a8]">
            {siparis.adet} adet · {siparis.puan_birim_fiyat.toLocaleString("tr-TR")} puan/adet
          </div>
        )}
      </div>
    </div>
  );
}

function Alici({ siparis }: { siparis: EclubEkipSiparisSatiri }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-xs font-extrabold text-[#203653]">{siparis.kisi_ad} {siparis.kisi_soyad}</div>
      <div className="mt-0.5 truncate text-[10px] font-semibold text-[#8190a3]">
        {eclubKisiRolEtiketi(siparis.kisi_rol)} · {siparis.eczane_adi}
      </div>
      {siparis.bm_adi && siparis.bm_adi !== "—" && (
        <div className="mt-0.5 truncate text-[9px] font-bold text-[#3589d8]">
          UTT: {siparis.utt_adi} · BM: {siparis.bm_adi}
        </div>
      )}
    </div>
  );
}

function SiparisListesi({
  data,
  kullaniciRol,
  yukleniyor,
  dahaYukleniyor,
  dahaFazlaYukle,
  onIslemTamamlandi,
}: {
  data: EclubSiparisApiData;
  kullaniciRol: string;
  yukleniyor: boolean;
  dahaYukleniyor: boolean;
  dahaFazlaYukle: () => void;
  onIslemTamamlandi: () => void;
}) {
  const [acikSiparis, setAcikSiparis] = useState<string | null>(null);
  const [seciliTalepler, setSeciliTalepler] = useState<string[]>([]);
  const [islemYapiliyor, setIslemYapiliyor] = useState(false);
  const [kopyalandiKod, setKopyalandiKod] = useState<string | null>(null);

  const isUtt = ["utt", "kd_utt"].includes(kullaniciRol);
  const isBm = ["bm", "bolge_muduru"].includes(kullaniciRol);
  const isAdmin = ["admin", "superadmin"].includes(kullaniciRol);

  // Aksiyon verilebilecek talepler
  const aksiyonUygunTalepler = useMemo(() => {
    return data.siparisler.filter((s) => {
      if (!s.talep_id) return false;
      if (isUtt && s.durum === "beklemede") return true;
      if (isBm && s.durum === "bm_onayinda") return true;
      if (isAdmin && (s.durum === "beklemede" || s.durum === "bm_onayinda")) return true;
      return false;
    });
  }, [data.siparisler, isUtt, isBm, isAdmin]);

  const tumunuSec = () => {
    if (seciliTalepler.length === aksiyonUygunTalepler.length) {
      setSeciliTalepler([]);
    } else {
      setSeciliTalepler(aksiyonUygunTalepler.map((s) => s.talep_id!));
    }
  };

  const secimDegistir = (talepId: string) => {
    setSeciliTalepler((prev) =>
      prev.includes(talepId) ? prev.filter((id) => id !== talepId) : [...prev, talepId]
    );
  };

  const topluOnayCalistir = async (action: "bm_onayina_gonder" | "bm_onayla") => {
    if (seciliTalepler.length === 0) return;
    setIslemYapiliyor(true);
    try {
      const res = await fetch("/eclub/siparisler/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, talep_idler: seciliTalepler }),
      });
      const d = await res.json();
      if (!res.ok) {
        alert(d.hata ?? "İşlem sırasında hata oluştu.");
        return;
      }
      alert(d.mesaj ?? "İşlem başarıyla tamamlandı.");
      setSeciliTalepler([]);
      onIslemTamamlandi();
    } catch (err) {
      alert("Bağlantı hatası oluştu.");
    } finally {
      setIslemYapiliyor(false);
    }
  };

  const kodKopyala = (kod: string) => {
    navigator.clipboard.writeText(kod);
    setKopyalandiKod(kod);
    setTimeout(() => setKopyalandiKod(null), 2000);
  };

  const th = "whitespace-nowrap border-b border-[#e7edf4] bg-[#f7f9fc] px-3 py-2.5 text-left text-[9px] font-extrabold uppercase tracking-[0.06em] text-[#71859d]";
  const td = "border-b border-[#edf1f5] px-3 py-3 align-middle text-xs text-[#40556d]";

  return (
    <section className="overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_7px_22px_rgba(31,55,90,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7edf4] px-4 py-3.5">
        <div>
          <h2 className="text-sm font-extrabold text-[#203653]">E‑Club Sipariş & Çek Talepleri</h2>
          <p className="mt-0.5 text-[11px] font-semibold text-[#8190a3]">
            {yukleniyor ? "Yükleniyor..." : `${data.siparisler.length} / ${data.toplam} kayıt gösteriliyor`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* UTT Aksiyonu: BM Onayına Gönder */}
          {(isUtt || isAdmin) && (
            <button
              type="button"
              disabled={seciliTalepler.length === 0 || islemYapiliyor}
              onClick={() => topluOnayCalistir("bm_onayina_gonder")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={13} />
              BM Onayına Gönder {seciliTalepler.length > 0 ? `(${seciliTalepler.length})` : ""}
            </button>
          )}

          {/* BM Aksiyonu: Onayla */}
          {(isBm || isAdmin) && (
            <button
              type="button"
              disabled={seciliTalepler.length === 0 || islemYapiliyor}
              onClick={() => topluOnayCalistir("bm_onayla")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ShieldCheck size={14} />
              Seçilenleri Onayla {seciliTalepler.length > 0 ? `(${seciliTalepler.length})` : ""}
            </button>
          )}

          <span className="rounded-xl bg-[#f3f7fb] px-3 py-1.5 text-xs font-extrabold text-[#45627f]">
            Toplam {data.toplam}
          </span>
        </div>
      </div>

      {yukleniyor ? (
        <div className="px-4 py-14 text-center text-sm font-semibold text-[#8190a3]">Yükleniyor...</div>
      ) : data.siparisler.length === 0 ? (
        <div className="px-4 py-14 text-center">
          <Package className="mx-auto h-7 w-7 text-[#b7c4d1]" />
          <p className="mt-2 text-sm font-bold text-[#61748b]">Bu kapsam ve filtrelerde sipariş veya çek talebi bulunmuyor.</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {aksiyonUygunTalepler.length > 0 && (
                    <th className={`${th} w-8`}>
                      <input
                        type="checkbox"
                        checked={seciliTalepler.length > 0 && seciliTalepler.length === aksiyonUygunTalepler.length}
                        onChange={tumunuSec}
                        className="rounded border-[#cbd5e1] text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                  )}
                  <th className={th}>Tarih</th>
                  <th className={th}>Ürün & Şart</th>
                  <th className={th}>Eczane / Alıcı</th>
                  <th className={`${th} text-right`}>Kullanılan Puan</th>
                  <th className={`${th} text-right`}>Çek Tutarı (TL)</th>
                  <th className={th}>Durum</th>
                  <th className={th}>Çek Kodu / Kargo</th>
                </tr>
              </thead>
              <tbody>
                {data.siparisler.map((siparis) => {
                  const talepId = siparis.talep_id;
                  const secilebilir = Boolean(
                    talepId &&
                    ((isUtt && siparis.durum === "beklemede") ||
                     (isBm && siparis.durum === "bm_onayinda") ||
                     (isAdmin && (siparis.durum === "beklemede" || siparis.durum === "bm_onayinda")))
                  );
                  const isSecili = talepId ? seciliTalepler.includes(talepId) : false;

                  return (
                    <tr key={siparis.siparis_id} className={`transition-colors hover:bg-[#fbfcfe] ${isSecili ? "bg-blue-50/50" : ""}`}>
                      {aksiyonUygunTalepler.length > 0 && (
                        <td className={`${td} w-8`}>
                          {secilebilir && talepId ? (
                            <input
                              type="checkbox"
                              checked={isSecili}
                              onChange={() => secimDegistir(talepId)}
                              className="rounded border-[#cbd5e1] text-blue-600 focus:ring-blue-500"
                            />
                          ) : null}
                        </td>
                      )}
                      <td className={`${td} whitespace-nowrap text-[#71859d]`}>{tarihFormatla(siparis.created_at)}</td>
                      <td className={`${td} min-w-[210px]`}><Urun siparis={siparis} /></td>
                      <td className={`${td} min-w-[190px]`}><Alici siparis={siparis} /></td>
                      <td className={`${td} text-right font-extrabold tabular-nums text-[#40556d]`}>
                        {siparis.siparis_toplam_puan.toLocaleString("tr-TR")}
                      </td>
                      <td className={`${td} text-right font-black tabular-nums text-emerald-700`}>
                        {siparis.talep_edilen_cek_tl ? `${siparis.talep_edilen_cek_tl.toLocaleString("tr-TR")} TL` : "—"}
                      </td>
                      <td className={td}><DurumRozeti durum={siparis.durum} /></td>
                      <td className={`${td} min-w-[150px]`}>
                        {siparis.durum === "cek_kodlari_gonderildi" && siparis.cek_kodu ? (
                          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1">
                            <span className="font-mono text-xs font-bold text-emerald-900">{siparis.cek_kodu}</span>
                            <button
                              type="button"
                              onClick={() => kodKopyala(siparis.cek_kodu!)}
                              title="Kodu Kopyala"
                              className="rounded p-1 text-emerald-700 hover:bg-emerald-100"
                            >
                              {kopyalandiKod === siparis.cek_kodu ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                          </div>
                        ) : siparis.kargo_firmasi ? (
                          <>
                            <div className="font-bold text-[#40556d]">{siparis.kargo_firmasi}</div>
                            <div className="text-[10px] text-[#8190a3]">{siparis.kargo_takip_no || "Takip no bekleniyor"}</div>
                          </>
                        ) : (
                          <span className="text-[#9aa8b8]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobil Görünüm */}
          <div className="divide-y divide-[#e7edf4] lg:hidden">
            {data.siparisler.map((siparis) => {
              const acik = acikSiparis === siparis.siparis_id;
              const talepId = siparis.talep_id;
              const secilebilir = Boolean(
                talepId &&
                ((isUtt && siparis.durum === "beklemede") ||
                 (isBm && siparis.durum === "bm_onayinda") ||
                 (isAdmin && (siparis.durum === "beklemede" || siparis.durum === "bm_onayinda")))
              );
              const isSecili = talepId ? seciliTalepler.includes(talepId) : false;

              return (
                <div key={siparis.siparis_id} className={isSecili ? "bg-blue-50/40" : ""}>
                  <div className="flex items-center gap-2 px-4 py-3">
                    {secilebilir && talepId && (
                      <input
                        type="checkbox"
                        checked={isSecili}
                        onChange={() => secimDegistir(talepId)}
                        className="rounded border-[#cbd5e1] text-blue-600 focus:ring-blue-500"
                      />
                    )}
                    <button
                      type="button"
                      className="grid flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-left"
                      onClick={() => setAcikSiparis(acik ? null : siparis.siparis_id)}
                      aria-expanded={acik}
                    >
                      <div className="min-w-0">
                        <Urun siparis={siparis} />
                        <div className="mt-2 flex flex-wrap items-center gap-2 pl-[50px]">
                          <Alici siparis={siparis} />
                          <DurumRozeti durum={siparis.durum} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <strong className="block whitespace-nowrap text-sm tabular-nums text-emerald-700">
                            {siparis.talep_edilen_cek_tl ? `${siparis.talep_edilen_cek_tl} TL` : `${siparis.siparis_toplam_puan} p`}
                          </strong>
                          <span className="text-[9px] font-bold text-[#8a98aa]">
                            {siparis.talep_id ? "hediye çeki" : "firma puanı"}
                          </span>
                        </div>
                        <ChevronDown size={16} className={`text-[#71859d] transition-transform ${acik ? "rotate-180" : ""}`} />
                      </div>
                    </button>
                  </div>

                  {acik && (
                    <div className="grid gap-3 border-t border-[#edf1f5] bg-[#fbfcfe] px-4 py-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-[#e7edf4] bg-white p-3">
                        <div className="text-[9px] font-extrabold uppercase tracking-[0.06em] text-[#8190a3]">Talep Detayı</div>
                        <div className="mt-1 text-xs font-bold text-[#203653]">{tarihFormatla(siparis.created_at)}</div>
                        <div className="mt-1 text-[11px] text-[#71859d]">
                          Toplam {siparis.siparis_toplam_puan.toLocaleString("tr-TR")} puan
                          {siparis.talep_edilen_cek_tl ? ` · Çek: ${siparis.talep_edilen_cek_tl.toLocaleString("tr-TR")} TL` : ""}
                        </div>
                      </div>
                      {siparis.durum === "cek_kodlari_gonderildi" && siparis.cek_kodu && (
                        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 sm:col-span-2">
                          <div className="text-[9px] font-extrabold uppercase tracking-[0.06em] text-emerald-800">
                            Migros Hediye Çeki Kodu
                          </div>
                          <div className="mt-1.5 flex items-center justify-between">
                            <span className="font-mono text-sm font-black text-emerald-950">{siparis.cek_kodu}</span>
                            <button
                              type="button"
                              onClick={() => kodKopyala(siparis.cek_kodu!)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                            >
                              {kopyalandiKod === siparis.cek_kodu ? <Check size={12} /> : <Copy size={12} />}
                              {kopyalandiKod === siparis.cek_kodu ? "Kopyalandı" : "Kopyala"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {data.siparisler.length < data.toplam && !yukleniyor && (
        <div className="border-t border-[#e7edf4] px-4 py-4 text-center">
          <button
            type="button"
            onClick={dahaFazlaYukle}
            disabled={dahaYukleniyor}
            className="rounded-xl border border-[#d7e1ec] bg-white px-5 py-2 text-xs font-extrabold text-[#45627f] transition hover:bg-[#f6f9fc] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {dahaYukleniyor ? "Yükleniyor..." : "Daha Fazla Göster"}
          </button>
        </div>
      )}
    </section>
  );
}

export default function EclubSiparislerPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const { mesajlar, hata } = useHataMesaji();
  const hataRef = useRef(hata);
  const [filtreler, setFiltreler] = useState<Filtreler>(BOS_FILTRELER);
  const [data, setData] = useState<EclubSiparisSayfaData>(BOS_DATA);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [dahaYukleniyor, setDahaYukleniyor] = useState(false);

  useEffect(() => { hataRef.current = hata; }, [hata]);

  const queryOlustur = useCallback((offset: number) => {
    const params = new URLSearchParams();
    Object.entries(filtreler).forEach(([anahtar, deger]) => { if (deger) params.set(anahtar, deger); });
    params.set("offset", String(offset));
    params.set("limit", String(SAYFA_BOYUTU));
    return params.toString();
  }, [filtreler]);

  const yukle = useCallback(async (sessiz = false) => {
    if (sessiz) setYenileniyor(true);
    else setYukleniyor(true);
    try {
      const response = await fetch(`/eclub/siparisler/api?${queryOlustur(0)}`);
      const sonuc = await response.json();
      if (!response.ok) {
        hataRef.current(sonuc.hata ?? "E-Club siparişleri yüklenemedi.", sonuc.adim, sonuc.detay);
        return;
      }
      setData({
        ...BOS_DATA,
        ...sonuc,
        ozet: { ...BOS_DATA.ozet, ...(sonuc.ozet ?? {}) },
        kapsam: { ...BOS_DATA.kapsam, ...(sonuc.kapsam ?? {}) },
        kapsam_hiyerarsi: sonuc.kapsam_hiyerarsi ?? null,
        utt_ozetleri: sonuc.utt_ozetleri ?? [],
      });
    } catch (error) {
      hataRef.current("E-Club siparişleri yüklenemedi.", "GET /eclub/siparisler/api", String(error));
    } finally {
      if (sessiz) setYenileniyor(false);
      else setYukleniyor(false);
    }
  }, [queryOlustur]);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (!ECLUB_YONETIM_ROLLERI.includes((kullanici.rol ?? "").toLowerCase())) { router.replace("/ana-sayfa"); return; }
    yukle();
  }, [authYukleniyor, kullanici, router, yukle]);

  const dahaFazlaYukle = async () => {
    if (dahaYukleniyor) return;
    setDahaYukleniyor(true);
    try {
      const response = await fetch(`/eclub/siparisler/api?${queryOlustur(data.siparisler.length)}`);
      const sonuc = await response.json();
      if (!response.ok) {
        hataRef.current(sonuc.hata ?? "Daha fazla sipariş yüklenemedi.", sonuc.adim, sonuc.detay);
        return;
      }
      setData((onceki) => ({ ...onceki, siparisler: [...onceki.siparisler, ...(sonuc.siparisler ?? [])] }));
    } catch (error) {
      hataRef.current("Daha fazla sipariş yüklenemedi.", "GET /eclub/siparisler/api", String(error));
    } finally {
      setDahaYukleniyor(false);
    }
  };

  const kisiler = useMemo(
    () => data.kapsam.kisiler.filter((kisi) => !filtreler.eczane_id || kisi.eczane_id === filtreler.eczane_id),
    [data.kapsam.kisiler, filtreler.eczane_id],
  );
  const uttOzetleri = useMemo(() => Object.fromEntries(data.utt_ozetleri.map(({ utt_id, ozet }) => [utt_id, [
    { etiket: "Sipariş", deger: ozet.toplam },
    { etiket: "İşlemde", deger: ozet.islemde },
    { etiket: "Kargoda", deger: ozet.kargoda },
    { etiket: "Teslim", deger: ozet.teslim_edildi },
  ]])), [data.utt_ozetleri]);
  const uttSec = useCallback((uttId: string | null) => {
    setFiltreler((onceki) => ({
      ...onceki,
      utt_id: uttId ?? "",
      eczane_id: "",
      kisi_id: "",
    }));
  }, []);
  const aktifFiltreVar = Object.values(filtreler).some(Boolean);

  const filtreDegistir = (alan: keyof Filtreler, deger: string) => {
    setFiltreler((onceki) => ({ ...onceki, [alan]: deger, ...(alan === "eczane_id" ? { kisi_id: "" } : {}) }));
  };

  // Çek kodları teslim edilmiş kayıt var mı kontrolü (Yönetici bilgilendirmesi)
  const cekKodlariGonderilenAdet = useMemo(() => {
    return data.siparisler.filter((s) => s.durum === "cek_kodlari_gonderildi").length;
  }, [data.siparisler]);

  if (authYukleniyor || !kullanici) {
    return <div className="flex min-h-screen items-center justify-center text-sm font-semibold text-[#71859d]">Yükleniyor...</div>;
  }

  const ozetKartlari = [
    { etiket: "Toplam Talep", deger: data.ozet.toplam, icon: Package, renk: "#237ac8", zemin: "#edf6fd" },
    { etiket: "İşlemde / Onayda", deger: data.ozet.islemde, icon: Clock3, renk: "#7c5ce7", zemin: "#f3f0ff" },
    { etiket: "Kargoda", deger: data.ozet.kargoda, icon: Truck, renk: "#d78022", zemin: "#fff6e8" },
    { etiket: "Teslim / Kod Gönderildi", deger: data.ozet.teslim_edildi, icon: CircleCheckBig, renk: "#16865f", zemin: "#ebf8f2" },
  ];

  return (
    <div className="min-h-screen bg-[#f7f9fc] pb-20 md:pb-0" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div className="fixed right-4 top-20 z-40 flex max-w-sm flex-col gap-2">
        {mesajlar.map((mesaj, index) => <HataMesaji key={index} {...mesaj} />)}
      </div>

      <main className="mx-auto max-w-7xl px-3 py-4 md:px-6 md:py-6">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#3589d8]">E‑Club</div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.03em] text-[#203653]">Siparişler & Çek Talepleri</h1>
            <p className="mt-1 text-xs font-semibold text-[#8190a3]">
              {data.kapsam_hiyerarsi?.gorunum === "utt"
                ? "Eczanelerinizin hediye çeki ve sipariş taleplerini inceleyin, seçerek BM onayına iletin."
                : `${data.kapsam_hiyerarsi?.kapsam_adi ?? "Yetkili kapsam"} içindeki sipariş ve hediye çeki taleplerini onaylayın ve izleyin.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <YenileButonu yenileniyor={yenileniyor} onYenile={() => yukle(true)} disabled={dahaYukleniyor} />
            <div className="flex items-center gap-2 rounded-2xl border border-[#cfe3f4] bg-[#eef7fd] px-4 py-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#16865f]"><Coins size={17} /></span>
              <div>
                <div className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-[#71859d]">Firmamızdan kullanılan</div>
                <div className="text-lg font-black tabular-nums text-[#16865f]">{data.ozet.firma_kullanilan_puan.toLocaleString("tr-TR")} <small className="text-[10px]">puan</small></div>
              </div>
            </div>
          </div>
        </header>

        {/* Bilgilendirme / Toast Banner */}
        {cekKodlariGonderilenAdet > 0 && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <CheckCircle2 size={18} />
              </span>
              <div>
                <h3 className="text-xs font-extrabold text-emerald-950">
                  Çek Kodları Teslim Edildi ({cekKodlariGonderilenAdet} Eczane)
                </h3>
                <p className="mt-0.5 text-[11px] font-semibold text-emerald-800">
                  Admin tarafından onaylanan çek kodları sisteme işlenmiştir. Tabloda yeşil &ldquo;Çek Kodları Gönderildi&rdquo; rozetiyle görüntüleyebilirsiniz.
                </p>
              </div>
            </div>
          </div>
        )}

        <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {ozetKartlari.map((kart) => {
            const Icon = kart.icon;
            return (
              <article key={kart.etiket} className="rounded-2xl border border-[#dfe7f1] bg-white p-3.5 shadow-[0_5px_16px_rgba(31,55,90,0.035)]">
                <div className="flex items-start justify-between gap-2">
                  <div><div className="text-[10px] font-extrabold uppercase tracking-[0.05em] text-[#8190a3]">{kart.etiket}</div><div className="mt-1 text-2xl font-black tabular-nums" style={{ color: kart.renk }}>{kart.deger}</div></div>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ color: kart.renk, background: kart.zemin }}><Icon size={16} /></span>
                </div>
              </article>
            );
          })}
        </section>

        {data.kapsam_hiyerarsi && data.kapsam_hiyerarsi.gorunum !== "utt" && (
          <div className="mb-4">
            <EclubYonetimHiyerarsisi
              kapsam={data.kapsam_hiyerarsi}
              uttOzetleri={uttOzetleri}
              seciliUttId={filtreler.utt_id || null}
              onUttSecimi={uttSec}
              baslik="E‑Club Sipariş Hiyerarşisi"
              aciklama="Takım ve BM satırlarını açın; bir UTT seçerek sipariş listesini daraltın."
            />
          </div>
        )}

        <section className="mb-4 rounded-2xl border border-[#dfe7f1] bg-white p-4 shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><h2 className="text-sm font-extrabold text-[#203653]">Filtreler</h2><p className="mt-0.5 text-[11px] font-semibold text-[#8190a3]">Listeyi eczane, kişi, durum veya sipariş tarihine göre daraltın.</p></div>
            {aktifFiltreVar && (
              <button type="button" onClick={() => setFiltreler(BOS_FILTRELER)} className="inline-flex items-center gap-1.5 rounded-xl border border-[#dfe7f1] px-3 py-1.5 text-[11px] font-extrabold text-[#61748b] hover:bg-[#f6f9fc]"><RotateCcw size={12} /> Temizle</button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="min-w-0"><span className="mb-1 flex items-center gap-1 text-[10px] font-extrabold text-[#71859d]"><Store size={11} /> Eczane</span><select className={selectSinifi} value={filtreler.eczane_id} onChange={(e) => filtreDegistir("eczane_id", e.target.value)}><option value="">Tüm eczaneler</option>{data.kapsam.eczaneler.map((eczane) => <option key={eczane.eczane_id} value={eczane.eczane_id}>{eczane.eczane_adi}</option>)}</select></label>
            <label className="min-w-0"><span className="mb-1 flex items-center gap-1 text-[10px] font-extrabold text-[#71859d]"><UserRound size={11} /> Eczane çalışanı</span><select className={selectSinifi} value={filtreler.kisi_id} onChange={(e) => filtreDegistir("kisi_id", e.target.value)}><option value="">Tüm kişiler</option>{kisiler.map((kisi) => <option key={kisi.kisi_id} value={kisi.kisi_id}>{kisi.ad} {kisi.soyad} · {eclubKisiRolEtiketi(kisi.rol)}</option>)}</select></label>
            <label className="min-w-0"><span className="mb-1 block text-[10px] font-extrabold text-[#71859d]">Durum</span><select className={selectSinifi} value={filtreler.durum} onChange={(e) => filtreDegistir("durum", e.target.value)}><option value="">Tüm durumlar</option>{ECLUB_SIPARIS_DURUMLARI.map((durum) => <option key={durum} value={durum}>{ECLUB_SIPARIS_DURUM_ETIKETLERI[durum]}</option>)}</select></label>
            <label className="min-w-0"><span className="mb-1 flex items-center gap-1 text-[10px] font-extrabold text-[#71859d]"><CalendarRange size={11} /> Başlangıç</span><input type="date" className={selectSinifi} value={filtreler.tarih_baslangic} max={filtreler.tarih_bitis || undefined} onChange={(e) => filtreDegistir("tarih_baslangic", e.target.value)} /></label>
            <label className="min-w-0"><span className="mb-1 flex items-center gap-1 text-[10px] font-extrabold text-[#71859d]"><CalendarRange size={11} /> Bitiş</span><input type="date" className={selectSinifi} value={filtreler.tarih_bitis} min={filtreler.tarih_baslangic || undefined} onChange={(e) => filtreDegistir("tarih_bitis", e.target.value)} /></label>
          </div>
        </section>

        <SiparisListesi
          data={data}
          kullaniciRol={(kullanici.rol ?? "").toLowerCase()}
          yukleniyor={yukleniyor}
          dahaYukleniyor={dahaYukleniyor}
          dahaFazlaYukle={dahaFazlaYukle}
          onIslemTamamlandi={() => yukle(true)}
        />
      </main>
    </div>
  );
}
