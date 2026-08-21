"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, RefreshCw, ShieldCheck, X } from "lucide-react";
import { ECLUB_KISI_ROL_ETIKETLERI } from "@/lib/utils/roller";

interface GecisTalebi {
  gecis_id: string;
  eczane_adi: string;
  rol: keyof typeof ECLUB_KISI_ROL_ETIKETLERI;
  ad: string;
  soyad: string;
  durum: "karar_bekliyor" | "puan_kullaniliyor";
  karar: "puan_kullan" | null;
  kullanilabilir_puan: number;
  bekleyen_siparis: number;
  created_at: string;
}

type KritikKarar = "puandan_vazgec" | "puan_kullanimi_tamamlandi" | "reddet";

interface Props {
  hata: (mesaj: string, adim?: string) => void;
  basari: (mesaj: string) => void;
}

const KARAR_METINLERI: Record<KritikKarar, { baslik: string; aciklama: string; buton: string }> = {
  puandan_vazgec: {
    baslik: "Puanlarınızdan vazgeçmek istediğinize emin misiniz?",
    aciklama: "Kullanılabilir puanlarınız geri alınamaz biçimde kapatılır, bekleyen siparişleriniz düşer ve E-Club üyeliğiniz aynı giriş hesabıyla etkinleşir.",
    buton: "Vazgeç ve E-Club'a geç",
  },
  puan_kullanimi_tamamlandi: {
    baslik: "E-Club üyeliğinizi tamamlayın",
    aciklama: "Müşteri kimliğiniz kapanacak ve aynı giriş hesabınız seçilen eczanede E-Club kimliğine geçirilecektir.",
    buton: "Üyeliği tamamla",
  },
  reddet: {
    baslik: "E-Club üyelik talebini reddedin mi?",
    aciklama: "Talep kapanır; müşteri hesabınız, puanlarınız ve siparişleriniz değişmeden kalır.",
    buton: "Talebi reddet",
  },
};

