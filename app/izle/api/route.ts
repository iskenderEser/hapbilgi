// app/izle/api/route.ts
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import { URETICI_ROLLER } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";

// İzleme sayfasına erişebilecek tüm roller
const IZLEME_ROLLERI = ["utt", "kd_utt", "bm", "tm", ...URETICI_ROLLER];

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    if (!IZLEME_ROLLERI.includes(rol)) return rolHatasi("Bu sayfaya erişim yetkiniz bulunmamaktadır.");

    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("bolge_id, takim_id")
      .eq("kullanici_id", user.id)
      .single();

    if (kullaniciError || !kullanici) return hataYaniti("Kullanıcı bilgisi alınamadı.", "kullanicilar tablosu SELECT — kullanici_id filtresi", kullaniciError);

    // takim_id'yi belirle: UTT/KD_UTT bölge üzerinden, diğerleri doğrudan
    let takim_id = kullanici.takim_id ?? null;

    if (["utt", "kd_utt"].includes(rol)) {
      if (!kullanici.bolge_id) return hataYaniti("Kullanıcıya bölge atanmamış.", "kullanicilar tablosu SELECT — bolge_id kontrolü", null);
      const { data: bolge, error: bolgeError } = await adminSupabase
        .from("bolgeler")
        .select("takim_id")
        .eq("bolge_id", kullanici.bolge_id)
        .single();
      if (bolgeError || !bolge) return hataYaniti("Bölge bilgisi alınamadı.", "bolgeler tablosu SELECT — bolge_id filtresi", bolgeError);
      if (!bolge.takim_id) return hataYaniti("Bölgeye takım atanmamış.", "bolgeler tablosu SELECT — takim_id kontrolü", null);
      takim_id = bolge.takim_id;
    }

    if (!takim_id) return hataYaniti("Kullanıcıya takım ataması bulunamadı.", "takim_id kontrolü", null);

    // Tek RPC ile tüm yayın listesi + sayımlar + kullanıcı durumları döner.
    // N+1 sorgu pattern'i kaldırıldı: 5 sorgu × N yayın → 1 sorgu.
    const { data: videolar, error: rpcError } = await adminSupabase
      .rpc("get_izle_videolari", {
        p_kullanici_id: user.id,
        p_takim_id: takim_id,
        // kd_utt hedef eşleniği utt'dir: hedef_roller talep hedefinden türer
        // (utt/bm/eczanem) ve 'kd_utt' hiçbir yayında geçmez — ham rol geçilirse
        // liste hep boş kalır (B-01). Ana sayfa davranışıyla simetri (anaSayfa/utt.ts).
        p_rol: rol === "kd_utt" ? "utt" : rol,
      });

    if (rpcError) return hataYaniti("Yayınlar çekilemedi.", "get_izle_videolari RPC", rpcError);

    return NextResponse.json({ videolar: videolar ?? [] }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /izle/api");
  }
}