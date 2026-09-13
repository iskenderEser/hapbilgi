// lib/ogrenmeAraci/transkriptKuyrukIsleyici.ts
//
// Kalıcı kuyruktan atomik olarak iş alan, zaman aşımına uğramış lease'leri
// devralan, artan aralıklı kalıcı yeniden deneme (exponential backoff) uygulayan
// ve sonucu yarış korumasıyla kaydeden bağımsız arka plan işleyicisi.
// Kesinlikle bellek içi setTimeout döngüsü içermez.
// API anahtarı, ses baytları veya transkript metni loglanmaz.

import { createAdminClient } from "@/lib/supabase/server";
import { bunnyStorageNesneIndir } from "@/lib/ogrenmeAraci/bunnyStorage";
import { sesTranskriptiOlusturGemini } from "@/lib/ogrenmeAraci/geminiTranscribe";

export interface TranskriptKuyrukIsleyiciSonucu {
  islendi: boolean;
  basarili?: boolean;
  arac_id?: string;
  ai_girisim_id?: string;
  hataKodu?: string;
  mesaj?: string;
}

const KALICI_HATALAR = new Set([
  "GEMINI_API_KEY_EKSIK",
  "SES_DOSYASI_BOS",
  "SES_INDIRILEMEDI",
  "KONUSMACI_AYRIMI_YAPILAMADI",
]);

/**
 * Kalıcı kuyruktan atomik lease ile tek bir işi alır ve işler.
 */
