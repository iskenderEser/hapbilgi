import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { uretimAraciYetkisiniDogrula } from "@/lib/ogrenmeAraci/yetki";
import { uuidGecerliMi } from "@/lib/uretim/rpc";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ arac_id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const { arac_id } = await params;
    if (!uuidGecerliMi(arac_id)) return validasyonHatasi("Geçersiz araç kimliği.", ["arac_id"]);

    const db = createAdminClient();
    const rol = await rolCozucu(db, user.id);
    if (!URETICI_ROLLER.includes(rol)) return rolHatasi("Bu işlem yalnızca üretici rollerine açıktır.");

    const { data: arac } = await db.from("ogrenme_araclari")
      .select("arac_id, talep_id, arac_turu, kaynak, dosya_yolu, metadata, talepler(talep_id, uretici_id, hazir_video, ogrenme_araci_turu)")
      .eq("arac_id", arac_id)
      .maybeSingle();

    if (!arac || arac.arac_turu !== "podcast") return NextResponse.json({ hata: "Podcast bulunamadı." }, { status: 404 });
    if (arac.kaynak !== "hazir") {
      return NextResponse.json({ hata: "AI transkripti yalnızca hazır podcast akışında başlatılabilir." }, { status: 422 });
    }

    const talepHam = arac.talepler as
      | { talep_id?: string; uretici_id?: string; hazir_video?: boolean; ogrenme_araci_turu?: string }
      | Array<{ talep_id?: string; uretici_id?: string; hazir_video?: boolean; ogrenme_araci_turu?: string }>
      | null;
    const talep = Array.isArray(talepHam) ? talepHam[0] : talepHam;

    if (!talep || talep.ogrenme_araci_turu !== "podcast" || talep.hazir_video !== true) {
      return NextResponse.json({ hata: "Bu işlem yalnızca V2 veya V4 hazır podcast taleplerinde geçerlidir." }, { status: 422 });
    }

    const yetki = await uretimAraciYetkisiniDogrula({ db, talepId: arac.talep_id, kullaniciId: user.id, rol });
    if (!yetki.ok) return NextResponse.json({ hata: yetki.hata }, { status: yetki.status });

    if (!arac.dosya_yolu) {
      return NextResponse.json({ hata: "Ses dosyası yüklenmeden AI transkripti başlatılamaz." }, { status: 422 });
    }

    // Konuşmacı ayrımlı podcast AI transkript akışında açıkça GEMINI_MODEL (Flash modeli) kullanılır
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
    const girisimId = crypto.randomUUID();

    // 1. İşi veritabanında kalıcı olarak 'ai_bekliyor' durumuyla kaydet (çift tıklama korumalı)
    const { data: baslatmaSonucu, error: baslatmaHatasi } = await db.rpc("podcast_transkript_ai_baslat_atomik", {
      p_arac_id: arac_id,
      p_kullanici_id: user.id,
      p_girisim_id: girisimId,
      p_model: model,
    });

    if (baslatmaHatasi) {
      return NextResponse.json({ hata: "AI transkript girişimi başlatılamadı." }, { status: 500 });
    }

    const aktifGirisimId = (baslatmaSonucu?.ai_girisim_id as string) || girisimId;

    // 2. Yalnızca development ortamında local worker'ı otomatik başlat (production'da ASLA çalışmaz)
    // Worker başlatma çağrısı transkript işleminin tamamlanmasını beklemez; API kullanıcıya hemen 202 döner
    if (process.env.NODE_ENV === "development") {
      try {
        const { baslatLocalTranskriptWorker } = await import("@/lib/ogrenmeAraci/localTranskriptWorker");
        baslatLocalTranskriptWorker();
      } catch {
        // Local worker başlatma hatası 202 kabul yanıtını engellemez
      }
    }

    // 3. Kullanıcıya derhal 202 Accepted yanıtı dön (iş kalıcı kuyrukta bekler, bağımsız worker/mutabakat tarafından yürütülür)
    return NextResponse.json({
      ok: true,
      durum: (baslatmaSonucu?.durum as string) || "ai_bekliyor",
      ai_girisim_id: aktifGirisimId,
      mesaj: "AI transkript işi kalıcı kuyruğa alındı.",
    }, { status: 202 });
  } catch (error) {
    return sunucuHatasi(error, "POST /api/ogrenme-araclari/[arac_id]/transkript-ai-baslat");
  }
}
