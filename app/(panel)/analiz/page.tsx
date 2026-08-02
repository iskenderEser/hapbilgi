// app/analiz/page.tsx
//
// Analiz sayfası ana giriş noktası — rol bazlı yönlendirme.
// Kullanıcının rolüne göre /analiz/<rol>'e redirect eder.
// Yetkisiz roller için /ana-sayfa'ya geri döner.

import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import {
  ANALIZ_YONETICI_ROLLERI,
  ANALIZ_URETICI_ROLLERI,
} from "@/lib/utils/roller";

export default async function AnalizSayfasi() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Rol kaynağı v_auth_kimlik_admin'dir (B-04) — user_metadata bayatlayabilir.
  const rol = await rolCozucu(createAdminClient(), user.id);

  if (ANALIZ_YONETICI_ROLLERI.includes(rol)) {
    redirect("/analiz/yonetici");
  }

  if (ANALIZ_URETICI_ROLLERI.includes(rol)) {
    redirect("/analiz/uretici");
  }

  if (rol === "tm") {
    redirect("/analiz/tm");
  }

  if (rol === "bm") {
    redirect("/analiz/bm");
  }

  redirect("/ana-sayfa");
}