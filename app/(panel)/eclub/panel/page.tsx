"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
import { eclubKisiRolEtiketi } from "@/lib/utils/roller";

function videoDurumu(oneri: PanelOneri): "bekleyen" | "tamamlanan" | "suresi_gecmis" {
  if (oneri.izlendi_mi) return "tamamlanan";
  return oneri.oneri_durumu === "suresi_gecmis" ? "suresi_gecmis" : "bekleyen";
}

export default function EclubPanelPage() {
  const router = useRouter();
  const params = useParams<{ firma_id?: string }>();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const { mesajlar, hata, basari, uyari } = useHataMesaji();
  const eclubKisi = !!kullanici && kullanici.kimlik_turu === "eclub_kisi";
  const hazir = !authYukleniyor && eclubKisi;
  const { kisi, oneriler, firmaOzetleri, ozet, loading, veriCek } = useEclubPanel({ hazir, hata });
  const [seciliOneri, setSeciliOneri] = useState<PanelOneri | null>(null);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (!eclubKisi) { router.replace("/ana-sayfa"); }
  }, [kullanici, authYukleniyor, eclubKisi, router]);

  if (authYukleniyor || !kullanici || loading) return <EclubKisiYukleniyor />;

  const rotaFirmaId = params.firma_id ?? null;
  const aktifFirmaId = firmaOzetleri.some((firma) => firma.firma_id === rotaFirmaId)
    ? rotaFirmaId
    : firmaOzetleri[0]?.firma_id ?? null;
  const bekleyen = oneriler.filter((oneri) => videoDurumu(oneri) === "bekleyen").length;
  const tamamlanan = oneriler.filter((oneri) => videoDurumu(oneri) === "tamamlanan").length;

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
          onKapat={() => { setSeciliOneri(null); void veriCek(); }}
          onTamamlandi={veriCek}
          hata={hata}
          basari={basari}
          uyari={uyari}
        />
      ) : (
        <>
          <EclubKisiBaslik
            ikon={Sparkles}
            baslik={`Merhaba${kisi ? `, ${kisi.ad}` : ""}`}
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
            <EclubKisiStat ikon={Trophy} etiket="Net Puan" deger={Math.max(0, ozet.toplam_kazanilan_puan - ozet.ileri_sarma_kaybi).toLocaleString("tr-TR")} detay={`${ozet.dogru_cevap} doğru · ${ozet.ileri_sarma_kaybi} ileri sarma kaybı`} renk="#7358c7" zemin="#f2efff" />
            <EclubKisiStat ikon={Coins} etiket="Kullanılabilir Puan" deger={ozet.harcanabilir_puan.toLocaleString("tr-TR")} detay="E‑Club Store bakiyesi" />
          </section>

          {firmaOzetleri.length === 0 ? (
            <EclubKisiBosDurum ikon={Video} baslik="Firma videosu bulunmuyor" aciklama="Firmanız size video gönderdiğinde burada görüntülenecek." />
          ) : (
            <EclubFirmaVideoKatalogu
              key={aktifFirmaId}
              oneriler={oneriler}
              seciliFirmaId={aktifFirmaId}
              onVideoSec={setSeciliOneri}
            />
          )}
        </>
      )}
      <HataMesajiContainer mesajlar={mesajlar} />
    </EclubKisiSayfa>
  );
}
