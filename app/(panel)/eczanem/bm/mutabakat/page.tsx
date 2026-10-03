import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import BmMutabakatTakipClient from "./_components/BmMutabakatTakipClient";

export default async function EczanemBmMutabakatTakipPage() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) redirect("/login");

  const rol = await rolCozucu(adminSupabase, user.id);
  if (rol !== "bm") redirect("/ana-sayfa");

  return <BmMutabakatTakipClient />;
}
