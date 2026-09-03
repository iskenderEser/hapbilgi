import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  bunnyStorageNesneYukle,
  yuklemeMakbuzuOlustur,
  yuklemeYetkisiDogrula,
} from "@/lib/ogrenmeAraci/bunnyStorage";
import { validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";

export async function PUT(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") return new NextResponse(null, { status: 404 });

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return yetkiHatasi();

  const aracId = request.headers.get("x-arac-id") ?? "";
  const kullaniciId = request.headers.get("x-kullanici-id") ?? "";
  const dosyaYolu = request.headers.get("x-dosya-yolu") ?? "";
  const dosyaBoyutu = Number(request.headers.get("x-dosya-boyutu"));
  const checksumSha256 = request.headers.get("x-checksum-sha256")?.toLowerCase() ?? "";
  const yuklemeToken = request.headers.get("x-yukleme-token") ?? "";
  const mimeType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
  if (kullaniciId !== user.id || !aracId || !dosyaYolu || !Number.isSafeInteger(dosyaBoyutu) || dosyaBoyutu <= 0) {
    return validasyonHatasi("Local yükleme bağlamı geçersiz.", ["arac_id", "dosya_yolu", "dosya_boyutu"]);
  }
  if (!yuklemeYetkisiDogrula({ token: yuklemeToken, aracId, kullaniciId, dosyaYolu, dosyaBoyutu, mimeType, checksumSha256 })) {
    return NextResponse.json({ hata: "Local yükleme yetkisi geçersiz." }, { status: 401 });
  }

  const govde = new Uint8Array(await request.arrayBuffer());
  if (govde.byteLength !== dosyaBoyutu || createHash("sha256").update(govde).digest("hex") !== checksumSha256) {
    return validasyonHatasi("Local yükleme dosya boyutu veya özeti eşleşmiyor.", ["dosya_boyutu", "checksum_sha256"]);
  }
  if (!await bunnyStorageNesneYukle({ dosyaYolu, mimeType, checksumSha256, govde })) {
    return NextResponse.json({ hata: "Dosya yüklemesi tamamlanamadı." }, { status: 502 });
  }
  const makbuz = yuklemeMakbuzuOlustur({ yuklemeToken, aracId, kullaniciId, dosyaYolu, dosyaBoyutu, mimeType, checksumSha256 });
  if (!makbuz) return NextResponse.json({ hata: "Local yükleme makbuzu üretilemedi." }, { status: 500 });
  return NextResponse.json({ tamamlandi: true, yukleme_makbuzu: makbuz }, { status: 201 });
}
