// lib/video/yayindakiVideolar.ts
// "Yayındaki Videolar" sayfasına özel veri. getAnaSayfaVideolari'den FARKI:
//   - Tür süzgeci YOK: yayındaki her tür gösterilir (ana sayfadaki "kendi türünü
//     görme" dışlaması burada uygulanmaz — amaç "hepsini izleyebilmek"). İK dahil.
//   - Her videoya üreten kişi (ad soyad) + üreten rol + favori/beğeni sayısı eklenir.
// Konum kapsamı KORUNUR: geniş rol → firma takımları; dar rol → yalnız kendi takımı
// (başka firma sızmaz — kapsamGenisMi, gorunurluk.ts).
// Sunucu tarafı (adminSupabase). Yalnız-izleme (puan/soru yok) UI tarafında.

import { SupabaseClient } from "@supabase/supabase-js";
import { AnaSayfaVideo } from "./anaSayfaVideolari";
import { kapsamGenisMi } from "./gorunurluk";

export interface YayindakiVideo extends AnaSayfaVideo {
  ureten_ad_soyad: string;
  ureten_rol: string;
  favori_sayisi: number;
  begeni_sayisi: number;
}

export async function getYayindakiVideolar(
  userId: string,
  rol: string,
  adminSupabase: SupabaseClient
): Promise<YayindakiVideo[]> {
  const { data: kullanici, error: kError } = await adminSupabase
    .from("kullanicilar")
    .select("takim_id, firma_id")
    .eq("kullanici_id", userId)
    .single();
  if (kError || !kullanici) throw new Error("Kullanıcı bilgisi alınamadı.");

  let query = adminSupabase
    .from("v_yayin_detay")
    .select("yayin_id, urun_adi, teknik_adi, video_url, thumbnail_url, video_puani, yayin_tarihi, icerik_turu, takim_id, uretici_id")
    .eq("durum", "yayinda")
    .order("yayin_tarihi", { ascending: false });

  if (kapsamGenisMi(rol)) {
    const { data: takimlar } = await adminSupabase
      .from("takimlar")
      .select("takim_id")
      .eq("firma_id", kullanici.firma_id);
    const takimIdler = (takimlar ?? []).map((t: any) => t.takim_id);
    query = query.in("takim_id", takimIdler.length > 0 ? takimIdler : ["00000000-0000-0000-0000-000000000000"]);
  } else {
    if (!kullanici.takim_id) return [];
    query = query.eq("takim_id", kullanici.takim_id);
  }

  const { data: videolar, error } = await query;
  if (error) throw new Error("Videolar çekilemedi.");
  const satirlar = (videolar ?? []) as any[];
  if (satirlar.length === 0) return [];

  // Üreten kişi/rol — uretici_id seti tek sorguda çözülür (N+1 yok).
  const ureticiIdler = [...new Set(satirlar.map((v) => v.uretici_id).filter(Boolean))];
  const { data: ureticiler } = await adminSupabase
    .from("kullanicilar")
    .select("kullanici_id, ad, soyad, rol")
    .in("kullanici_id", ureticiIdler.length > 0 ? ureticiIdler : ["00000000-0000-0000-0000-000000000000"]);
  const ureticiHarita = new Map<string, any>();
  (ureticiler ?? []).forEach((u: any) => ureticiHarita.set(u.kullanici_id, u));

  // Favori/beğeni sayısı — ilgili yayin_id'ler için toplu çekilip JS'te sayılır.
  const yayinIdler = satirlar.map((v) => v.yayin_id);
  const sayimHarita = async (tablo: string): Promise<Map<string, number>> => {
    const { data } = await adminSupabase.from(tablo).select("yayin_id").in("yayin_id", yayinIdler);
    const harita = new Map<string, number>();
    (data ?? []).forEach((r: any) => harita.set(r.yayin_id, (harita.get(r.yayin_id) ?? 0) + 1));
    return harita;
  };
  const favoriSay = await sayimHarita("video_favoriler");
  const begeniSay = await sayimHarita("video_begeniler");

  return satirlar.map((v) => {
    const u = ureticiHarita.get(v.uretici_id);
    const adSoyad = u ? `${u.ad ?? ""} ${u.soyad ?? ""}`.trim() : "";
    return {
      yayin_id: v.yayin_id,
      urun_adi: v.urun_adi ?? "-",
      teknik_adi: v.teknik_adi ?? "-",
      video_url: v.video_url ?? null,
      thumbnail_url: v.thumbnail_url ?? null,
      video_puani: v.video_puani ?? null,
      yayin_tarihi: v.yayin_tarihi,
      icerik_turu: v.icerik_turu ?? null,
      ileri_sarma_acik: false,
      ureten_ad_soyad: adSoyad || "-",
      ureten_rol: u?.rol ?? "",
      favori_sayisi: favoriSay.get(v.yayin_id) ?? 0,
      begeni_sayisi: begeniSay.get(v.yayin_id) ?? 0,
    };
  });
}
