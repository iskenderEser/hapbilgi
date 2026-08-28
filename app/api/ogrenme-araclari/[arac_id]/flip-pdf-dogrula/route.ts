import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { uretimAraciYetkisiniDogrula } from "@/lib/ogrenmeAraci/yetki";
import { bunnyPdfKuyrukDogrula } from "@/lib/ogrenmeAraci/bunnyStorage";
import { uuidGecerliMi, uretimRpcHataYaniti } from "@/lib/uretim/rpc";

export async function POST(request: NextRequest, { params }: { params: Promise<{ arac_id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return yetkiHatasi();
    const { arac_id } = await params;
    const body = await request.json();
    if (!uuidGecerliMi(arac_id) || !uuidGecerliMi(body.islem_anahtari)) return validasyonHatasi("Araç veya işlem anahtarı geçersiz.", ["arac_id", "islem_anahtari"]);
    if (!Number.isSafeInteger(body.sayfa_sayisi) || body.sayfa_sayisi <= 0) return validasyonHatasi("PDF sayfa sayısı geçersiz.", ["sayfa_sayisi"]);
    if (typeof body.arama_metni !== "string" || body.arama_metni.length > 100000) return validasyonHatasi("PDF arama metni geçersiz.", ["arama_metni"]);
    if (!["tam", "kismi", "metin_yok"].includes(body.arama_metni_durumu)) {
      return validasyonHatasi("PDF metin çıkarma durumu geçersiz.", ["arama_metni_durumu"]);
    }
    if (body.gorev_id != null && !uuidGecerliMi(body.gorev_id)) return validasyonHatasi("Görev kimliği geçersiz.", ["gorev_id"]);
    const db = createAdminClient();
    const { data: arac } = await db.from("ogrenme_araclari").select("talep_id, arac_turu, dosya_yolu").eq("arac_id", arac_id).maybeSingle();
    if (!arac || arac.arac_turu !== "flip_pdf" || !arac.dosya_yolu) return NextResponse.json({ hata: "Flip PDF bulunamadı." }, { status: 404 });
    const rol = await rolCozucu(db, user.id);
    const yetki = await uretimAraciYetkisiniDogrula({ db, talepId: arac.talep_id, kullaniciId: user.id, rol });
    if (!yetki.ok) return NextResponse.json({ hata: yetki.hata }, { status: yetki.status });
    const kuyruk = await bunnyPdfKuyrukDogrula(arac.dosya_yolu);
    if (!kuyruk || kuyruk.sifreli || !kuyruk.eofVar) return NextResponse.json({ hata: kuyruk?.sifreli ? "Şifreli PDF yüklenemez." : "PDF bozuk veya tamamlanmamış." }, { status: 422 });
    const { data: sonuc, error: rpcError } = await db.rpc("uretim_flip_pdf_dogrula", {
      p_arac_id: arac_id,
      p_kullanici_id: user.id,
      p_gorev_id: body.gorev_id ?? null,
      p_sayfa_sayisi: body.sayfa_sayisi,
      p_islem_anahtari: body.islem_anahtari,
    });
    if (rpcError) return uretimRpcHataYaniti("Flip PDF doğrulanamadı.", "uretim_flip_pdf_dogrula RPC", rpcError);
    const { data: guncel } = await db.from("ogrenme_araclari").select("metadata").eq("arac_id", arac_id).maybeSingle();
    const metadata = {
      ...((guncel?.metadata as Record<string, unknown> | null) ?? {}),
      arama_metni: body.arama_metni.trim(),
      arama_metni_durumu: body.arama_metni_durumu,
      arama_metni_dogrulandi: body.arama_metni_durumu === "tam",
    };
    const { error: metadataHatasi } = await db.from("ogrenme_araclari").update({ metadata }).eq("arac_id", arac_id);
    if (metadataHatasi) return NextResponse.json({ hata: "Flip PDF arama metni kaydedilemedi." }, { status: 500 });
    return NextResponse.json({
      mesaj: "Flip PDF üretim zincirine alındı.",
      sonuc,
      uyari: body.arama_metni_durumu === "tam"
        ? null
        : "PDF geçerli ancak aranabilir metnin tamamı çıkarılamadı.",
    }, { status: 201 });
  } catch (error) { return sunucuHatasi(error, "POST Flip PDF doğrula"); }
}
