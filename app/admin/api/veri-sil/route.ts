// app/admin/api/veri-sil/route.ts
//
// Toplu/Tekil Silme — Aşama 3 (docs/toplu_tekil_silme_is_plani.md).
// Admin'e özel silme aracının API ucu. Tek POST, iki işlem:
//   { islem: 'sayim', mod, firma_id?, talep_id? } → önizleme (test_veri_sayim RPC)
//   { islem: 'sil',   mod, firma_id?, talep_id? } → silme    (test_veri_temizle RPC)
// mod ∈ 'tum' | 'firma' | 'tekil'. firma → firma_id, tekil → talep_id zorunlu.
//
// Güvenlik iki katman: proxy /admin bekçisi (§2.4) + burada adminGirisKontrol.
// İş kuralları/kapsam DB fonksiyonundadır; route yalnız yetki + doğrulama + çağrı.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { adminGirisKontrol } from "@/lib/utils/adminGirisKontrol";
import { hataYaniti, sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    // 1) Yetki — yalnız admin
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;

    // 2) Gövde + doğrulama
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return validasyonHatasi("Geçersiz istek gövdesi.", ["body"]);

    const { islem, mod, firma_id, talep_id } = body as {
      islem?: string; mod?: string; firma_id?: string; talep_id?: string;
    };

    if (islem !== "sayim" && islem !== "sil")
      return validasyonHatasi("islem 'sayim' veya 'sil' olmalıdır.", ["islem"]);
    if (mod !== "tum" && mod !== "firma" && mod !== "tekil")
      return validasyonHatasi("mod 'tum', 'firma' veya 'tekil' olmalıdır.", ["mod"]);
    if (mod === "firma" && (!firma_id || !UUID_RE.test(firma_id)))
      return validasyonHatasi("Firma modunda geçerli firma_id zorunludur.", ["firma_id"]);
    if (mod === "tekil" && (!talep_id || !UUID_RE.test(talep_id)))
      return validasyonHatasi("Tekil modunda geçerli talep_id zorunludur.", ["talep_id"]);

    // 3) İlgili RPC'yi çağır (service_role)
    const adminSupabase = createAdminClient();
    const rpcAdi = islem === "sayim" ? "test_veri_sayim" : "test_veri_temizle";

    const { data, error } = await adminSupabase.rpc(rpcAdi, {
      p_mod: mod,
      p_firma_id: mod === "firma" ? firma_id : null,
      p_talep_id: mod === "tekil" ? talep_id : null,
    });

    if (error)
      return hataYaniti(
        islem === "sayim" ? "Önizleme alınamadı." : "Silme işlemi başarısız.",
        `${rpcAdi} RPC`,
        error,
      );

    // RPC iş-kuralı sonuçları jsonb.durum ile döner (ör. firma_bulunamadi / talep_bulunamadi)
    const durum = (data as { durum?: string } | null)?.durum;
    const beklenen = islem === "sayim" ? "onizleme" : "silindi";
    if (durum !== beklenen)
      return validasyonHatasi(`İşlem tamamlanamadı: ${durum ?? "bilinmeyen"}`, ["mod", "firma_id", "talep_id"]);

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /admin/api/veri-sil");
  }
}
