// app/api/hapbi/sor/route.ts
//
// Hapbi AI Soru-Cevap ve Walkthrough Yönlendirme API Ucu.

import { NextResponse } from "next/server";
import { HAPBI_SISTEM_ISTEMI, HAPBI_CANLI_TURLAR } from "@/lib/hapbi/hapbiBilgiTabani";

export async function POST(req: Request) {
  try {
    const { soru, pathname } = await req.json();

    if (!soru || typeof soru !== "string") {
      return NextResponse.json({ error: "Soru gereklidir." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Eğer Gemini API anahtarı varsa Gemini ile çağrı yapalım
    if (apiKey) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `${HAPBI_SISTEM_ISTEMI}\n\nKullanıcının o an bulunduğu sayfa: ${pathname ?? "/"}\nKullanıcının Sorusu: ${soru}\n\nLütfen sevimli, doğrudan ve kısa bir yanıt ver. Eğer soru bir sayfa veya aksiyonla ilgiliyse yanıtının sonuna yönlendirme önerisi ekle.`,
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 500,
              },
            }),
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const cevapMetni = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (cevapMetni) {
            // Soruya uygun aksiyon türetelim
            let aksiyon;
            const q = soru.toLowerCase();
            if (q.includes("store") || q.includes("sipariş") || q.includes("hediye") || q.includes("mağaza")) {
              aksiyon = { etiket: "HBStore Turunu Başlat 🎁", turId: "store_tur", url: "/store" };
            } else if (q.includes("lig") || q.includes("puan") || q.includes("sıra") || q.includes("t-club")) {
              aksiyon = { etiket: "Lig Tablosuna Git 🏆", turId: "lig_tur", url: "/hbligi" };
            } else if (q.includes("12 saat") || q.includes("iptal")) {
              aksiyon = { etiket: "Siparişlerime Git 📦", url: "/store/siparislerim" };
            } else if (q.includes("eczane") || q.includes("e-club") || q.includes("danışan") || q.includes("indirim")) {
              aksiyon = { etiket: "E-Club Paneline Git 💊", url: "/eczanem/utt" };
            }

            return NextResponse.json({
              cevap: cevapMetni,
              aksiyon,
            });
          }
        }
      } catch (geminiError) {
        console.error("Gemini API çağrı hatası:", geminiError);
      }
    }

    // Yerel Kural Motoru (Fallback / Çevrimdışı Mod)
    const q = soru.toLowerCase();
    let cevap = "HapBilgi, sağlık ve ilaç sektörünün tüm aktörlerini buluşturan eğitim ve ödül ekosistemidir. 3 dakikalık videoları izleyerek puan toplayabilir, liglerde yarışabilir ve HBStore'dan dilediğin hediyeyi alabilirsin.";
    let aksiyon;

    if (q.includes("store") || q.includes("sipariş") || q.includes("hediye") || q.includes("mağaza") || q.includes("puan harca")) {
      cevap = "HBStore, kazandığın HapPuan'ları harcayabileceğin resmi ödül mağazasıdır. İstediğin ürünü seçip teslimat adresine sipariş verebilirsin. İlk 12 saat içinde siparişini tek tıkla iptal etme hakkın bulunur!";
      aksiyon = { etiket: "HBStore'u Gezdir 🎁", turId: "store_tur", url: "/store" };
    } else if (q.includes("lig") || q.includes("puan") || q.includes("sıra") || q.includes("t-club") || q.includes("kazan")) {
      cevap = "T-Club Ligi'nde her izlediğin video ve tamamladığın görev için haftalık puan kazanırsın. Sıralaman her hafta yenilenir ve takım sıralamanda zirveye tırmanırsın!";
      aksiyon = { etiket: "Ligi Canlı Göster 🏆", turId: "lig_tur", url: "/hbligi" };
    } else if (q.includes("12 saat") || q.includes("iptal")) {
      cevap = "12 Saat Kuralı: HBStore üzerinden verdiğin siparişleri, paketleme ve kargo süreci başlamadan önce ilk 12 saat içinde 'Siparişlerim' sayfasından cezasız iptal edebilirsin.";
      aksiyon = { etiket: "Sipariş Takibine Git 📦", url: "/store/siparislerim" };
    } else if (q.includes("video") || q.includes("izle") || q.includes("eğitim")) {
      cevap = "Ana sayfanda ve 'Videolarım' sekmesinde senin için hazırlanan 3-5 dakikalık hap eğitim videoları yer alır. Her video bitiminde anında puanın cüzdanına eklenir.";
      aksiyon = { etiket: "Videoları Keşfet 🎬", turId: "video_tur", url: "/ana-sayfa" };
    } else if (q.includes("eczane") || q.includes("e-club") || q.includes("danışan") || q.includes("indirim") || q.includes("mutabakat")) {
      cevap = "E-Club; eczacıların ekiplerini eğittiği, danışanlarına avantajlı ürün indirimleri sunduğu ve firmalarla mutabakat sağladığı özel ekosistem alanıdır.";
      aksiyon = { etiket: "E-Club Alanına Git 💊", url: "/eczanem/utt" };
    } else if (q.includes("öneri") || q.includes("tavsiye") || q.includes("konu")) {
      cevap = "Sahada hekimlerden veya eczacılardan aldığın geri bildirimlere göre yeni bir eğitim konusu önermek istersen 'Öneri Takibi' sekmesini kullanabilirsin.";
      aksiyon = { etiket: "Öneri Takibine Git 💡", turId: "oneri_tur", url: "/oneri-takibi" };
    }

    return NextResponse.json({
      cevap,
      aksiyon,
    });
  } catch (error) {
    console.error("Hapbi API hatası:", error);
    return NextResponse.json(
      { error: "İstek işlenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
