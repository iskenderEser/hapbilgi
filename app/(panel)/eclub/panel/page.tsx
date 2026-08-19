"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Clock3, Coins, ShoppingBag, Sparkles, Trophy, Video } from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  EclubKisiBaslik,
  EclubKisiBosDurum,
  EclubKisiSayfa,
  EclubKisiStat,
  EclubKisiYukleniyor,
} from "@/components/eclub/EclubKisiSayfa";
import { useEclubPanel, type PanelOneri } from "./_hooks/useEclubPanel";
import EclubVideoOynatici from "./_components/EclubVideoOynatici";
import EclubFirmaVideoKatalogu from "./_components/EclubFirmaVideoKatalogu";
import { hbstoreBakiyesiDegistiBildir } from "@/lib/store/olay";
import { eclubKisiRolEtiketi } from "@/lib/utils/roller";

function videoDurumu(oneri: PanelOneri): "bekleyen" | "tamamlanan" | "suresi_gecmis" {
  if (oneri.izlendi_mi) return "tamamlanan";
  return oneri.oneri_durumu === "suresi_gecmis" ? "suresi_gecmis" : "bekleyen";
}

function firmaYonelme(firmaAdi: string): string {
  const kucukAd = firmaAdi.toLocaleLowerCase("tr-TR");
  const sonUnlu = [...kucukAd].reverse().find((harf) => "aeıioöuü".includes(harf));
  const inceMi = !!sonUnlu && "eiöü".includes(sonUnlu);
  const kaynastirma = "aeıioöuü".includes(kucukAd.at(-1) ?? "") ? "y" : "";
  return `${firmaAdi}'${kaynastirma}${inceMi ? "e" : "a"}`;
}

