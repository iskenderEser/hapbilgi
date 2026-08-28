import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { bunnyNesneBilgisi, yuklemeYetkisiDogrula } from "@/lib/ogrenmeAraci/bunnyStorage";
import { podcastDestekDosyasiDogrula, podcastDestekDosyasiImzasiDogrula, type PodcastDestekDosyasiRolu } from "@/lib/ogrenmeAraci/sozlesme";
import { uretimAraciYetkisiniDogrula } from "@/lib/ogrenmeAraci/yetki";

export async function POST(request: NextRequest, { params }: { params: Promise<{ arac_id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();
    const { arac_id } = await params;
    const body = await request.json();
    const rolDosya = body.dosya_rolu as PodcastDestekDosyasiRolu;
    if (typeof body.dosya_adi !== "string" || typeof body.mime_type !== "string" || typeof body.dosya_boyutu !== "number"
      || typeof body.dosya_yolu !== "string" || typeof body.checksum_sha256 !== "string" || typeof body.yukleme_token !== "string") {
      return validasyonHatasi("Podcast destek dosyası beyanı eksik.", ["dosya_adi", "mime_type", "dosya_boyutu"]);
    }
    const karar = podcastDestekDosyasiDogrula({ rol: rolDosya, dosyaAdi: body.dosya_adi, mimeType: body.mime_type, dosyaBoyutu: body.dosya_boyutu });
    if (!arac_id || !["kapak", "transkript"].includes(rolDosya) || !karar.ok) return validasyonHatasi("Podcast destek dosyası beyanı geçersiz.", ["dosya_rolu"]);
    if (!yuklemeYetkisiDogrula({
      token: body.yukleme_token,
      aracId: arac_id,
      kullaniciId: user.id,
      dosyaYolu: body.dosya_yolu,
      dosyaBoyutu: body.dosya_boyutu,
      mimeType: body.mime_type.toLowerCase(),
      checksumSha256: body.checksum_sha256.toLowerCase(),
    })) return NextResponse.json({ hata: "Destek dosyası yükleme yetkisi geçersiz." }, { status: 401 });

    const db = createAdminClient();
    const { data: arac } = await db.from("ogrenme_araclari").select("arac_id, talep_id, arac_turu, metadata").eq("arac_id", arac_id).maybeSingle();
    if (!arac || arac.arac_turu !== "podcast") return NextResponse.json({ hata: "Podcast öğrenme aracı bulunamadı." }, { status: 404 });
    const rol = await rolCozucu(db, user.id);
    const yetki = await uretimAraciYetkisiniDogrula({ db, talepId: arac.talep_id, kullaniciId: user.id, rol });
    if (!yetki.ok) return NextResponse.json({ hata: yetki.hata }, { status: yetki.status });

    const nesne = await bunnyNesneBilgisi(body.dosya_yolu);
    if (!nesne || nesne.dosyaBoyutu !== body.dosya_boyutu || !podcastDestekDosyasiImzasiDogrula(rolDosya, karar.uzanti, nesne.ilkBaytlar)) {
      return NextResponse.json({ hata: "Podcast destek dosyasının gerçek türü veya boyutu doğrulanamadı." }, { status: 422 });
    }
    if (nesne.checksumSha256 && nesne.checksumSha256 !== body.checksum_sha256.toLowerCase()) return NextResponse.json({ hata: "Podcast destek dosyası özeti eşleşmiyor." }, { status: 422 });

    const kolon = rolDosya === "kapak" ? "kapak_yolu" : "transkript_yolu";
    const metadata = { ...(arac.metadata as Record<string, unknown>), [`${rolDosya}_dogrulandi`]: true };
    const { error } = await db.from("ogrenme_araclari").update({ [kolon]: body.dosya_yolu, metadata }).eq("arac_id", arac_id);
    if (error) return NextResponse.json({ hata: "Podcast destek dosyası kaydedilemedi." }, { status: 500 });
    return NextResponse.json({ arac_id, dosya_rolu: rolDosya, tamamlandi: true });
  } catch (error) {
    return sunucuHatasi(error, "POST podcast destek yükleme tamamla");
  }
}