export default function EclubGecisKarti({ hata, basari }: Props) {
  const [talep, setTalep] = useState<GecisTalebi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [isliyor, setIsliyor] = useState(false);
  const [kritikKarar, setKritikKarar] = useState<KritikKarar | null>(null);
  const [sifre, setSifre] = useState("");
  const [vazgecmeOnayi, setVazgecmeOnayi] = useState(false);
  const [modalHatasi, setModalHatasi] = useState("");

  const cek = useCallback(async () => {
    setYukleniyor(true);
    try {
      const response = await fetch("/eczanem/api/eclub-gecisi", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        hata(data.hata ?? "E-Club geçiş bilgisi yüklenemedi.", data.adim);
        return;
      }
      setTalep(data.talep ?? null);
    } catch {
      hata("E-Club geçiş bilgisi yüklenemedi.", "E-Club geçişi");
    } finally {
      setYukleniyor(false);
    }
  }, [hata]);

  useEffect(() => { void cek(); }, [cek]);

  const modalKapat = (zorla = false) => {
    if (isliyor && !zorla) return;
    setKritikKarar(null);
    setSifre("");
    setVazgecmeOnayi(false);
    setModalHatasi("");
  };

  const kararGonder = async (karar: "puan_kullan" | KritikKarar) => {
    if (!talep) return;
    setIsliyor(true);
    setModalHatasi("");
    try {
      const response = await fetch("/eczanem/api/eclub-gecisi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gecis_id: talep.gecis_id,
          karar,
          ...(karar !== "puan_kullan" ? { sifre } : {}),
          ...(karar === "puandan_vazgec" ? { vazgecme_onayi: vazgecmeOnayi } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (karar === "puan_kullan") hata(data.hata ?? "Tercihiniz kaydedilemedi.", data.adim);
        else setModalHatasi(data.hata ?? "Kararınız uygulanamadı.");
        return;
      }
      basari(data.mesaj ?? "Kararınız kaydedildi.");
      if (data.tamamlandi) {
        window.location.assign("/eclub/panel");
        return;
      }
      modalKapat(true);
      await cek();
    } catch {
      if (karar === "puan_kullan") hata("Tercihiniz kaydedilemedi.", "E-Club geçiş kararı");
      else setModalHatasi("Kararınız uygulanamadı; yeniden deneyin.");
    } finally {
      setIsliyor(false);
    }
  };

  if (yukleniyor || !talep) return null;

  const puanBitti = talep.kullanilabilir_puan === 0;
  const siparisBitti = talep.bekleyen_siparis === 0;
  const tamamlanabilir = puanBitti && siparisBitti;
  const rolEtiketi = ECLUB_KISI_ROL_ETIKETLERI[talep.rol] ?? talep.rol;

  return (
    <>
      <section className="mb-4 overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-blue-100 bg-blue-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"><ShieldCheck className="size-5" /></span>
            <div>
              <h2 className="text-sm font-extrabold text-blue-950">E-Club üyelik geçişiniz onayınızı bekliyor</h2>
              <p className="mt-1 text-xs leading-5 text-blue-800">{talep.eczane_adi} · {rolEtiketi}</p>
            </div>
          </div>
          <button type="button" onClick={() => void cek()} disabled={isliyor} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 disabled:opacity-50"><RefreshCw className="size-3.5" /> Güncelle</button>
        </div>

        <div className="p-5">
          <p className="text-sm leading-6 text-gray-700">E-Club üyeliğiniz etkinleşmeden önce mevcut Eczanem puanlarınız için karar vermeniz gerekiyor. Geçiş tamamlanana kadar yeni puan kazanımı ve yeni eczane bağlantısı yapılmaz.</p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3"><span className="block text-[10px] font-bold uppercase tracking-wide text-gray-500">Kullanılabilir puan</span><strong className="mt-1 block text-xl text-gray-900">{talep.kullanilabilir_puan.toLocaleString("tr-TR")}</strong></div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3"><span className="block text-[10px] font-bold uppercase tracking-wide text-gray-500">Onay bekleyen sipariş</span><strong className="mt-1 block text-xl text-gray-900">{talep.bekleyen_siparis}</strong></div>
          </div>

          {talep.durum === "karar_bekliyor" ? (
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {tamamlanabilir ? (
                <button type="button" onClick={() => setKritikKarar("puan_kullanimi_tamamlandi")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-blue-700"><BadgeCheck className="size-4" /> E-Club üyeliğimi onayla</button>
              ) : (
                <button type="button" disabled={isliyor} onClick={() => void kararGonder("puan_kullan")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-50"><ArrowRight className="size-4" /> Puanlarımı kullanacağım</button>
              )}
              {!puanBitti && <button type="button" onClick={() => setKritikKarar("puandan_vazgec")} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-extrabold text-amber-900 hover:bg-amber-100">Puanlarımdan vazgeçeceğim</button>}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="text-sm font-extrabold text-emerald-900">Puan kullanımı tercihiniz kayıtlı</h3>
              <p className="mt-1 text-xs leading-5 text-emerald-800">{!puanBitti ? "Aşağıdaki İndirim Kullan alanından puanlarınızı siparişe dönüştürün." : !siparisBitti ? "Siparişlerinizin eczane tarafından sonuçlandırılmasını bekleyin." : "Puan ve sipariş süreci tamamlandı; E-Club üyeliğinizi etkinleştirebilirsiniz."}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tamamlanabilir && <button type="button" onClick={() => setKritikKarar("puan_kullanimi_tamamlandi")} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-emerald-800">E-Club üyeliğini tamamla</button>}
                {!puanBitti && <button type="button" onClick={() => setKritikKarar("puandan_vazgec")} className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-xs font-extrabold text-amber-900">Kalan puanlarımdan vazgeç</button>}
              </div>
            </div>
          )}

          <button type="button" onClick={() => setKritikKarar("reddet")} className="mt-4 text-xs font-bold text-gray-500 underline-offset-2 hover:text-red-700 hover:underline">Bu E-Club üyelik talebini reddet</button>
        </div>
      </section>

      {kritikKarar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4" role="dialog" aria-modal="true" aria-labelledby="eclub-gecis-modal-baslik">
          <form onSubmit={(event) => { event.preventDefault(); void kararGonder(kritikKarar); }} className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button type="button" onClick={() => modalKapat()} disabled={isliyor} aria-label="Kapat" className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X className="size-5" /></button>
            <h2 id="eclub-gecis-modal-baslik" className="pr-8 text-lg font-extrabold text-gray-900">{KARAR_METINLERI[kritikKarar].baslik}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">{KARAR_METINLERI[kritikKarar].aciklama}</p>

            {kritikKarar === "puandan_vazgec" && (
              <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
                <input type="checkbox" checked={vazgecmeOnayi} onChange={(event) => setVazgecmeOnayi(event.target.checked)} className="mt-0.5 size-4" />
                <span>Kullanılabilir puanlarımdan geri alınamaz biçimde vazgeçtiğimi ve bekleyen siparişlerimin düşeceğini onaylıyorum.</span>
              </label>
            )}

            <label className="mt-4 block text-xs font-bold text-gray-700" htmlFor="eclub-gecis-sifre">Mevcut şifreniz</label>
            <input id="eclub-gecis-sifre" type="password" value={sifre} onChange={(event) => setSifre(event.target.value)} autoComplete="current-password" required disabled={isliyor} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:bg-gray-100" />
            {modalHatasi && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{modalHatasi}</div>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => modalKapat()} disabled={isliyor} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 disabled:opacity-50">Vazgeç</button>
              <button type="submit" disabled={isliyor || !sifre || (kritikKarar === "puandan_vazgec" && !vazgecmeOnayi)} className={`rounded-xl px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50 ${kritikKarar === "reddet" || kritikKarar === "puandan_vazgec" ? "bg-red-700 hover:bg-red-800" : "bg-blue-700 hover:bg-blue-800"}`}>{isliyor ? "İşleniyor…" : KARAR_METINLERI[kritikKarar].buton}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
