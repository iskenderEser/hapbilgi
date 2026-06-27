// app/analiz/bm/layout.tsx
//
// BM analiz sayfası için server-side rol guard.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function BmAnalizLayout({
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
  if (rol !== "bm") {
    redirect("/ana-sayfa");
  }

  return <>{children}</>;
}