export default function EclubPanelPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams<{ firma_id?: string }>();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const { mesajlar, hata, basari, uyari } = useHataMesaji();
  const eclubKisi = !!kullanici && kullanici.kimlik_turu === "eclub_kisi";
  const hazir = !authYukleniyor && eclubKisi;
  const { kisi, oneriler, firmaOzetleri, ozet, loading, veriCek, etkilesimGuncelle } = useEclubPanel({ hazir, hata });
  const [seciliOneri, setSeciliOneri] = useState<PanelOneri | null>(null);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (!eclubKisi) { router.replace("/ana-sayfa"); }
  }, [kullanici, authYukleniyor, eclubKisi, router]);

  // Açık video adresin kendisinde taşınır (?oneri_id=...). Böylece navbar'daki
  // "Ana Sayfa" parametresiz adrese gittiğinde bu etki videoyu kapatır — aynı
  // rotada takılı kalma sorunu (kullanıcı listeye dönemiyordu) böyle çözülür.
  useEffect(() => {
    const oneriId = searchParams.get("oneri_id");
    if (!oneriId) { setSeciliOneri(null); return; }
    const hedef = oneriler.find((o) => o.oneri_id === oneriId);
    if (hedef) setSeciliOneri(hedef);
  }, [oneriler, searchParams]);

  if (authYukleniyor || !kullanici || loading) return <EclubKisiYukleniyor />;

  const rotaFirmaId = params.firma_id ?? null;
  const aktifFirmaId = firmaOzetleri.some((firma) => firma.firma_id === rotaFirmaId)
    ? rotaFirmaId
    : null;
  const aktifFirmaAdi = firmaOzetleri.find((firma) => firma.firma_id === aktifFirmaId)?.firma_adi ?? null;
  const aktifFirmaOzeti = firmaOzetleri.find((firma) => firma.firma_id === aktifFirmaId) ?? null;
  const karsilamaBasligi = aktifFirmaAdi
    ? `${firmaYonelme(aktifFirmaAdi)} Hoş Geldin${kisi ? ` ${kisi.ad}` : ""}`
    : `Merhaba${kisi ? ` ${kisi.ad}` : ""}`;
  const statOnerileri = aktifFirmaId ? oneriler.filter((oneri) => oneri.firma_id === aktifFirmaId) : oneriler;
  const bekleyen = statOnerileri.filter((oneri) => videoDurumu(oneri) === "bekleyen").length;
  const tamamlanan = statOnerileri.filter((oneri) => videoDurumu(oneri) === "tamamlanan").length;
  const statOzeti = aktifFirmaOzeti
    ? {
        toplam_kazanilan_puan: aktifFirmaOzeti.kazanilan_puan,
        ileri_sarma_kaybi: aktifFirmaOzeti.kaybedilen_puan,
        harcanabilir_puan: aktifFirmaOzeti.harcanabilir_puan,
        dogru_cevap: aktifFirmaOzeti.dogru_cevap,
      }
    : ozet;

  const etkilesimDegistir = async (tur: "begeni" | "favori", yayinId: string) => {
    try {
      const res = await fetch(`/izle/api/${tur}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yayin_id: yayinId }),
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? `${tur === "begeni" ? "Beğeni" : "Favori"} işlemi tamamlanamadı.`, d.adim, d.detay);
        return;
      }
      etkilesimGuncelle(tur, yayinId, tur === "begeni" ? d.begeni_mi === true : d.favori_mi === true);
    } catch (err) {
      hata("Video etkileşimi kaydedilemedi.", `POST /izle/api/${tur}`, err instanceof Error ? err.message : undefined);
    }
  };

  const handleVideoSec = (oneri: PanelOneri) => {
    setSeciliOneri(oneri);
    // Adrese yaz — "Ana Sayfa" parametresiz adrese gidince video kapansın.
    router.push(`${pathname}?oneri_id=${oneri.oneri_id}`, { scroll: false });
  };

  return (
    <EclubKisiSayfa>
      {seciliOneri ? (
        <EclubVideoOynatici
          oneri={{
            oneri_id: seciliOneri.oneri_id,
            yayin_id: seciliOneri.yayin_id,
            urun_adi: seciliOneri.urun_adi,
            teknik_adi: seciliOneri.teknik_adi,
            video_url: seciliOneri.video_url,
          }}
          onKapat={() => { setSeciliOneri(null); router.push(pathname, { scroll: false }); void veriCek(); }}
          onTamamlandi={() => { void veriCek(true); hbstoreBakiyesiDegistiBildir(); }}
          hata={hata}
          basari={basari}
          uyari={uyari}
        />
      ) : (
        <>
          <EclubKisiBaslik
            ikon={Sparkles}
            baslik={karsilamaBasligi}
            aciklama={`${kisi ? eclubKisiRolEtiketi(kisi.rol) : ""} · Firmalarınızın sizin için seçtiği videoları izleyin, soruları yanıtlayın ve puan kazanın.`}
            aksiyon={(
              <Link href="/eclub/store" className="inline-flex items-center gap-2 rounded-xl border border-[#cfe3f4] bg-white px-4 py-2.5 text-xs font-extrabold text-[#237ac8] shadow-sm hover:bg-[#f4f9fd]">
                <ShoppingBag size={15} /> Mağazaya Git
              </Link>
            )}
          />

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <EclubKisiStat ikon={Clock3} etiket="Bekleyen Video" deger={bekleyen} detay="Süresi devam eden" renk="#d78022" zemin="#fff6e8" />
            <EclubKisiStat ikon={CheckCircle2} etiket="Tamamlanan" deger={tamamlanan} detay="İzlediğiniz videolar" renk="#16865f" zemin="#ebf8f2" />
            <EclubKisiStat ikon={Trophy} etiket="Net Puan" deger={Math.max(0, statOzeti.toplam_kazanilan_puan - statOzeti.ileri_sarma_kaybi).toLocaleString("tr-TR")} detay={`${statOzeti.dogru_cevap} doğru · ${statOzeti.ileri_sarma_kaybi} ileri sarma kaybı`} renk="#7358c7" zemin="#f2efff" />
            <EclubKisiStat ikon={Coins} etiket="Kullanılabilir Puan" deger={statOzeti.harcanabilir_puan.toLocaleString("tr-TR")} detay="E‑Club Store bakiyesi" />
          </section>

          {firmaOzetleri.length === 0 ? (
            <EclubKisiBosDurum ikon={Video} baslik="Firma videosu bulunmuyor" aciklama="Firmanız size video gönderdiğinde burada görüntülenecek." />
          ) : (
            <EclubFirmaVideoKatalogu
              key={aktifFirmaId}
              oneriler={oneriler}
              seciliFirmaId={aktifFirmaId}
              seciliFirmaAdi={aktifFirmaAdi}
              onVideoSec={handleVideoSec}
              onBegeni={(yayinId) => void etkilesimDegistir("begeni", yayinId)}
              onFavori={(yayinId) => void etkilesimDegistir("favori", yayinId)}
            />
          )}
        </>
      )}
      <HataMesajiContainer mesajlar={mesajlar} />
    </EclubKisiSayfa>
  );
}
