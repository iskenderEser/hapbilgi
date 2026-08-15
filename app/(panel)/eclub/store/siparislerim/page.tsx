"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, Package, ShoppingBag, Store, Truck, XCircle } from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  EclubKisiBaslik,
  EclubKisiBosDurum,
  EclubKisiSayfa,
  EclubKisiStat,
  EclubKisiYukleniyor,
} from "@/components/eclub/EclubKisiSayfa";

interface SiparisUrun { ad: string; gorsel_url: string | null }
interface SiparisSatir {
  siparis_id: string;
  urun_id: string;
  adet: number;
  toplam_puan: number;
  durum: string;
  kargo_firmasi: string | null;
  kargo_takip_no: string | null;
  created_at: string;
  eclub_store_urunler: SiparisUrun | SiparisUrun[] | null;
}

const DURUM_ETIKET: Record<string, { ad: string; renk: string; bg: string; ikon: typeof Clock3 }> = {
  beklemede: { ad: "Beklemede", renk: "#a66215", bg: "#fff6e8", ikon: Clock3 },
  hazirlaniyor: { ad: "Hazırlanıyor", renk: "#237ac8", bg: "#edf6fd", ikon: Package },
  kargoda: { ad: "Kargoda", renk: "#7358c7", bg: "#f2efff", ikon: Truck },
  teslim_edildi: { ad: "Teslim Edildi", renk: "#16865f", bg: "#ebf8f2", ikon: CheckCircle2 },
  iptal: { ad: "İptal", renk: "#bc4b4b", bg: "#fff0f0", ikon: XCircle },
};

function urunBilgisi(siparis: SiparisSatir): SiparisUrun {
  const urun = Array.isArray(siparis.eclub_store_urunler) ? siparis.eclub_store_urunler[0] : siparis.eclub_store_urunler;
  return urun ?? { ad: "Ürün", gorsel_url: null };
}

