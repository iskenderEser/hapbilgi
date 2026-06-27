// app/analiz/tm/layout.tsx
//
// TM analiz sayfası için server-side rol guard.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const rol = (user.user_metadata?.rol ?? "").toLowerCase();
  if (rol !== "tm") {
    redirect("/ana-sayfa");
  }

  return <>{children}</>;
}