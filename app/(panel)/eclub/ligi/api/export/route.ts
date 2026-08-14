import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { eclubLiginiOlustur, type EclubRaporHamSatir } from "@/lib/eclub/rapor";
import { eclubYonetimKapsaminiGetir } from "@/lib/eclub/yonetimKapsami";
import { eclubLigPeriyoduParse } from "@/lib/eclub/ligPeriyot";
import { ECLUB_LIGI_GOREN_ROLLER } from "@/lib/utils/roller";
import { ligPeriyoduAraligi } from "@/lib/zaman/kontrol";
import { hataYaniti, rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";

const rolEtiketi = (rol: string) => (
  rol === "eczaci" ? "Eczacı" : rol === "eczane_teknisyeni" ? "Eczane Teknisyeni" : rol
);

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad, rol, firma_id, takim_id, bolge_id")
      .eq("kullanici_id", user.id)
      .single();
    if (kullaniciError || !kullanici) {
      return hataYaniti("Kullanıcı bulunamadı.", "kullanicilar SELECT — E-Club Ligi dışa aktarım", kullaniciError, 404);
    }
    if (!ECLUB_LIGI_GOREN_ROLLER.includes((kullanici.rol ?? "").toLowerCase())) {
      return rolHatasi("E-Club Ligi'ni dışa aktarma yetkiniz yok.");
    }

    const periyot = eclubLigPeriyoduParse(request.nextUrl.searchParams);
    if (!periyot) {
      return validasyonHatasi("Geçersiz lig periyodu.", ["periyot", "yil", "ay", "ceyrek", "hafta"]);
    }
    const aralik = ligPeriyoduAraligi(periyot);
    const haricBitis = new Date(new Date(aralik.bitis).getTime() + 1).toISOString();
    const kapsam = await eclubYonetimKapsaminiGetir(adminSupabase, kullanici);
    const sonuclar = await Promise.all(kapsam.uttler.map(async (utt) => ({
      utt,
      sonuc: await adminSupabase.rpc("get_eclub_utt_rapor", {
        p_utt_id: utt.utt_id,
        p_baslangic: aralik.baslangic,
        p_bitis: haricBitis,
      }),
    })));
    const hatali = sonuclar.find(({ sonuc }) => sonuc.error);
    if (hatali?.sonuc.error) {
      return hataYaniti("E-Club Ligi verisi alınamadı.", `get_eclub_utt_rapor RPC — Excel — ${hatali.utt.utt_adi}`, hatali.sonuc.error);
    }

    const ligler = sonuclar.map(({ utt, sonuc }) => ({
      utt,
      lig: eclubLiginiOlustur((sonuc.data ?? []) as EclubRaporHamSatir[]),
    }));
    const siralama: (string | number)[][] = [[
      "Takım", "BM", "Bölge", "UTT", "Sıra", "Ad Soyad", "Rol", "Eczane", "GLN", "Gönderilen", "Tamamlanan",
      "Doğru", "Yanlış", "İzleme Puanı", "Cevaplama Puanı", "Toplam Puan",
    ]];
    const detay: (string | number)[][] = [[
      "Takım", "BM", "Bölge", "UTT", "Sıra", "Ad Soyad", "Eczane", "Ürün / İçerik", "Gönderilen", "Tamamlanan",
      "Doğru", "Yanlış", "İzleme Puanı", "Cevaplama Puanı", "Toplam Puan",
    ]];

    for (const { utt, lig } of ligler) {
      for (const kisi of lig) {
        siralama.push([
          utt.takim_adi, utt.bm_adi, utt.bolge_adi, utt.utt_adi,
          kisi.sira || "", `${kisi.ad} ${kisi.soyad}`.trim(), rolEtiketi(kisi.rol), kisi.eczane_adi,
          kisi.gln ?? "", kisi.gonderilen_sayisi, kisi.tamamlanan_izleme, kisi.dogru_cevap,
          kisi.yanlis_cevap, kisi.izleme_puani, kisi.cevaplama_puani, kisi.toplam_puan,
        ]);
        for (const icerik of kisi.icerikler) {
          detay.push([
            utt.takim_adi, utt.bm_adi, utt.bolge_adi, utt.utt_adi,
            kisi.sira || "", `${kisi.ad} ${kisi.soyad}`.trim(), kisi.eczane_adi, icerik.icerik_adi,
            icerik.gonderilen_sayisi, icerik.tamamlanan_izleme, icerik.dogru_cevap,
            icerik.yanlis_cevap, icerik.izleme_puani, icerik.cevaplama_puani, icerik.toplam_puan,
          ]);
        }
      }
    }

    const workbook = XLSX.utils.book_new();
    const siralamaSheet = XLSX.utils.aoa_to_sheet(siralama);
    const detaySheet = XLSX.utils.aoa_to_sheet(detay);
    siralamaSheet["!cols"] = [
      { wch: 22 }, { wch: 24 }, { wch: 20 }, { wch: 24 },
      { wch: 7 }, { wch: 24 }, { wch: 22 }, { wch: 28 }, { wch: 16 },
      { wch: 12 }, { wch: 12 }, { wch: 9 }, { wch: 9 }, { wch: 14 }, { wch: 17 }, { wch: 13 },
    ];
    detaySheet["!cols"] = [
      { wch: 22 }, { wch: 24 }, { wch: 20 }, { wch: 24 },
      { wch: 7 }, { wch: 24 }, { wch: 28 }, { wch: 28 }, { wch: 12 },
      { wch: 12 }, { wch: 9 }, { wch: 9 }, { wch: 14 }, { wch: 17 }, { wch: 13 },
    ];
    XLSX.utils.book_append_sheet(workbook, siralamaSheet, "Takım Sıralaması");
    XLSX.utils.book_append_sheet(workbook, detaySheet, "İçerik Detayı");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="eclub_ligi_${periyot.yil}.xlsx"`,
      },
    });
  } catch (error) {
    return sunucuHatasi(error, "GET /eclub/ligi/api/export");
  }
}
