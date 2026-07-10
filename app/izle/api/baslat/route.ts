// app/izle/api/baslat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { oneriPenceresiAcik } from "@/lib/oneri/pencereKontrol";
import { rolCozucu } from "@/lib/utils/rolCozucu";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!["utt", "kd_utt"].includes(rol)) return rolHatasi("Sadece utt ve kd_utt izleyebilir.");

    const body = await request.json();
    const { yayin_id, izleme_turu, oneri_id } = body;

    if (!yayin_id) return validasyonHatasi("yayin_id zorunludur.", ["yayin_id"]);
    if (!izleme_turu || !["kendi_kendine", "oneri"].includes(izleme_turu)) {
      return validasyonHatasi("izleme_turu kendi_kendine veya oneri olmalıdır.", ["izleme_turu"]);
    }

    // İzleme türü 'oneri' ise oneri_id zorunlu ve geçerli olmalı
    if (izleme_turu === "oneri") {
      if (!oneri_id) return validasyonHatasi("oneri türü için oneri_id zorunludur.", ["oneri_id"]);

      const { data: oneri, error: oneriError } = await adminSupabase
        .from("oneri_kayitlari")
        .select("oneri_id, yayin_id, kullanici_id, oneri_baslangic, oneri_bitis, izlendi_mi")
        .eq("oneri_id", oneri_id)
        .single();

      const oneriKontrol = veriKontrol(oneri, "oneri_kayitlari tablosu SELECT — oneri_id kontrolü", "Öneri bulunamadı.");
      if (!oneriKontrol.gecerli) return oneriKontrol.yanit;
      if (oneriError) return hataYaniti("Öneri sorgulanırken hata oluştu.", "oneri_kayitlari tablosu SELECT", oneriError, 404);

      if (oneri.kullanici_id !== user.id) return rolHatasi("Bu öneri size ait değil.");
      if (oneri.yayin_id !== yayin_id) return isKuraluHatasi("Öneri ile yayin_id eşleşmiyor.");

      const pencere = oneriPenceresiAcik(oneri.oneri_baslangic, oneri.oneri_bitis);
      if (!pencere.acik) {
        if (pencere.sebep === "henuz_baslamadi") return isKuraluHatasi("Önerinin izleme penceresi henüz başlamadı.");
        return isKuraluHatasi("Önerinin izleme penceresi sona erdi.");
      }
    }

    const { data: yayin, error: yayinError } = await adminSupabase
      .from("yayin_yonetimi")
      .select("yayin_id, durum")
      .eq("yayin_id", yayin_id)
      .single();

    const yayinKontrol = veriKontrol(yayin, "yayin_yonetimi tablosu SELECT — yayin_id kontrolü", "Yayın bulunamadı.");
    if (!yayinKontrol.gecerli) return yayinKontrol.yanit;
    if (yayinError) return hataYaniti("Yayın sorgulanırken hata oluştu.", "yayin_yonetimi tablosu SELECT", yayinError, 404);
    if (yayin.durum !== "yayinda") return isKuraluHatasi(`Video şu an yayında değil. Mevcut durum: ${yayin.durum}`);

    const insertVeri: any = {
      yayin_id,
      kullanici_id: user.id,
      izleme_turu,
      tamamlandi_mi: false,
      izleme_baslangic: new Date().toISOString(),
    };
    if (izleme_turu === "oneri") {
      insertVeri.oneri_id = oneri_id;
    }

    const { data: yeniIzleme, error: izlemeError } = await adminSupabase
      .from("izleme_kayitlari")
      .insert(insertVeri)
      .select("izleme_id, yayin_id, izleme_turu, oneri_id, izleme_baslangic")
      .single();

    if (izlemeError) return hataYaniti("İzleme başlatılamadı.", "izleme_kayitlari tablosu INSERT", izlemeError);

    const izlemeKontrol = veriKontrol(yeniIzleme, "izleme_kayitlari tablosu INSERT — dönen veri", "İzleme başlatıldı ancak veri döndürülemedi.");
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;

    return NextResponse.json({ mesaj: "İzleme başlatıldı.", izleme: yeniIzleme }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /izle/api/baslat");
  }
}