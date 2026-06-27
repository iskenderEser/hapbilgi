// app/analiz/page.tsx
//
// Analiz sayfası ana giriş noktası — rol bazlı yönlendirme.
// Kullanıcının rolüne göre /analiz/<rol>'e redirect eder.
// Yetkisiz roller için /ana-sayfa'ya geri döner.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  const rol = (user.user_metadata?.rol ?? "").toLowerCase();

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