export async function transkriptKuyrukIsle(secenekler?: {
  leaseSaniye?: number;
}): Promise<TranskriptKuyrukIsleyiciSonucu> {
  const db = createAdminClient();
  const leaseSaniye = secenekler?.leaseSaniye ?? 180;

  // 1. Atomik lease ile sıradaki bekleyen (sonraki_deneme_tarihi gelmiş) veya zaman aşımına uğramış işi al
  const { data: hamIs, error: rpcError } = await db.rpc("podcast_transkript_ai_isi_al_atomik", {
    p_lease_saniye: leaseSaniye,
  });

  if (rpcError || !hamIs) {
    return {
      islendi: false,
      mesaj: rpcError ? `Kuyruk okunamadı: ${rpcError.message}` : "Bekleyen iş yok.",
    };
  }

  const is = hamIs as {
    is_id: string;
    arac_id: string;
    talep_id: string;
    dosya_yolu: string;
    ai_girisim_id: string;
    model: string;
    mime_type?: string;
    dosya_adi?: string;
    deneme_sayisi: number;
    max_deneme: number;
  };

  const { arac_id, ai_girisim_id, dosya_yolu, deneme_sayisi } = is;

  try {
    // 2. Ses dosyasını Bunny Storage'dan indir (veritabanında ses saklanmaz)
    const sesBaytlari = await bunnyStorageNesneIndir(dosya_yolu);
    if (!sesBaytlari || sesBaytlari.length === 0) {
      await db.rpc("podcast_transkript_ai_hata_atomik", {
        p_arac_id: arac_id,
        p_girisim_id: ai_girisim_id,
        p_hata_kodu: "SES_INDIRILEMEDI",
      });
      return {
        islendi: true,
        basarili: false,
        arac_id,
        ai_girisim_id,
        hataKodu: "SES_INDIRILEMEDI",
        mesaj: "Ses dosyası indirilemedi.",
      };
    }

    // 3. Eşzamanlılık ve iptal kontrolü: Gemini çağrısını yapmadan önce girişimin hâlâ geçerli olduğunu doğrula
    const { data: guncelArac } = await db
      .from("ogrenme_araclari")
      .select("metadata, mime_type, dosya_yolu")
      .eq("arac_id", arac_id)
      .maybeSingle();

    const transkript = (guncelArac?.metadata as Record<string, unknown> | null)?.transkript as
      | { ai_girisim_id?: string; durum?: string }
      | undefined;

    if (
      !transkript ||
      transkript.ai_girisim_id !== ai_girisim_id ||
      transkript.durum === "iptal" ||
      transkript.durum === "onaylandi"
    ) {
      await db
        .from("ogrenme_araci_transkript_kuyrugu")
        .update({ durum: "iptal", lease_bitis: null, updated_at: new Date().toISOString() })
        .eq("is_id", is.is_id);
      return {
        islendi: true,
        basarili: false,
        arac_id,
        ai_girisim_id,
        mesaj: "Girişim iptal edildiği veya güncel olmadığı için Gemini çağrısı iptal edildi.",
      };
    }

    // 4. Tek bir Gemini çağrısı (kuyruktan ve doğrulanmış metadata'dan gelen gerçek MIME türü ve dosya adı aktarılır)
    // Sabit audio/mp4 ve .m4a kullanılmaz; MP3 ise audio/mpeg ve .mp3, M4A ise audio/mp4 ve .m4a gönderilir.
    const meta = (guncelArac?.metadata as Record<string, unknown> | null) ?? {};
    const beyan = (meta.yukleme_beyani as Record<string, unknown> | null) ?? {};
    const depolamaMime = ((meta.depolama_dogrulamasi as Record<string, unknown> | null)?.mime_turu as Record<string, unknown> | null)?.beyan;

    const mimeType =
      is.mime_type ||
      guncelArac?.mime_type ||
      (typeof depolamaMime === "string" ? depolamaMime : null) ||
      (typeof beyan.mime_type === "string" ? beyan.mime_type : null) ||
      (dosya_yolu.endsWith(".mp3") ? "audio/mpeg" : "audio/mp4");

    const dosyaAdi =
      is.dosya_adi ||
      (typeof beyan.dosya_adi === "string" ? beyan.dosya_adi : null) ||
      dosya_yolu.split("/").pop() ||
      `${arac_id}.${mimeType.includes("mpeg") || mimeType.includes("mp3") ? "mp3" : "m4a"}`;

    const sonuc = await sesTranskriptiOlusturGemini({
      sesBaytlari,
      mimeType,
      dosyaAdi,
      model: is.model,
    });

    // 5. Başarılı ise atomik yarış korumalı tamamlama
    if (sonuc.ok) {
      const tamamlandi = await db.rpc("podcast_transkript_ai_tamamla_atomik", {
        p_arac_id: arac_id,
        p_girisim_id: ai_girisim_id,
        p_metin: sonuc.metin,
      });

      if (!tamamlandi.data) {
        await db
          .from("ogrenme_araci_transkript_kuyrugu")
          .update({ durum: "iptal", lease_bitis: null, updated_at: new Date().toISOString() })
          .eq("is_id", is.is_id);

        return {
          islendi: true,
          basarili: false,
          arac_id,
          ai_girisim_id,
          hataKodu: "GIRISIM_GECERSIZ",
          mesaj: "Eski veya iptal edilmiş girişim sonucu reddedildi.",
        };
      }

      return {
        islendi: true,
        basarili: true,
        arac_id,
        ai_girisim_id,
      };
    }

    // 6. Başarısız ise hata yönetimi: Kalıcı mı yoksa geçici hata mı?
    const hataKodu = sonuc.hataKodu || "GEMINI_TRANSCRIBE_HATASI";

    if (KALICI_HATALAR.has(hataKodu)) {
      // Kalıcı hata durumunda tekrar deneme yapma, doğrudan kalıcı hataya al
      await db.rpc("podcast_transkript_ai_hata_atomik", {
        p_arac_id: arac_id,
        p_girisim_id: ai_girisim_id,
        p_hata_kodu: hataKodu,
      });

      return {
        islendi: true,
        basarili: false,
        arac_id,
        ai_girisim_id,
        hataKodu,
        mesaj: sonuc.detay || "Kalıcı model hatası oluştu.",
      };
    }

    // Geçici hata: veritabanında 'bekliyor' durumuna al, lease'i temizle,
    // sonraki_deneme_tarihi'ni artan aralıkla (30s, 60s, 120s...) ileri ayarla
    const beklemeSaniye = Math.min(30 * Math.pow(2, Math.max(0, deneme_sayisi - 1)), 300);
    await db.rpc("podcast_transkript_ai_gecici_hata_atomik", {
      p_is_id: is.is_id,
      p_hata_kodu: hataKodu,
      p_bekleme_saniye: beklemeSaniye,
    });

    return {
      islendi: true,
      basarili: false,
      arac_id,
      ai_girisim_id,
      hataKodu,
      mesaj: sonuc.detay || "Geçici hata oluştu, sonraki cron döngüsünde tekrar denenecek.",
    };
  } catch {
    // Beklenmeyen hatada kalıcı / geçici durumunu yönet
    await db.rpc("podcast_transkript_ai_gecici_hata_atomik", {
      p_is_id: is.is_id,
      p_hata_kodu: "BEKLENMEYEN_ISLEYICI_HATASI",
      p_bekleme_saniye: 30,
    });

    return {
      islendi: true,
      basarili: false,
      arac_id,
      ai_girisim_id,
      hataKodu: "BEKLENMEYEN_ISLEYICI_HATASI",
    };
  }
}

/**
 * Cron çağrısında süre sınırını aşmadan (örneğin 50 sn) sınırlı sayıda işi sırayla işler.
 */
export async function transkriptKuyrugunuTuket(secenekler?: {
  maxSureMs?: number;
  maxIsSayisi?: number;
  leaseSaniye?: number;
}): Promise<{ islenenAdet: number; sonuclar: TranskriptKuyrukIsleyiciSonucu[] }> {
  const maxSureMs = secenekler?.maxSureMs ?? 50_000;
  const maxIsSayisi = secenekler?.maxIsSayisi ?? 5;
  const leaseSaniye = secenekler?.leaseSaniye ?? 180;

  const baslangic = Date.now();
  let islenenAdet = 0;
  const sonuclar: TranskriptKuyrukIsleyiciSonucu[] = [];

  while (islenenAdet < maxIsSayisi && Date.now() - baslangic < maxSureMs) {
    const sonuc = await transkriptKuyrukIsle({ leaseSaniye });
    if (!sonuc.islendi) {
      // Kuyrukta uygun / sırası gelmiş iş yok
      break;
    }
    islenenAdet += 1;
    sonuclar.push(sonuc);
  }

  return { islenenAdet, sonuclar };
}