export default function EclubSiparislerimPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();
  const eclubKisi = !!kullanici && kullanici.kimlik_turu === "eclub_kisi";
  const [siparisler, setSiparisler] = useState<SiparisSatir[]>([]);
  const [loading, setLoading] = useState(true);
  const [islemId, setIslemId] = useState<string | null>(null);

  const siparisCek = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/eclub/store/api/siparis");
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Siparişler yüklenemedi.", d.adim, d.detay); return; }
      setSiparisler(d.siparisler ?? []);
    } catch (err) {
      hata("Siparişler yüklenirken hata oluştu.", "siparisCek", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [hata]);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (!eclubKisi) { router.replace("/ana-sayfa"); return; }
    void siparisCek();
  }, [kullanici, authYukleniyor, eclubKisi, router, siparisCek]);

  const ozet = useMemo(() => ({
    toplam: siparisler.length,
    islemde: siparisler.filter((s) => s.durum === "beklemede" || s.durum === "hazirlaniyor").length,
    kargoda: siparisler.filter((s) => s.durum === "kargoda").length,
    teslim: siparisler.filter((s) => s.durum === "teslim_edildi").length,
  }), [siparisler]);

  const islem = async (siparis_id: string, action: "iptal" | "teslim_aldim") => {
    setIslemId(siparis_id);
    try {
      const res = await fetch("/eclub/store/api/siparis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siparis_id, action }),
      });
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "İşlem başarısız.", d.adim, d.detay); return; }
      basari(d.mesaj ?? "İşlem tamamlandı.");
      await siparisCek();
    } catch (err) {
      hata("İşlem sırasında hata oluştu.", "siparisIslem", err instanceof Error ? err.message : undefined);
    } finally {
      setIslemId(null);
    }
  };

  if (authYukleniyor || !kullanici || loading) return <EclubKisiYukleniyor />;

  return (
    <EclubKisiSayfa>
      <EclubKisiBaslik
        ikon={ShoppingBag}
        baslik="Siparişlerim"
        aciklama="E‑Club Store siparişlerinizi ve teslimat sürecini tek yerden takip edin."
        aksiyon={<Link href="/eclub/store" className="inline-flex items-center gap-2 rounded-xl border border-[#cfe3f4] bg-white px-4 py-2.5 text-xs font-extrabold text-[#237ac8] shadow-sm hover:bg-[#f4f9fd]"><Store size={15} /> Mağazaya Dön</Link>}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <EclubKisiStat ikon={ShoppingBag} etiket="Toplam Sipariş" deger={ozet.toplam} detay="Tüm siparişleriniz" />
        <EclubKisiStat ikon={Clock3} etiket="İşlemde" deger={ozet.islemde} detay="Bekleyen ve hazırlanan" renk="#a66215" zemin="#fff6e8" />
        <EclubKisiStat ikon={Truck} etiket="Kargoda" deger={ozet.kargoda} detay="Yola çıkan siparişler" renk="#7358c7" zemin="#f2efff" />
        <EclubKisiStat ikon={CheckCircle2} etiket="Teslim Edilen" deger={ozet.teslim} detay="Tamamlanan siparişler" renk="#16865f" zemin="#ebf8f2" />
      </section>

      {siparisler.length === 0 ? (
        <EclubKisiBosDurum ikon={Package} baslik="Henüz siparişiniz yok" aciklama="Kazandığınız puanlarla mağazadan verdiğiniz siparişler burada görüntülenecek." />
      ) : (
        <section className="grid gap-3">
          {siparisler.map((siparis) => {
            const urun = urunBilgisi(siparis);
            const durum = DURUM_ETIKET[siparis.durum] ?? { ad: siparis.durum, renk: "#71859d", bg: "#f3f6f9", ikon: Package };
            const DurumIcon = durum.ikon;
            const islemSuruyor = islemId === siparis.siparis_id;
            return (
              <article key={siparis.siparis_id} className="rounded-2xl border border-[#dfe7f1] bg-white p-3 shadow-[0_6px_18px_rgba(31,55,90,0.035)] md:p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex h-20 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f1f5f8] text-[#9babbc] sm:w-24">
                    {urun.gorsel_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={urun.gorsel_url} alt={urun.ad} className="h-full w-full object-contain p-2" />
                    ) : <Package size={24} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div><h2 className="text-sm font-extrabold text-[#203653]">{urun.ad}</h2><p className="mt-0.5 text-[10px] font-semibold text-[#8a99aa]">{new Date(siparis.created_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })}</p></div>
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold" style={{ color: durum.renk, background: durum.bg }}><DurumIcon size={12} /> {durum.ad}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <div className="rounded-xl bg-[#f5f8fb] px-3 py-2"><small className="block text-[9px] font-bold text-[#8190a3]">Adet</small><strong className="text-xs text-[#40556d]">{siparis.adet}</strong></div>
                      <div className="rounded-xl bg-[#f5f8fb] px-3 py-2"><small className="block text-[9px] font-bold text-[#8190a3]">Toplam</small><strong className="text-xs text-[#7358c7]">{siparis.toplam_puan.toLocaleString("tr-TR")} puan</strong></div>
                      {siparis.kargo_takip_no && <div className="col-span-2 rounded-xl bg-[#f5f8fb] px-3 py-2 sm:col-span-1"><small className="block text-[9px] font-bold text-[#8190a3]">Kargo Takibi</small><strong className="text-xs text-[#40556d]">{siparis.kargo_firmasi || "Kargo"} · {siparis.kargo_takip_no}</strong></div>}
                    </div>
                  </div>
                  {(siparis.durum === "beklemede" || siparis.durum === "kargoda") && (
                    <div className="flex shrink-0 sm:justify-end">
                      {siparis.durum === "beklemede" && <button type="button" onClick={() => void islem(siparis.siparis_id, "iptal")} disabled={islemSuruyor} className="rounded-xl border border-[#f1cccc] bg-white px-4 py-2 text-xs font-extrabold text-[#bc4b4b] hover:bg-[#fff7f7] disabled:cursor-wait disabled:opacity-60">{islemSuruyor ? "İşleniyor..." : "İptal Et"}</button>}
                      {siparis.durum === "kargoda" && <button type="button" onClick={() => void islem(siparis.siparis_id, "teslim_aldim")} disabled={islemSuruyor} className="rounded-xl bg-[#16865f] px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-[#11724f] disabled:cursor-wait disabled:opacity-60">{islemSuruyor ? "İşleniyor..." : "Teslim Aldım"}</button>}
                    </div>
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
