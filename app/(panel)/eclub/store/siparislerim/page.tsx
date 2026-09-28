"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Clock3, Copy, Gift, Store, XCircle } from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  EclubKisiBaslik,
  EclubKisiBosDurum,
  EclubKisiSayfa,
  EclubKisiStat,
  EclubKisiYukleniyor,
} from "@/components/eclub/EclubKisiSayfa";

interface CekTalebi {
  talep_id: string;
  firma_adi: string;
  urun_adi: string;
  talep_eden_kisi_id: string;
  toplanan_puan: number;
  talep_edilen_cek_tl: number;
  siparis_verildi_mi: boolean;
  siparis_adet: number;
  siparis_mal_fazlasi: number;
  durum: string;
  cek_kodu: string | null;
  created_at: string;
}

const DURUM_ETIKET: Record<string, { ad: string; renk: string; bg: string; ikon: typeof Clock3 }> = {
  beklemede: { ad: "UTT Onayı Bekleniyor", renk: "#a66215", bg: "#fff6e8", ikon: Clock3 },
  bm_onayinda: { ad: "BM Onayı Bekleniyor", renk: "#1e40af", bg: "#eff6ff", ikon: Clock3 },
  onaylandi: { ad: "Çek Kodu Bekleniyor", renk: "#065f46", bg: "#ecfdf5", ikon: CheckCircle2 },
  iptal: { ad: "İptal", renk: "#bc4b4b", bg: "#fff0f0", ikon: XCircle },
  cek_kodlari_gonderildi: { ad: "Çek Kodu Gönderildi", renk: "#15803d", bg: "#f0fdf4", ikon: CheckCircle2 },
};

