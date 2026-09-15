import type { SupabaseClient } from "@supabase/supabase-js";
import { IU_ROLU, URETICI_ROLLER } from "@/lib/utils/roller";
import { podcastTranskriptTercihiCoz } from "@/lib/ogrenmeAraci/sozlesme";

export type UretimAraciYetkisi =
  | { ok: true; firmaId: string; iuId: string | null; ureticiId: string }
  | { ok: false; status: 403 | 404; hata: string };

export type IuOgrenmeAraciGorevYetkisi =
  | {
      ok: true;
      gorev: {
        gorev_id: string;
        talep_id: string;
        asama: string;
        durum: string;
        atanan_iu_id: string;
        arac_id: string | null;
      };
    }
  | { ok: false; status: 403 | 404 | 422; hata: string };

export function anaYuklemeBaginiDogrula(girdi: {
  kaynak: string;
  beyanGorevId?: string | null;
  istekGorevId?: string | null;
  beyanGirisimId?: string | null;
  istekGirisimId?: string | null;
}): { ok: true } | { ok: false; status: 409; hata: string } {
  if (girdi.kaynak === "iu" && girdi.beyanGorevId !== girdi.istekGorevId) {
    return { ok: false, status: 409, hata: "Yükleme girişimi ile görev eşleşmiyor." };
  }
  if (!girdi.istekGirisimId || girdi.beyanGirisimId !== girdi.istekGirisimId) {
    return { ok: false, status: 409, hata: "Yükleme girişimi güncel değil." };
  }
  return { ok: true };
}

/** İÜ yüklemelerinde talep sahipliği yerine tekil, aktif görev bağını doğrular. */
export async function iuOgrenmeAraciGorevYetkisiniDogrula(girdi: {
  db: SupabaseClient;
  gorevId: string | null | undefined;
  talepId: string;
  kullaniciId: string;
  aracId?: string | null;
}): Promise<IuOgrenmeAraciGorevYetkisi> {
  if (!girdi.gorevId) {
    return { ok: false, status: 422, hata: "İçerik üreticisi yüklemesi için görev kimliği zorunludur." };
  }

  const { data: gorev, error } = await girdi.db
    .from("uretim_gorevleri")
    .select("gorev_id, talep_id, asama, durum, atanan_iu_id, arac_id")
    .eq("gorev_id", girdi.gorevId)
    .maybeSingle();
  if (error || !gorev) return { ok: false, status: 404, hata: "Üretim görevi bulunamadı." };
  if (gorev.atanan_iu_id !== girdi.kullaniciId) {
    return { ok: false, status: 403, hata: "Bu üretim görevi size atanmamış." };
  }
  if (gorev.talep_id !== girdi.talepId || gorev.asama !== "video") {
    return { ok: false, status: 422, hata: "Görev ve öğrenme aracı talebi eşleşmiyor." };
  }
  if (!["hazirlaniyor", "revizyon_bekliyor"].includes(gorev.durum)) {
    return { ok: false, status: 422, hata: "Görev durumu yükleme için uygun değil." };
  }
  if (gorev.arac_id && (!girdi.aracId || gorev.arac_id !== girdi.aracId)) {
    return { ok: false, status: 422, hata: "Görev ve öğrenme aracı eşleşmesi geçersiz." };
  }
  return { ok: true, gorev };
}

export async function uretimAraciYetkisiniDogrula(girdi: {
  db: SupabaseClient;
  talepId: string;
  kullaniciId: string;
  rol: string;
}): Promise<UretimAraciYetkisi> {
  const { data: talep, error } = await girdi.db
    .from("talepler")
    .select("talep_id, firma_id, uretici_id")
    .eq("talep_id", girdi.talepId)
    .maybeSingle();
  if (error || !talep) return { ok: false, status: 404, hata: "Talep bulunamadı." };

  if (URETICI_ROLLER.includes(girdi.rol)) {
    return talep.uretici_id === girdi.kullaniciId
      ? { ok: true, firmaId: talep.firma_id, iuId: null, ureticiId: talep.uretici_id }
      : { ok: false, status: 403, hata: "Bu talebin öğrenme aracını yönetme yetkiniz yok." };
  }

  if (girdi.rol === IU_ROLU) {
    const { data: gorev, error: gorevError } = await girdi.db
      .from("uretim_gorevleri")
      .select("gorev_id")
      .eq("talep_id", girdi.talepId)
      .eq("atanan_iu_id", girdi.kullaniciId)
      .limit(1)
      .maybeSingle();
    if (gorevError || !gorev) return { ok: false, status: 403, hata: "Bu talebin öğrenme aracı size atanmamış." };
    return { ok: true, firmaId: talep.firma_id, iuId: girdi.kullaniciId, ureticiId: talep.uretici_id };
  }

  return { ok: false, status: 403, hata: "Bu işlem üretim hattı rollerine açıktır." };
}

