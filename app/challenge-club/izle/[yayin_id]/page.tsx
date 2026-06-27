// app/challenge-club/izle/[yayin_id]/page.tsx
//
// CC izleme sayfası. BM rolündeki kullanıcı bir CC yayınını izlemek için bu sayfaya gelir.
// CcVideoOynatici bileşenini sarmalar; yayın bilgisini çeker, BM rol kontrolü yapar.

"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CcVideoOynatici from "@/components/challenge-club/CcVideoOynatici";
import { HataMesajiContainer, 
  useHataMesaji,
} from "@/components/HataMesaji";

interface Yayin {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  ileri_sarma_acik: boolean;
}

export default function CcIzlemePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const yayin_id = params?.yayin_id as string;
  const challenge_id = searchParams?.get("challenge_id") ?? null;

  const [yayin, setYayin] = useState<Yayin | null>(null);
  const [loading, setLoading] = useState(true);
  const [yetkiliMi, setYetkiliMi] = useState<boolean | null>(null);

  const { mesajlar, hata, basari, uyari } = useHataMesaji();

  // Yetki + yayın bilgisi çek
  useEffect(() => {
    const veriCek = async () => {
      const supabase = createClient();

      // Auth
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push("/login");
        return;
      }

      // Rol kontrolü — sadece BM
      const rol = (user.user_metadata?.rol ?? "").toLowerCase();
      if (rol !== "bm") {
        setYetkiliMi(false);
        setLoading(false);
        return;
      }
      setYetkiliMi(true);

      // Yayın bilgisini çek
      const { data, error } = await supabase
        .from("v_yayin_detay")
        .select(
          "yayin_id, urun_adi, teknik_adi, video_url, ileri_sarma_acik, hedef_rol, durum"
        )
        .eq("yayin_id", yayin_id)
        .single();

      if (error || !data) {
        hata("Yayın bulunamadı.", "v_yayin_detay SELECT", error?.message);
        setLoading(false);
        return;
      }

      // Kanal kontrolü — sadece CC yayını
      if (data.hedef_rol !== "bm") {
        hata(
          "Bu yayın Challenge Club kanalı için değil.",
          "kanal kontrolü"
        );
        setLoading(false);
        return;
      }

      if (data.durum !== "yayinda") {
        hata(`Video şu an yayında değil. Durum: ${data.durum}`, "durum kontrolü");
        setLoading(false);
        return;
      }

      setYayin({
        yayin_id: data.yayin_id,
        urun_adi: data.urun_adi,
        teknik_adi: data.teknik_adi,
        video_url: data.video_url,
        ileri_sarma_acik: data.ileri_sarma_acik,
      });
      setLoading(false);
    };

    veriCek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yayin_id]);

  // Loading durumu
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <div className="text-sm text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  // Yetkisiz erişim
  if (yetkiliMi === false) {
    return (
      <div className="max-w-6xl mx-auto px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="text-base font-semibold text-gray-900 mb-2">
            Yetkisiz Erişim
          </div>
          <div className="text-sm text-gray-500">
            Challenge Club yalnızca BM rolündeki kullanıcılar içindir.
          </div>
        </div>
      </div>
    );
  }

  // Yayın bulunamadı
  if (!yayin) {
    return (
      <div className="max-w-6xl mx-auto px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <HataMesajiContainer mesajlar={mesajlar} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
      <HataMesajiContainer mesajlar={mesajlar} />
      <CcVideoOynatici
        key={yayin.yayin_id}
        video={yayin}
        challenge_id={challenge_id}
        onKapat={() => router.push("/challenge-club")}
        onVeriYenile={async () => {}}
        hata={hata}
        basari={basari}
        uyari={uyari}
      />
    </div>
  );
}