export default function EclubSiparislerimPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();
  const eclubKisi = !!kullanici && kullanici.kimlik_turu === "eclub_kisi";
  const [talepler, setTalepler] = useState<CekTalebi[]>([]);
  const [loading, setLoading] = useState(true);
  const [islemId, setIslemId] = useState<string | null>(null);
  const [kopyalandiKod, setKopyalandiKod] = useState<string | null>(null);

  const kodKopyala = async (kod: string) => {
    await navigator.clipboard.writeText(kod);
    setKopyalandiKod(kod);
    setTimeout(() => setKopyalandiKod(null), 2000);
  };

  const talepleriCek = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/eclub/store/api/siparis");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Çek talepleri yüklenemedi.", data.adim, data.detay); return; }
      setTalepler(data.talepler ?? []);
    } catch (err) {
      hata("Çek talepleri yüklenirken hata oluştu.", "talepleriCek", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [hata]);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (!eclubKisi) { router.replace("/ana-sayfa"); return; }
    void talepleriCek();
  }, [kullanici, authYukleniyor, eclubKisi, router, talepleriCek]);

  const ozet = useMemo(() => ({
    toplam: talepler.length,
    onayda: talepler.filter((talep) => ["beklemede", "bm_onayinda", "onaylandi"].includes(talep.durum)).length,
    teslim: talepler.filter((talep) => talep.durum === "cek_kodlari_gonderildi").length,
    iptal: talepler.filter((talep) => talep.durum === "iptal").length,
  }), [talepler]);

  const talepIptal = async (talepId: string) => {
    setIslemId(talepId);
    try {
      const res = await fetch("/eclub/store/api/siparis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ talep_id: talepId, action: "iptal" }),
      });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Talep iptal edilemedi.", data.adim, data.detay); return; }
      basari(data.mesaj ?? "Çek talebi iptal edildi.");
      await talepleriCek();
    } catch (err) {
      hata("İptal işlemi sırasında hata oluştu.", "talepIptal", err instanceof Error ? err.message : undefined);
    } finally {
      setIslemId(null);
    }
  };

  if (authYukleniyor || !kullanici || loading) return <EclubKisiYukleniyor />;

  return (
    <EclubKisiSayfa>
      <EclubKisiBaslik
        ikon={Gift}
        baslik="Çek Taleplerim"
        aciklama="Hediye çeki taleplerinizi, onay durumlarını ve teslim edilen dijital çek kodlarını takip edin."
        aksiyon={<Link href="/eclub/store" className="inline-flex items-center gap-2 rounded-xl border border-[#cfe3f4] bg-white px-4 py-2.5 text-xs font-extrabold text-[#237ac8] shadow-sm hover:bg-[#f4f9fd]"><Store size={15} /> E-Club Store&apos;a Dön</Link>}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <EclubKisiStat ikon={Gift} etiket="Toplam Talep" deger={ozet.toplam} detay="Tüm çek talepleriniz" />
        <EclubKisiStat ikon={Clock3} etiket="Onay Sürecinde" deger={ozet.onayda} detay="UTT, BM veya kod bekleyen" renk="#a66215" zemin="#fff6e8" />
        <EclubKisiStat ikon={CheckCircle2} etiket="Teslim Edilen" deger={ozet.teslim} detay="Kodu gönderilen çekler" renk="#16865f" zemin="#ebf8f2" />
        <EclubKisiStat ikon={XCircle} etiket="İptal" deger={ozet.iptal} detay="İptal edilen talepler" renk="#bc4b4b" zemin="#fff0f0" />
      </section>

      {talepler.length === 0 ? (
        <EclubKisiBosDurum ikon={Gift} baslik="Henüz çek talebiniz yok" aciklama="Uygun dönemde oluşturduğunuz hediye çeki talepleri burada görüntülenir." />
      ) : (
        <section className="grid gap-3">
          {talepler.map((talep) => {
            const durum = DURUM_ETIKET[talep.durum] ?? { ad: talep.durum, renk: "#71859d", bg: "#f3f6f9", ikon: Clock3 };
            const DurumIcon = durum.ikon;
            const islemSuruyor = islemId === talep.talep_id;
            return (
              <article key={talep.talep_id} className="rounded-2xl border border-[#dfe7f1] bg-white p-4 shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Gift size={26} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-extrabold text-[#203653]">{talep.urun_adi}</h2>
                        <p className="mt-0.5 text-[10px] font-semibold text-[#8a99aa]">{talep.firma_adi} · {new Date(talep.created_at).toLocaleDateString("tr-TR")}</p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold" style={{ color: durum.renk, background: durum.bg }}><DurumIcon size={12} /> {durum.ad}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <div className="rounded-xl bg-[#f5f8fb] px-3 py-2"><small className="block text-[9px] font-bold text-[#8190a3]">Kullanılan Puan</small><strong className="text-xs text-[#40556d]">{talep.toplanan_puan.toLocaleString("tr-TR")}</strong></div>
                      <div className="rounded-xl bg-[#f5f8fb] px-3 py-2"><small className="block text-[9px] font-bold text-[#8190a3]">Çek Tutarı</small><strong className="text-xs text-emerald-700">{talep.talep_edilen_cek_tl.toLocaleString("tr-TR")} TL</strong></div>
                      <div className="col-span-2 rounded-xl bg-[#f5f8fb] px-3 py-2 sm:col-span-1"><small className="block text-[9px] font-bold text-[#8190a3]">Satış Şartı</small><strong className="text-xs text-[#40556d]">{talep.siparis_verildi_mi ? `${talep.siparis_adet} adet + ${talep.siparis_mal_fazlasi} MF` : "Siparişsiz"}</strong></div>
                    </div>
                    {talep.durum === "cek_kodlari_gonderildi" && talep.cek_kodu && (
                      <div className="mt-2.5 rounded-xl border border-emerald-300 bg-emerald-50 p-3">
                        <span className="text-[11px] font-extrabold text-emerald-800">Migros Hediye Çeki Kodunuz</span>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <span className="font-mono text-base font-black tracking-wider text-emerald-950">{talep.cek_kodu}</span>
                          <button type="button" onClick={() => void kodKopyala(talep.cek_kodu!)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-700">
                            {kopyalandiKod === talep.cek_kodu ? <Check size={13} /> : <Copy size={13} />}
                            {kopyalandiKod === talep.cek_kodu ? "Kopyalandı" : "Kopyala"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {talep.durum === "beklemede" && (
                    <button type="button" onClick={() => void talepIptal(talep.talep_id)} disabled={islemSuruyor} className="rounded-xl border border-[#f1cccc] bg-white px-4 py-2 text-xs font-extrabold text-[#bc4b4b] hover:bg-[#fff7f7] disabled:cursor-wait disabled:opacity-60">{islemSuruyor ? "İşleniyor..." : "Talebi İptal Et"}</button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
      <HataMesajiContainer mesajlar={mesajlar} />
    </EclubKisiSayfa>
  );
}