export type PodcastTranskriptYetkisi =
  | {
      ok: true;
      rol: string;
      kaynak: "hazir" | "iu";
      talepId: string;
      firmaId: string;
      arac: {
        arac_id: string;
        talep_id: string;
        arac_turu: string;
        kaynak: "hazir" | "iu";
        dosya_yolu: string | null;
        kapak_yolu: string | null;
        transkript_yolu: string | null;
        metadata: Record<string, unknown> | null;
        metadata_dogrulandi: boolean | null;
        checksum_sha256: string | null;
        sure_saniye: number | null;
      };
      talep: {
        talep_id: string;
        firma_id: string;
        uretici_id: string;
        hazir_video: boolean;
        ogrenme_araci_turu: string;
        ogrenme_araci_tercihleri?: Record<string, unknown> | null;
      };
      gorevId?: string;
      transkriptIstendi: boolean;
    }
  | { ok: false; status: 403 | 404 | 422; hata: string };

export async function podcastTranskriptYetkisiDogrula(girdi: {
  db: SupabaseClient;
  aracId: string;
  kullaniciId: string;
  rol: string;
  gorevId?: string | null;
  transkriptIstendiZorunluMu?: boolean;
}): Promise<PodcastTranskriptYetkisi> {
  const { data: arac, error: aracError } = await girdi.db
    .from("ogrenme_araclari")
    .select("arac_id, talep_id, arac_turu, kaynak, dosya_yolu, kapak_yolu, transkript_yolu, metadata, metadata_dogrulandi, checksum_sha256, sure_saniye")
    .eq("arac_id", girdi.aracId)
    .maybeSingle();

  if (aracError || !arac || arac.arac_turu !== "podcast") {
    return { ok: false, status: 404, hata: "Podcast bulunamadı." };
  }

  const { data: talep, error: talepError } = await girdi.db
    .from("talepler")
    .select("talep_id, firma_id, uretici_id, hazir_video, ogrenme_araci_turu, ogrenme_araci_tercihleri")
    .eq("talep_id", arac.talep_id)
    .maybeSingle();

  if (talepError || !talep || talep.ogrenme_araci_turu !== "podcast") {
    return { ok: false, status: 404, hata: "Talep bulunamadı." };
  }

  const transkriptIstendi = podcastTranskriptTercihiCoz(talep.ogrenme_araci_tercihleri);

  if (arac.kaynak === "hazir") {
    if (!URETICI_ROLLER.includes(girdi.rol)) {
      return { ok: false, status: 403, hata: "Bu işlem yalnızca üretici rollerine açıktır." };
    }
    if (talep.uretici_id !== girdi.kullaniciId) {
      return { ok: false, status: 403, hata: "Bu talebin öğrenme aracını yönetme yetkiniz yok." };
    }
    if (talep.hazir_video !== true) {
      return { ok: false, status: 422, hata: "Bu işlem yalnızca V2 veya V4 hazır podcast taleplerinde geçerlidir." };
    }
    return {
      ok: true,
      rol: girdi.rol,
      kaynak: "hazir",
      talepId: talep.talep_id,
      firmaId: talep.firma_id,
      arac,
      talep,
      transkriptIstendi: true,
    };
  }

  if (arac.kaynak === "iu") {
    if (girdi.rol !== IU_ROLU && girdi.rol !== "icerik_ureticisi") {
      return { ok: false, status: 403, hata: "Bu işlem yalnızca içerik üreticisi rolüne açıktır." };
    }

    if (!girdi.gorevId) {
      return { ok: false, status: 422, hata: "İçerik üreticisi podcast işlemi için görev kimliği zorunludur." };
    }

    const { data: gorev, error: gorevError } = await girdi.db
      .from("uretim_gorevleri")
      .select("gorev_id, talep_id, asama, durum, atanan_iu_id, arac_id, surum")
      .eq("gorev_id", girdi.gorevId)
      .maybeSingle();
    if (gorevError || !gorev) {
      return { ok: false, status: 403, hata: "Bu podcast üretim görevi bulunamadı." };
    }
    if (gorev.talep_id !== arac.talep_id || gorev.asama !== "video") {
      return { ok: false, status: 422, hata: "Görev, talep ve podcast eşleşmesi geçersiz." };
    }
    if (gorev.atanan_iu_id !== girdi.kullaniciId) {
      return { ok: false, status: 403, hata: "Bu podcast üretim görevi size atanmamış." };
    }

    if (gorev.arac_id && gorev.arac_id !== arac.arac_id) {
      return { ok: false, status: 422, hata: "Görev ve araç eşleşmesi geçersiz." };
    }

    if (!["hazirlaniyor", "revizyon_bekliyor"].includes(gorev.durum)) {
      return { ok: false, status: 422, hata: "Görev durumu işlem için uygun değil." };
    }

    const transkriptZorunlu = girdi.transkriptIstendiZorunluMu ?? true;
    if (transkriptZorunlu && !transkriptIstendi) {
      return { ok: false, status: 422, hata: "Bu podcast için transkript talep edilmemiş." };
    }

    return {
      ok: true,
      rol: girdi.rol,
      kaynak: "iu",
      talepId: talep.talep_id,
      firmaId: talep.firma_id,
      arac,
      talep,
      gorevId: gorev.gorev_id,
      transkriptIstendi,
    };
  }

  return { ok: false, status: 422, hata: "Geçersiz araç kaynağı." };
}
