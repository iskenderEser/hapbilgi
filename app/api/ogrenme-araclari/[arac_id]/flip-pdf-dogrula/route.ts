import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { iuOgrenmeAraciGorevYetkisiniDogrula, uretimAraciYetkisiniDogrula } from "@/lib/ogrenmeAraci/yetki";
import { bunnyStorageNesneIndir } from "@/lib/ogrenmeAraci/bunnyStorage";
import { uuidGecerliMi, uretimRpcHataYaniti } from "@/lib/uretim/rpc";
import { pdfMetadatasiniBaytlardanCikar } from "@/lib/ogrenmeAraci/pdfMetadata";

export async function POST(request: NextRequest, { params }: { params: Promise<{ arac_id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return yetkiHatasi();
    const { arac_id } = await params;
    const body = await request.json();
    if (!uuidGecerliMi(arac_id) || !uuidGecerliMi(body.islem_anahtari)) return validasyonHatasi("Araç veya işlem anahtarı geçersiz.", ["arac_id", "islem_anahtari"]);
    if (body.gorev_id != null && !uuidGecerliMi(body.gorev_id)) return validasyonHatasi("Görev kimliği geçersiz.", ["gorev_id"]);
    const db = createAdminClient();
    const { data: arac } = await db.from("ogrenme_araclari").select("talep_id, arac_turu, kaynak, dosya_yolu, kapak_yolu, metadata").eq("arac_id", arac_id).maybeSingle();
    if (!arac || arac.arac_turu !== "flip_pdf" || !arac.dosya_yolu) return NextResponse.json({ hata: "Literatür bulunamadı." }, { status: 404 });
    const rol = await rolCozucu(db, user.id);
    const yetki = await uretimAraciYetkisiniDogrula({ db, talepId: arac.talep_id, kullaniciId: user.id, rol });
    if (!yetki.ok) return NextResponse.json({ hata: yetki.hata }, { status: yetki.status });
    if (arac.kaynak === "iu") {
      const gorevYetkisi = await iuOgrenmeAraciGorevYetkisiniDogrula({
        db, gorevId: body.gorev_id, talepId: arac.talep_id, kullaniciId: user.id, aracId: arac_id,
      });
      if (!gorevYetkisi.ok) return NextResponse.json({ hata: gorevYetkisi.hata }, { status: gorevYetkisi.status });
    }

    const oncekiMetadata = (arac.metadata as Record<string, unknown> | null) ?? {};
    const bekleyenDestek = (oncekiMetadata.bekleyen_destek_yollari as Record<string, unknown> | null) ?? {};
    const kapakIptalEdildi = Boolean(oncekiMetadata.kapak_iptal_edildi);
    const kapakBekleniyor = Boolean(oncekiMetadata.kapak_bekleniyor);
    const bekleyenKapakVar = Boolean(bekleyenDestek.kapak);
    const kapakDogrulandi = Boolean(oncekiMetadata.kapak_dogrulandi);

    if (!kapakIptalEdildi) {
      if (kapakBekleniyor || bekleyenKapakVar) {
        return NextResponse.json({ hata: "Bekleyen yayın görseli yüklemesi tamamlanmadan Literatür tamamlanamaz." }, { status: 422 });
      }
      if (arac.kapak_yolu && !kapakDogrulandi) {
        return NextResponse.json({ hata: "Yayın görseli doğrulanmadan Literatür tamamlanamaz." }, { status: 422 });
      }
    }

    const depolama = (oncekiMetadata.depolama_dogrulamasi as Record<string, unknown> | null) ?? {};
    if (!depolama.tamamlanma_tarihi) return NextResponse.json({ hata: "PDF depolama doğrulaması tamamlanmamış." }, { status: 422 });
    const pdfBaytlari = await bunnyStorageNesneIndir(arac.dosya_yolu, 75 * 1024 * 1024);
    if (!pdfBaytlari) return NextResponse.json({ hata: "PDF dosyası Storage üzerinden okunamadı." }, { status: 422 });
    let pdfMetadata;
    try {
      pdfMetadata = await pdfMetadatasiniBaytlardanCikar(pdfBaytlari);
    } catch (pdfHatasi) {
      return NextResponse.json({ hata: pdfHatasi instanceof Error ? pdfHatasi.message : "PDF doğrulanamadı." }, { status: 422 });
    }
    const { data: sonuc, error: rpcError } = await db.rpc("uretim_flip_pdf_dogrula", {
      p_arac_id: arac_id,
      p_kullanici_id: user.id,
      p_gorev_id: body.gorev_id ?? null,
      p_sayfa_sayisi: pdfMetadata.sayfaSayisi,
      p_arama_metni: pdfMetadata.aramaMetni,
      p_arama_metni_durumu: pdfMetadata.aramaMetniDurumu,
      p_islem_anahtari: body.islem_anahtari,
    });
    if (rpcError) return uretimRpcHataYaniti("Literatür doğrulanamadı.", "uretim_flip_pdf_dogrula RPC", rpcError);
    return NextResponse.json({
      mesaj: "Literatür üretim zincirine alındı.",
      sonuc,
      uyari: pdfMetadata.aramaMetniDurumu === "tam"
        ? null
        : "PDF geçerli ancak aranabilir metnin tamamı çıkarılamadı.",
    }, { status: 201 });
  } catch (error) { return sunucuHatasi(error, "POST Literatür doğrula"); }
}
