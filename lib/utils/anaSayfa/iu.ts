// İçerik Üreticisi ana sayfasının tek iş kaynağı uretim_gorevleri'dir.
// Bildirim yalnız zildir; artifact iu_id yazarı, görev ataması ise güncel sorumluyu gösterir.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { IuKategori } from "@/lib/utils/anaSayfa/iuDurumEsle";
import { talepBazindaTekillestir } from "@/lib/utils/anaSayfa/iuDurumEsle";
import { TALEP_TURU_KURALLARI } from "@/lib/uretici/yetenekler";
import { TALEP_ALANLARI, haritalaTalep } from "@/lib/utils/talepZinciri";
import { gorevDurumKodu, type Asama, type DurumKodu } from "@/lib/utils/durum/mesaj";

export interface IsSatiri {
  talep_id: string;
  urun_adi: string;
  teknik_adi: string;
  turu_adi: string | null;
  asama: Asama;
  durum_kodu: DurumKodu;
  uretici_rol_adi: string | null;
  tarih: string;
  yol: string;
  kategori: IuKategori;
}

export interface IuAnaSayfaVeri {
  satirlar: IsSatiri[];
  istatistikler: { bekleyen: number; revizyon: number; devam: number; tamamlanan: number };
}

const TAMAMLANAN_PENCERE_MS = 30 * 24 * 60 * 60 * 1000;

function kategoriBul(kod: DurumKodu): IuKategori | null {
  if (kod === "iptal") return null;
  if (kod === "iu_iletildi" || kod === "iu_hazirliyor") return "bekleyen";
  if (kod === "iu_duzeltiyor") return "revizyon";
  if (kod === "onaylandi") return "tamamlanan";
  return "devam";
}

export async function getIuAnaSayfaVeri(userId: string, adminSupabase: SupabaseClient): Promise<IuAnaSayfaVeri> {
  const { data, error } = await adminSupabase
    .from("uretim_gorevleri")
    .select(`gorev_id, talep_id, asama, durum, updated_at, talepler(${TALEP_ALANLARI})`)
    .eq("atanan_iu_id", userId)
    .in("durum", ["hazirlaniyor", "inceleme_bekliyor", "revizyon_bekliyor", "tamamlandi"])
    .order("updated_at", { ascending: false });
  if (error) throw error;

  const satirlar = talepBazindaTekillestir((data ?? []).flatMap((g) => {
    const talepHam = Array.isArray(g.talepler) ? g.talepler[0] : g.talepler;
    if (!talepHam) return [];
    const talep = haritalaTalep(talepHam);
    const durumKodu = gorevDurumKodu(g.durum);
    const kategori = kategoriBul(durumKodu);
    if (!kategori) return [];
    const asama: Asama = g.asama === "video" ? "Video" : g.asama === "soru_seti" ? "Soru Seti" : "Senaryo";
    return [{
      talep_id: g.talep_id,
      urun_adi: talep.urun_adi,
      teknik_adi: talep.teknik_adi,
      turu_adi: talep.egitim_turu ? (TALEP_TURU_KURALLARI[talep.egitim_turu]?.ad ?? null) : null,
      asama,
      durum_kodu: durumKodu,
      uretici_rol_adi: talep.uretici_rol_adi,
      tarih: g.updated_at,
      yol: `/uretim/gorevler/${g.gorev_id}`,
      kategori,
    } satisfies IsSatiri];
  }))
    .filter((s) => s.kategori !== "tamamlanan" || Date.now() - new Date(s.tarih).getTime() <= TAMAMLANAN_PENCERE_MS)
    .sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());

  const say = (kategori: IuKategori) => satirlar.filter((s) => s.kategori === kategori).length;
  return {
    satirlar,
    istatistikler: {
      bekleyen: say("bekleyen"),
      revizyon: say("revizyon"),
      devam: say("devam"),
      tamamlanan: say("tamamlanan"),
    },
  };
}
