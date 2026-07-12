// app/analiz/tm/layout.tsx
//
// TM analiz sayfası için server-side rol guard.

import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";

export default async function TmAnalizLayout({
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

  // Rol kaynağı v_auth_kimlik_admin'dir (B-04) — user_metadata bayatlayabilir.
  const rol = await rolCozucu(createAdminClient(), user.id);
  if (rol !== "tm") {
    redirect("/ana-sayfa");
  }

  return <>{children}</>;
}