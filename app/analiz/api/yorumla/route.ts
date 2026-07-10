// app/analiz/api/yorumla/route.ts
//
// Paylaşımlı AI yorum endpoint'i (rol-aware).
// Kombinasyon + sonuçlar + bağlam → AI yorum metni.
//
// Body: { kategori, degisken_idleri[], sonuclar, baglam }
// Sonuc: { yorum: string, tamamlayici_mi: boolean }

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  hataYaniti,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
  validasyonHatasi,
} from "@/lib/utils/hataIsle";
import { analizRolKategorisi } from "@/lib/utils/roller";
import {
  getKombinasyon,
  getDegiskenAdlari,
  degiskenIdleriSirali,
  type Kategori,
} from "@/lib/analiz/paylasilan/kombinasyonlar";
import {
  promptOlustur,
  type PromptBaglami,
  type Rol,
} from "@/lib/analiz/paylasilan/promptOlustur";
import { aiYorumAl } from "@/lib/utils/aiIstemci";
import { rolCozucu } from "@/lib/utils/rolCozucu";

type Body = {
  kategori?: Kategori;
  degisken_idleri?: string[];
  sonuclar?: Record<string, number>;
  baglam?: Partial<PromptBaglami>;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const rolStr = await rolCozucu(adminSupabase, user.id);
    const kategoriRol = analizRolKategorisi(rolStr);
    if (!kategoriRol) {
      return rolHatasi("Analiz sayfasına erişim yetkiniz yok.");
    }

    const body = (await request.json()) as Body;
    const { kategori, degisken_idleri, sonuclar, baglam } = body;

    if (!kategori || (kategori !== "uretim" && kategori !== "tuketim")) {
      return validasyonHatasi("kategori 'uretim' veya 'tuketim' olmalıdır.", ["kategori"]);
    }
    if (!Array.isArray(degisken_idleri) || degisken_idleri.length === 0) {
      return validasyonHatasi("degisken_idleri en az 1 elemanlı dizi olmalıdır.", ["degisken_idleri"]);
    }
    if (!sonuclar || typeof sonuclar !== "object") {
      return validasyonHatasi("sonuclar nesnesi zorunludur.", ["sonuclar"]);
    }

    const sirali = degiskenIdleriSirali(degisken_idleri);

    let kombinasyon;
    let adlar: Record<string, string>;
    try {
      [kombinasyon, adlar] = await Promise.all([
        getKombinasyon(kategori, sirali),
        getDegiskenAdlari(kategori, sirali),
      ]);
    } catch (err) {
      return hataYaniti(
        "Kombinasyon veya değişken adları çekilirken hata oluştu.",
        "getKombinasyon / getDegiskenAdlari",
        err instanceof Error ? { message: err.message } : { message: String(err) }
      );
    }

    if (!kombinasyon) {
      return validasyonHatasi(
        "Seçilen pill kombinasyonu için DB'de tanım bulunamadı.",
        ["degisken_idleri"]
      );
    }

    // Rol kategorisini AI prompt'a uygun Rol değerine çevir
    const promptRol: Rol =
      kategoriRol === "yonetici" ? "yonetici" :
      kategoriRol === "uretici" ? "uretici" :
      (baglam?.rol === "bm" ? "bm" : "tm"); // tuketici kategorisi BM/TM ayrımı için body baglam.rol kullanır

    const tamBaglam: PromptBaglami = {
      rol: promptRol,
      rol_ad: baglam?.rol_ad,
      scope_aciklama: baglam?.scope_aciklama,
      periyot_etiketi: baglam?.periyot_etiketi,
      urun_adi: baglam?.urun_adi ?? null,
      egitim_turu: baglam?.egitim_turu ?? null,
      takim_adi: baglam?.takim_adi ?? null,
      bolge_adi: baglam?.bolge_adi ?? null,
      utt_adi: baglam?.utt_adi ?? null,
    };

    const prompt = promptOlustur({
      kategori,
      kombinasyon,
      degisken_adlari: adlar,
      sonuclar,
      baglam: tamBaglam,
    });

    let yorum: string;
    try {
      yorum = await aiYorumAl(prompt);
    } catch (err) {
      return hataYaniti(
        "AI yorum servisinden cevap alınamadı.",
        "aiYorumAl",
        err instanceof Error ? { message: err.message } : { message: String(err) }
      );
    }

    return NextResponse.json(
      { yorum, tamamlayici_mi: kombinasyon.tamamlayici_mi },
      { status: 200 }
    );
  } catch (err) {
    return sunucuHatasi(err, "POST /analiz/api/yorumla");
  }
}