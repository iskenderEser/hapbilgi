import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { uretimAraciYetkisiniDogrula } from "@/lib/ogrenmeAraci/yetki";
import { bunnyStorageNesneSil } from "@/lib/ogrenmeAraci/bunnyStorage";
import { uuidGecerliMi } from "@/lib/uretim/rpc";
import type { PodcastTranskriptMetadata } from "@/lib/ogrenmeAraci/tipler";
import { ASGARI_TRANSKRIPT_KARAKTER, AZAMI_TRANSKRIPT_KARAKTER } from "@/lib/ogrenmeAraci/transkriptMetinCikarici";

export async function POST(request: NextRequest, { params }: { params: Promise<{ arac_id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const { arac_id } = await params;
    if (!uuidGecerliMi(arac_id)) return validasyonHatasi("Geçersiz araç kimliği.", ["arac_id"]);

    const db = createAdminClient();
    const rol = await rolCozucu(db, user.id);
    if (!URETICI_ROLLER.includes(rol)) return rolHatasi("Bu işlem yalnızca üretici rollerine açıktır.");

    const body = await request.json();
    const islem = body.islem as "metin_kaydet" | "onayla" | "iptal_et";
    if (!["metin_kaydet", "onayla", "iptal_et"].includes(islem)) {
      return validasyonHatasi("Geçersiz transkript işlemi.", ["islem"]);
    }

    const { data: arac } = await db.from("ogrenme_araclari")
      .select("arac_id, talep_id, arac_turu, kaynak, dosya_yolu, transkript_yolu, metadata, talepler(talep_id, uretici_id, hazir_video, hazir_soru_seti, ogrenme_araci_turu)")
      .eq("arac_id", arac_id)
      .maybeSingle();
    if (!arac || arac.arac_turu !== "podcast") return NextResponse.json({ hata: "Podcast bulunamadı." }, { status: 404 });

    if (arac.kaynak !== "hazir") {
      return NextResponse.json({ hata: "Transkript yönetimi yalnızca hazır podcast akışında kullanılabilir." }, { status: 422 });
    }

    const talepHam = arac.talepler as
      | { talep_id?: string; uretici_id?: string; hazir_video?: boolean; hazir_soru_seti?: boolean; ogrenme_araci_turu?: string }
      | Array<{ talep_id?: string; uretici_id?: string; hazir_video?: boolean; hazir_soru_seti?: boolean; ogrenme_araci_turu?: string }>
      | null;
    const talep = Array.isArray(talepHam) ? talepHam[0] : talepHam;

    if (!talep || talep.ogrenme_araci_turu !== "podcast" || talep.hazir_video !== true) {
      return NextResponse.json({ hata: "Bu işlem yalnızca V2 veya V4 hazır podcast taleplerinde geçerlidir." }, { status: 422 });
    }

    const yetki = await uretimAraciYetkisiniDogrula({ db, talepId: arac.talep_id, kullaniciId: user.id, rol });
    if (!yetki.ok) return NextResponse.json({ hata: yetki.hata }, { status: yetki.status });

    const metadataOnceki = (arac.metadata as Record<string, unknown> | null) ?? {};
    const mevcutTranskript = (metadataOnceki.transkript as Record<string, unknown> | null) ?? {};

    if (islem === "metin_kaydet") {
      const metinHam = typeof body.metin === "string" ? body.metin.trim() : "";
      if (metinHam.length < ASGARI_TRANSKRIPT_KARAKTER || metinHam.length > AZAMI_TRANSKRIPT_KARAKTER) {
        return validasyonHatasi(
          `Transkript metni ${ASGARI_TRANSKRIPT_KARAKTER} ile ${AZAMI_TRANSKRIPT_KARAKTER} karakter arasında olmalıdır.`,
          ["metin"],
        );
      }

      const oncekiKaynak = (mevcutTranskript.kaynak as "manuel" | "ai" | null) ?? null;
      const korunanKaynak = oncekiKaynak === "ai" ? "ai" : "manuel";
      const korunanDurum = oncekiKaynak === "ai" ? "ai_taslak" : "manuel_taslak";

      const yeniTranskript: PodcastTranskriptMetadata = {
        durum: korunanDurum,
        kaynak: korunanKaynak,
        taslak_metin: metinHam,
        onaylanan_metin: null,
        onaylayan_kullanici_id: null,
        onay_tarihi: null,
        son_duzenleme_tarihi: new Date().toISOString(),
        surum: (Number(mevcutTranskript.surum) || 0) + 1,
        bagli_ses_checksum: (metadataOnceki.checksum_sha256 as string | null) ?? null,
        ai_girisim_id: (mevcutTranskript.ai_girisim_id as string | null) ?? null,
        kullanilan_model: (mevcutTranskript.kullanilan_model as string | null) ?? null,
        hata_kodu: null,
      };

      const metadata = {
        ...metadataOnceki,
        transkript_metni: metinHam,
        transkript_metni_dogrulandi: false,
        transkript: yeniTranskript,
      };

      const { error } = await db.from("ogrenme_araclari").update({ metadata }).eq("arac_id", arac_id);
      if (error) return NextResponse.json({ hata: "Transkript taslağı kaydedilemedi." }, { status: 500 });

      return NextResponse.json({ ok: true, transkript: yeniTranskript });
    }

    if (islem === "onayla") {
      const nihaiMetin = typeof body.nihai_metin === "string" && body.nihai_metin.trim().length > 0
        ? body.nihai_metin.trim()
        : (typeof mevcutTranskript.taslak_metin === "string" ? (mevcutTranskript.taslak_metin as string).trim() : "");

      if (nihaiMetin.length < ASGARI_TRANSKRIPT_KARAKTER || nihaiMetin.length > AZAMI_TRANSKRIPT_KARAKTER) {
        return validasyonHatasi(
          `Onaylanacak transkript metni ${ASGARI_TRANSKRIPT_KARAKTER} ile ${AZAMI_TRANSKRIPT_KARAKTER} karakter arasında olmalıdır.`,
          ["nihai_metin"],
        );
      }

      const onayliTranskript: PodcastTranskriptMetadata = {
        durum: "onaylandi",
        kaynak: (mevcutTranskript.kaynak as "manuel" | "ai" | null) ?? "manuel",
        taslak_metin: nihaiMetin,
        onaylanan_metin: nihaiMetin,
        onaylayan_kullanici_id: user.id,
        onay_tarihi: new Date().toISOString(),
        son_duzenleme_tarihi: new Date().toISOString(),
        surum: (Number(mevcutTranskript.surum) || 0) + 1,
        bagli_ses_checksum: (metadataOnceki.checksum_sha256 as string | null) ?? null,
        ai_girisim_id: (mevcutTranskript.ai_girisim_id as string | null) ?? null,
        kullanilan_model: (mevcutTranskript.kullanilan_model as string | null) ?? null,
        hata_kodu: null,
      };

      const metadata = {
        ...metadataOnceki,
        transkript_metni: nihaiMetin,
        transkript_metni_dogrulandi: true,
        transkript: onayliTranskript,
      };

      const { error } = await db.from("ogrenme_araclari").update({ metadata }).eq("arac_id", arac_id);
      if (error) return NextResponse.json({ hata: "Transkript onaylanamadı." }, { status: 500 });

      // Kullanıcı onayladığında bekleyen V2/V4 soru zincirini veya yayın havuzunu aç
      await db.rpc("podcast_transkript_zincir_ac_atomik", {
        p_arac_id: arac_id,
        p_kullanici_id: user.id,
      });

      return NextResponse.json({ ok: true, transkript: onayliTranskript });
    }

    if (islem === "iptal_et") {
      // Varsa fiziksel transkript dosyası silinir veya temizleme kuyruğuna yazılır
      if (arac.transkript_yolu) {
        const silindi = await bunnyStorageNesneSil(arac.transkript_yolu);
        if (!silindi) {
          await db.from("ogrenme_araci_depolama_temizleme_kuyrugu").insert({
            arac_id,
            dosya_yolu: arac.transkript_yolu,
            dosya_rolu: "transkript",
            sebep: "kullanici_transkripti_iptal_etti",
            durum: "bekliyor",
          });
        }
      }

      const iptalTranskript: PodcastTranskriptMetadata = {
        durum: "iptal",
        kaynak: null,
        taslak_metin: null,
        onaylanan_metin: null,
        onaylayan_kullanici_id: null,
        onay_tarihi: null,
        son_duzenleme_tarihi: new Date().toISOString(),
        surum: (Number(mevcutTranskript.surum) || 0) + 1,
        bagli_ses_checksum: null,
        ai_girisim_id: null,
        kullanilan_model: null,
        hata_kodu: null,
      };

      const metadata = {
        ...metadataOnceki,
        transkript_dogrulandi: false,
        transkript_metni: null,
        transkript_metni_dogrulandi: false,
        transkript: iptalTranskript,
      };

      const { error } = await db.from("ogrenme_araclari").update({
        transkript_yolu: null,
        metadata,
      }).eq("arac_id", arac_id);
      if (error) return NextResponse.json({ hata: "Transkript iptal edilemedi." }, { status: 500 });

      // Kuyrukta bekleyen veya işlenen AI girişimi varsa iptal et
      await db.from("ogrenme_araci_transkript_kuyrugu")
        .update({ durum: "iptal", updated_at: new Date().toISOString() })
        .eq("arac_id", arac_id)
        .in("durum", ["bekliyor", "isleniyor"]);

      // Kullanıcı iptal ettiğinde de V2/V4 soru zincirini veya yayın havuzunu aç
      await db.rpc("podcast_transkript_zincir_ac_atomik", {
        p_arac_id: arac_id,
        p_kullanici_id: user.id,
      });

      return NextResponse.json({ ok: true, transkript: iptalTranskript });
    }

    return validasyonHatasi("Bilinmeyen işlem.", ["islem"]);
  } catch (error) {
    return sunucuHatasi(error, "POST /api/ogrenme-araclari/[arac_id]/transkript-yonet");
  }
}
