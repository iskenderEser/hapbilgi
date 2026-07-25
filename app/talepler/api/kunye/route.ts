// app/talepler/api/kunye/route.ts
//
// TALEP KÜNYESİ — TEK KAPI (25.07, Aşama 2b).
//
// Ekran elindeki kimliği verir, künyeyi alır. Hangi alanların çekileceğini ve
// adın hangi kaynaktan seçileceğini BİLMEZ — o kural lib/utils/talepZinciri.ts'te,
// tek yerde durur.
//
// Neden bu uç var: içeriğin adı iki kaynaktan gelebilir (ürünlü türlerde urunler
// join'i, ürünsüz türlerde talepler'in serbest alanı). Bu kural 13 ekranda ayrı
// ayrı kopyalanmıştı; dördünde yanlış kopyalandı ve ürünsüz eğitimlerde ekranlara,
// bildirim metinlerine, Bunny video başlığına "-" yazıldı. Tek kapı bu kopyalamayı
// bitirir: ekranın yanlış yapabileceği bir adım kalmaz.
//
// Anahtarlar — biri zorunlu:
//   ?talep_id=          → talep detay, senaryo detay
//   ?senaryo_durum_id=  → video detay
//   ?video_durum_id=    → soru seti detay
//   ?senaryo_id= | ?video_id= | ?soru_seti_id=
//   ?talep_idler=a,b,c  → liste ekranları (tek sorgu, N+1 yok)
//
// Yetki: oturum zorunlu; üretim hattını görebilen roller (üretici + İÜ).
// Görünürlük daraltması RLS'tedir — bu uç künyeyi admin istemcisiyle çözer,
// bu yüzden rol kapısı burada elle tutulur.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { URETIM_HATTI_GORENLER } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import {
  talepBilgisiTalep,
  talepBilgisiSenaryo,
  talepBilgisiSenaryoDurum,
  talepBilgisiVideo,
  talepBilgisiVideoDurum,
  talepBilgisiSoruSeti,
  talepBilgileriCoklu,
} from "@/lib/utils/talepZinciri";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!URETIM_HATTI_GORENLER.includes(rol)) {
      return rolHatasi("Sadece üretim hattını gören roller talep künyesine erişebilir.");
    }

    const sp = request.nextUrl.searchParams;

    // Çoklu: liste ekranları. Tek sorguda döner, sıra çağıranın verdiği sıra değildir.
    const coklu = sp.get("talep_idler");
    if (coklu) {
      const idler = coklu.split(",").map(s => s.trim()).filter(Boolean);
      const kunyeler = await talepBilgileriCoklu(adminSupabase, idler);
      return NextResponse.json({ kunyeler }, { status: 200 });
    }

    // Tekil: ekranın elindeki kimlik hangisiyse o çözücü çalışır.
    const tekil: [string, (id: string) => Promise<any>][] = [
      ["talep_id",         id => talepBilgisiTalep(adminSupabase, id)],
      ["senaryo_durum_id", id => talepBilgisiSenaryoDurum(adminSupabase, id)],
      ["video_durum_id",   id => talepBilgisiVideoDurum(adminSupabase, id)],
      ["senaryo_id",       id => talepBilgisiSenaryo(adminSupabase, id)],
      ["video_id",         id => talepBilgisiVideo(adminSupabase, id)],
      ["soru_seti_id",     id => talepBilgisiSoruSeti(adminSupabase, id)],
    ];

    for (const [anahtar, coz] of tekil) {
      const deger = sp.get(anahtar);
      if (!deger) continue;
      const kunye = await coz(deger);
      // Künye yoksa 404: kayıt silinmiş ya da zincir kopuk. Boş künye döndürmek,
      // ekranda sessizce "-" basılmasına yol açardı — bu ucun varlık sebebi o.
      if (!kunye) return NextResponse.json({ hata: "Talep künyesi bulunamadı." }, { status: 404 });
      return NextResponse.json({ kunye }, { status: 200 });
    }

    return validasyonHatasi(
      "Bir kimlik zorunludur: talep_id, senaryo_durum_id, video_durum_id, senaryo_id, video_id, soru_seti_id ya da talep_idler.",
      ["talep_id"],
    );

  } catch (err) {
    return sunucuHatasi(err, "GET /talepler/api/kunye");
  }
}
