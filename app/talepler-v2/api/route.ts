// app/talepler-v2/api/route.ts
//
// TALEP MERKEZLİ ÜRETİM — liste ucu (docs/talepler_v2_is_plani.md, A-2).
//
// /talepler/api GET'inin deseni birebir korunur: talepler OTURUM istemcisiyle
// okunur (görünürlük RLS'te — üretici yalnız kendi talebini görür), zincir view'i
// service_role yetkili olduğu için adminSupabase ile okunur. Künye ortak
// çeviriciden, kaskad ortak dosyadan gelir; ikisi de burada kopyalanmaz.
//
// Bugünkü uçtan İKİ farkı var:
//   1. Ham ZincirSatiri de döner. Bugünkü uç yalnız çözülmüş sonucu (asama,
//      durum_kodu) veriyor; yeni sayfanın şeridi BEŞ adımın hepsinin halini
//      göstereceği için ham satır gerekiyor (A-3'teki adimlariCoz'un girdisi).
//   2. İÜ dalı yok. Bugünkü uçtaki "İÜ hazır video taleplerini görmez" liste
//      kuralı burada bulunmaz — bu sayfa faz 1'de yalnız üretici rollerine açık.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { TALEP_ALANLARI, haritalaTalep } from "@/lib/utils/talepZinciri";
import { zincirHaritasi, asamaCoz, uretimBittiMi, iptalEdildiMi } from "@/lib/utils/uretimZinciri";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    // D-1: faz 1 yalnız üretici. İÜ eski sayfalarda çalışmaya devam ediyor.
    const rol = await rolCozucu(adminSupabase, user.id);
    if (!URETICI_ROLLER.includes(rol)) {
      return rolHatasi("Bu sayfa yalnız üretici rollerine açıktır.");
    }

    const { data: talepler, error } = await supabase
      .from("talepler")
      // Künye alanları ortak listeden; hazır video adresi bu listeye özel
      // (video adımının önizlemesi ve yükleme durumu ondan okunur).
      .select(`${TALEP_ALANLARI}, hazir_video_url`)
      .order("created_at", { ascending: false });

    if (error) return hataYaniti("Talepler çekilemedi.", "talepler tablosu SELECT", error);

    const kunyeler = (talepler ?? []).map((t: any) => ({
      ...haritalaTalep(t),
      hazir_video_url: t.hazir_video_url ?? null,
    }));

    const zincirler = await zincirHaritasi(adminSupabase, {
      talepIdler: kunyeler.map((t) => t.talep_id),
    });

    const durumlar = new Map<string, ReturnType<typeof asamaCoz>>();
    for (const t of kunyeler) {
      const z = zincirler.get(t.talep_id);
      if (z) durumlar.set(t.talep_id, asamaCoz(t, z));
    }

    // İçerik üreticisi adı — iptal tablosunda "iş kimdeydi" görünsün diye. Tek
    // toplu sorgu; talep başına ad çözmek N+1 olurdu.
    const iuIdler = [...new Set(
      [...durumlar.values()].map((d) => d.iu_id).filter((id): id is string => !!id),
    )];
    const iuAdlari = new Map<string, string>();
    if (iuIdler.length > 0) {
      const { data: iular } = await adminSupabase
        .from("kullanicilar")
        .select("kullanici_id, ad, soyad")
        .in("kullanici_id", iuIdler);
      for (const k of iular ?? []) iuAdlari.set(k.kullanici_id, `${k.ad ?? ""} ${k.soyad ?? ""}`.trim());
    }

    const sonuc = kunyeler.map((t) => {
      // Zincir satırı yoksa talep henüz hiçbir aşamaya girmemiş sayılır; sessizce
      // düşürmek yerine "devam eden" kabul edilir — liste kayıt kaybetmemeli.
      const durum = durumlar.get(t.talep_id);
      return {
        ...t,
        asama: durum?.asama ?? "Senaryo",
        durum_kodu: durum?.durum_kodu ?? "iu_iletildi",
        uretim_bitti: durum ? uretimBittiMi(durum) : false,
        iptal_edildi: durum ? iptalEdildiMi(durum) : false,
        iu_ad_soyad: durum?.iu_id ? (iuAdlari.get(durum.iu_id) ?? null) : null,
        // Şeridin girdisi: beş adımın halini bu satırdan türetiriz (A-3).
        zincir: zincirler.get(t.talep_id) ?? null,
      };
    });

    return NextResponse.json({ talepler: sonuc }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /talepler-v2/api");
  }
}
