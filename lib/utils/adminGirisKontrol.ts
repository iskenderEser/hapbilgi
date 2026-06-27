// lib/utils/adminGirisKontrol.ts
//
// Admin API endpoint'leri için kimlik + rol kontrolü.
// Güvenlik ROLE göre yapılır (e-postaya değil): kullanicilar.rol ∈ ADMIN_ROLLER.
//
// Kullanım (her admin route handler'ının başında):
//   const kontrol = await adminGirisKontrol();
//   if (!kontrol.gecerli) return kontrol.yanit;
//   // ... buradan sonra mevcut createAdminClient() işlerine devam

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ADMIN_ROLLER } from "@/lib/utils/roller";
import { yetkiHatasi, rolHatasi, hataYaniti } from "@/lib/utils/hataIsle";

type AdminKontrolSonuc =
  | { gecerli: true; kullaniciId: string; rol: string }
  | { gecerli: false; yanit: ReturnType<typeof yetkiHatasi> };

export async function adminGirisKontrol(): Promise<AdminKontrolSonuc> {
  // 1) Oturum açmış kullanıcı var mı? (cookie tabanlı auth client)
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { gecerli: false, yanit: yetkiHatasi() }; // 401
  }

  // 2) Rolü oku — service_role ile (auth client'ın kullanicilar erişimine bel bağlama)
  const adminSupabase = createAdminClient();
  const { data: kullanici, error: rolError } = await adminSupabase
    .from("kullanicilar")
    .select("rol")
    .eq("kullanici_id", user.id)
    .single();

  if (rolError || !kullanici) {
    return {
      gecerli: false,
      yanit: hataYaniti("Kullanıcı rolü okunamadı.", "adminGirisKontrol", rolError, 403),
    };
  }

  // 3) Rol admin mi? (e-postaya değil, role göre)
  const rol = (kullanici.rol ?? "").toLowerCase();
  if (!ADMIN_ROLLER.includes(rol)) {
    return { gecerli: false, yanit: rolHatasi() }; // 403
  }

  return { gecerli: true, kullaniciId: user.id, rol };
}