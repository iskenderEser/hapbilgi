// app/analiz/yonetici/layout.tsx
//
// Yönetici analiz sayfası için server-side rol guard.
// Yetkisiz roller /ana-sayfa'ya yönlendirilir.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ANALIZ_YONETICI_ROLLERI } from "@/lib/utils/roller";

export default async function YoneticiAnalizLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const rol = (user.user_metadata?.rol ?? "").toLowerCase();
  if (!ANALIZ_YONETICI_ROLLERI.includes(rol)) {
    redirect("/ana-sayfa");
  }

  return <>{children}</>;
}