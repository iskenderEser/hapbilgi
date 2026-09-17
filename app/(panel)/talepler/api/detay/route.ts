// app/talepler/api/detay/route.ts
//
// SEÇİLEN TALEBİN DERİN VERİSİ — üretici rol detay ucu.
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

interface SenaryoRow {
  senaryo_id: string;
  senaryo_metni?: string | null;
  iu_id?: string | null;
  created_at: string;
}

interface SoruSetiRow {
  soru_seti_id: string;
  sorular?: unknown;
  iu_id?: string | null;
  created_at: string;
}

interface DurumGecmisRow {
  durum: string;
  notlar: string | null;
  created_at: string;
  [key: string]: unknown;
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
function gecmisHaritasi<T extends Record<string, unknown>>(satirlar: T[] | null, anahtar: keyof T): Map<string, DurumSatiri[]> {
  const harita = new Map<string, DurumSatiri[]>();
  for (const s of satirlar ?? []) {
    const id = String(s[anahtar]);
    const liste = harita.get(id) ?? [];
    liste.push({ durum: String(s.durum), notlar: (s.notlar as string | null) ?? null, created_at: String(s.created_at) });
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

    // Sahiplik kapısı: oturum istemcisiyle okunur, RLS süzer. Taslak talepler operasyon detayına giremez.
    const { data: talep, error: talepError } = await supabase
      .from("talepler")
      .select("talep_id, hazir_video, hazir_video_url, hazir_soru_seti, hazir_soru_seti_verisi, created_at, ogrenme_araci_turu")
      .eq("talep_id", talep_id)
      .eq("taslak_mi", false)
      .maybeSingle();
    if (talepError) return hataYaniti("Talep sorgulanamadı.", "talepler tablosu SELECT — talep_id", talepError);
    if (!talep) return NextResponse.json({ hata: "Talep bulunamadı." }, { status: 404 });

    // ── Senaryo ──────────────────────────────────────────────────────────────
    const { data: senaryolar } = await adminSupabase
      .from("senaryolar")
      .select("senaryo_id, senaryo_metni, iu_id, created_at")
      .eq("talep_id", talep_id)
      .order("created_at", { ascending: true });

    const senaryoListesi = (senaryolar as SenaryoRow[] | null) ?? [];
    const senaryoIdler = senaryoListesi.map(s => s.senaryo_id);
    const { data: senaryoDurumlari } = senaryoIdler.length
      ? await adminSupabase
          .from("senaryo_durumu")
          .select("senaryo_id, durum, notlar, created_at")
          .in("senaryo_id", senaryoIdler)
          .order("created_at", { ascending: true })
      : { data: [] as DurumGecmisRow[] };

    const senaryoGecmis = gecmisHaritasi(senaryoDurumlari as DurumGecmisRow[] | null, "senaryo_id");
    const sonSenaryo = senaryoListesi.at(-1);
    const oncekiSenaryo = senaryoListesi.length > 1 ? senaryoListesi.at(-2) : null;

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

    // ── Soru seti ────────────────────────────────────────────────────────────
    const { data: setler } = await adminSupabase
      .from("soru_setleri")
      .select("soru_seti_id, sorular, iu_id, created_at")
      .eq("talep_id", talep_id)
      .order("created_at", { ascending: true });

    const setListesi = (setler as SoruSetiRow[] | null) ?? [];
    const setIdler = setListesi.map(s => s.soru_seti_id);
    const { data: setDurumlari } = setIdler.length
      ? await adminSupabase
          .from("soru_seti_durumu")
          .select("soru_seti_id, durum, notlar, created_at")
          .in("soru_seti_id", setIdler)
          .order("created_at", { ascending: true })
      : { data: [] as DurumGecmisRow[] };

    const setGecmis = gecmisHaritasi(setDurumlari as DurumGecmisRow[] | null, "soru_seti_id");
    const sonSet = setListesi.at(-1);

    const soru_seti = sonSet
      ? {
          id: sonSet.soru_seti_id,
          sorular: Array.isArray(sonSet.sorular) ? sonSet.sorular : [],
          iu_id: sonSet.iu_id ?? null,
          ...durumOzeti(setGecmis.get(sonSet.soru_seti_id) ?? []),
        }
      : talep.hazir_soru_seti === true && Array.isArray(talep.hazir_soru_seti_verisi)
        ? {
            id: `hazir-${talep_id}`,
            sorular: talep.hazir_soru_seti_verisi,
            iu_id: null,
            son_durum: null,
            son_durum_tarihi: talep.created_at ?? null,
            revizyon_sayisi: 0,
            notlar: [],
          }
        : null;

    let video: Record<string, unknown> | null = null;

    // ── Öğrenme Aracı (Podcast / Görsel / Flip PDF) ───────────────────────────
    let ogrenme_araci: {
      arac_id: string;
      arac_turu: string;
      dosya_yolu: string | null;
      kapak_yolu: string | null;
      sure_saniye: number | null;
      metadata: unknown;
      son_durum: string | null;
      son_durum_tarihi: string | null;
      revizyon_sayisi: number;
      notlar: { notlar: string; created_at: string }[];
    } | null = null;

    if (talep.ogrenme_araci_turu) {
      const { data: aracKaydi } = await adminSupabase
        .from("ogrenme_araclari")
        .select("arac_id, arac_turu, dosya_yolu, kapak_yolu, sure_saniye, metadata")
        .eq("talep_id", talep_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (aracKaydi) {
        const { data: aracDurumlari, error: aracDurumError } = await adminSupabase
          .from("ogrenme_araci_durumu")
          .select("durum, notlar, created_at")
          .eq("arac_id", aracKaydi.arac_id)
          .order("created_at", { ascending: true });
        if (aracDurumError) {
          return hataYaniti("Öğrenme aracı geçmişi alınamadı.", "ogrenme_araci_durumu SELECT", aracDurumError);
        }

        ogrenme_araci = {
          arac_id: aracKaydi.arac_id,
          arac_turu: aracKaydi.arac_turu,
          dosya_yolu: aracKaydi.dosya_yolu ?? null,
          kapak_yolu: aracKaydi.kapak_yolu ?? null,
          sure_saniye: aracKaydi.sure_saniye ?? null,
          metadata: aracKaydi.metadata ?? null,
          ...durumOzeti((aracDurumlari as DurumSatiri[] | null) ?? []),
        };
        if (aracKaydi.arac_turu === "video") {
          video = {
            id: aracKaydi.arac_id,
            video_url: aracKaydi.dosya_yolu ?? null,
            thumbnail_url: aracKaydi.kapak_yolu ?? null,
            ...durumOzeti((aracDurumlari as DurumSatiri[] | null) ?? []),
          };
        }
      }
    }

    const video_isleniyor = talep.hazir_video === true && Boolean(talep.hazir_video_url) && !video?.video_url;

    return NextResponse.json({ talep_id, senaryo, video, soru_seti, video_isleniyor, ogrenme_araci }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /talepler/api/detay");
  }
}
