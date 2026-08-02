// app/talepler-v2/api/detay/route.ts
//
// SEÇİLEN TALEBİN DERİN VERİSİ (docs/talepler_v2_is_plani.md, A-5).
//
// Sol liste hafif kalsın diye ağır veri listeyle birlikte taşınmaz: kullanıcı bir
// talep seçtiğinde yalnız o talebin senaryo metni, video adresi ve soru seti
// buradan tek istekte gelir. Şeridin adım kutuları (A-7) ve aksiyon şeridi (A-8)
// bu yanıttan beslenir.
//
// SAHİPLİK RLS'TE: talep OTURUM istemcisiyle okunur; üretici yalnız kendi talebini
// görebildiği için başkasının talebi 404 döner. Ç-7'nin ("karar yetkisi talebi açan
// üreticidedir") bu uçtaki karşılığı budur — elle uretici_id karşılaştırması yok.
//
// REVİZYON SAYISI DURUM GEÇMİŞİNDEN sayılır, son duruma bakılmaz: İÜ yeniden
// teslim edince son durum "inceleme bekleniyor"a döner ve revizyon izi kaybolur
// (26.07'de üç sayfada düzeltilen hata). A-8'deki revizyon tavanı bu sayıya bakar.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";

const REVIZYON = "revizyon bekleniyor";

interface DurumSatiri {
  durum: string;
  notlar: string | null;
  created_at: string;
}

/** Bir kaydın durum geçmişinden son durumu, revizyon turu sayısını ve notlarını çıkarır. */
function durumOzeti(gecmis: DurumSatiri[]) {
  // Geçmiş eskiden yeniye gelir; son eleman en güncel durumdur.
  const son = gecmis.length > 0 ? gecmis[gecmis.length - 1] : null;
  return {
    son_durum: son?.durum ?? null,
    son_durum_tarihi: son?.created_at ?? null,
    revizyon_sayisi: gecmis.filter((d) => d.durum === REVIZYON).length,
    notlar: gecmis
      .filter((d) => d.durum === REVIZYON && d.notlar)
      .map((d) => ({ notlar: d.notlar as string, created_at: d.created_at })),
  };
}

