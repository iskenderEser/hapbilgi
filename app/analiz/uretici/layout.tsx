// app/analiz/uretici/layout.tsx
//
// Üretici analiz sayfası için server-side rol guard.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ANALIZ_URETICI_ROLLERI } from "@/lib/utils/roller";

export default async function UreticiAnalizLayout({
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
  if (!ANALIZ_URETICI_ROLLERI.includes(rol)) {
    redirect("/ana-sayfa");
  }

  return <>{children}</>;
}