/** Kayıt kimliği → o kaydın durum geçmişi. Tek .in() sorgusundan dağıtılır. */
function gecmisHaritasi(satirlar: any[] | null, anahtar: string): Map<string, DurumSatiri[]> {
  const harita = new Map<string, DurumSatiri[]>();
  for (const s of satirlar ?? []) {
    const id = s[anahtar] as string;
    const liste = harita.get(id) ?? [];
    liste.push({ durum: s.durum, notlar: s.notlar ?? null, created_at: s.created_at });
    harita.set(id, liste);
  }
  return harita;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!URETICI_ROLLER.includes(rol)) {
      return rolHatasi("Bu sayfa yalnız üretici rollerine açıktır.");
    }

    const talep_id = request.nextUrl.searchParams.get("talep_id");
    if (!talep_id) return validasyonHatasi("talep_id zorunludur.", ["talep_id"]);

    // Sahiplik kapısı: oturum istemcisiyle okunur, RLS süzer.
    const { data: talep, error: talepError } = await supabase
      .from("talepler")
      .select("talep_id")
      .eq("talep_id", talep_id)
      .maybeSingle();
    if (talepError) return hataYaniti("Talep sorgulanamadı.", "talepler tablosu SELECT — talep_id", talepError);
    if (!talep) return NextResponse.json({ hata: "Talep bulunamadı." }, { status: 404 });

    // ── Senaryo ──────────────────────────────────────────────────────────────
    const { data: senaryolar } = await adminSupabase
      .from("senaryolar")
      .select("senaryo_id, senaryo_metni, iu_id, created_at")
      .eq("talep_id", talep_id)
      .order("created_at", { ascending: true });

    const senaryoIdler = (senaryolar ?? []).map((s: any) => s.senaryo_id);
    const { data: senaryoDurumlari } = senaryoIdler.length
      ? await adminSupabase
          .from("senaryo_durumu")
          .select("senaryo_id, durum, notlar, created_at")
          .in("senaryo_id", senaryoIdler)
          .order("created_at", { ascending: true })
      : { data: [] as any[] };

    const senaryoGecmis = gecmisHaritasi(senaryoDurumlari, "senaryo_id");
    const sonSenaryo = (senaryolar ?? []).at(-1) as any | undefined;
    const oncekiSenaryo = (senaryolar ?? []).length > 1 ? ((senaryolar ?? []).at(-2) as any) : null;

    // Notlar TÜM turlardan toplanır: revizyon notu hangi versiyona bağlı olursa
    // olsun kronolojik tek listede gösterilir (senaryo sayfasının G-5 kararı).
    const senaryoNotlari = senaryoIdler.flatMap((id: string) => durumOzeti(senaryoGecmis.get(id) ?? []).notlar);

    const senaryo = sonSenaryo
      ? {
          id: sonSenaryo.senaryo_id,
          metin: sonSenaryo.senaryo_metni ?? "",
          onceki_metin: oncekiSenaryo?.senaryo_metni ?? null,
          iu_id: sonSenaryo.iu_id ?? null,
          ...durumOzeti(senaryoGecmis.get(sonSenaryo.senaryo_id) ?? []),
          notlar: senaryoNotlari,
        }
      : null;

    // ── Video ────────────────────────────────────────────────────────────────
    // Video talebe DOĞRUDAN bağlı (talep_id) — hazır kolda senaryo yok, zincir
    // yürümek gerekmiyor.
    const { data: videolar } = await adminSupabase
      .from("videolar")
      .select("video_id, video_url, thumbnail_url, iu_id, created_at")
      .eq("talep_id", talep_id)
      .order("created_at", { ascending: true });

    const videoIdler = (videolar ?? []).map((v: any) => v.video_id);
    const { data: videoDurumlari } = videoIdler.length
      ? await adminSupabase
          .from("video_durumu")
          .select("video_id, durum, notlar, created_at")
          .in("video_id", videoIdler)
          .order("created_at", { ascending: true })
      : { data: [] as any[] };

    const videoGecmis = gecmisHaritasi(videoDurumlari, "video_id");
    const sonVideo = (videolar ?? []).at(-1) as any | undefined;

    const video = sonVideo
      ? {
          id: sonVideo.video_id,
          video_url: sonVideo.video_url ?? null,
          thumbnail_url: sonVideo.thumbnail_url ?? null,
          iu_id: sonVideo.iu_id ?? null,
          ...durumOzeti(videoGecmis.get(sonVideo.video_id) ?? []),
        }
      : null;

    // ── Soru seti ────────────────────────────────────────────────────────────
    const { data: setler } = await adminSupabase
      .from("soru_setleri")
      .select("soru_seti_id, sorular, iu_id, created_at")
      .eq("talep_id", talep_id)
      .order("created_at", { ascending: true });

    const setIdler = (setler ?? []).map((s: any) => s.soru_seti_id);
    const { data: setDurumlari } = setIdler.length
      ? await adminSupabase
          .from("soru_seti_durumu")
          .select("soru_seti_id, durum, notlar, created_at")
          .in("soru_seti_id", setIdler)
          .order("created_at", { ascending: true })
      : { data: [] as any[] };

    const setGecmis = gecmisHaritasi(setDurumlari, "soru_seti_id");
    const sonSet = (setler ?? []).at(-1) as any | undefined;

    const soru_seti = sonSet
      ? {
          id: sonSet.soru_seti_id,
          sorular: Array.isArray(sonSet.sorular) ? sonSet.sorular : [],
          iu_id: sonSet.iu_id ?? null,
          ...durumOzeti(setGecmis.get(sonSet.soru_seti_id) ?? []),
        }
      : null;

    return NextResponse.json({ talep_id, senaryo, video, soru_seti }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /talepler-v2/api/detay");
  }
}
