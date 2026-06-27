import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_ROLLER } from "@/lib/utils/roller";

const SADECE_PM_PREFIXLER = ["/senaryolar/api/senaryolar/"];

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // --- Admin API bekçisi ---------------------------------------------------
  // /admin/api/* (giris hariç) yalnızca rolü admin olan kullanıcıya açıktır.
  // Yetki, kullanıcının değiştirebildiği user_metadata'dan DEĞİL, yetkili
  // kaynak olan kullanicilar tablosundan (service_role) doğrulanır.
  // İleride firma admini eklenince firma_id de buradan çekilip /firmalar/[firma_id]
  // yoluyla karşılaştırılabilir.
  if (
    pathname.startsWith("/admin/api/") &&
    !pathname.startsWith("/admin/api/giris")
  ) {
    if (!user) {
      return NextResponse.json(
        { error: "Oturum açmanız gerekiyor." },
        { status: 401 }
      );
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: kullanici } = await adminSupabase
      .from("kullanicilar")
      .select("rol")
      .eq("kullanici_id", user.id)
      .single();

    const rol = (kullanici?.rol ?? "").toLowerCase();
    if (!ADMIN_ROLLER.includes(rol)) {
      return NextResponse.json(
        { error: "Bu işlem için yetkiniz bulunmuyor." },
        { status: 403 }
      );
    }

    return supabaseResponse; // admin → geç
  }
  // -------------------------------------------------------------------------

  if (!pathname.startsWith("/senaryolar/api/")) {
    return supabaseResponse;
  }

  const PUBLIC_API_ROUTES = ["/senaryolar/api/auth"];
  if (PUBLIC_API_ROUTES.some((r) => pathname.startsWith(r))) {
    return supabaseResponse;
  }

  if (!user) {
    return NextResponse.json(
      { error: "Oturum açmanız gerekiyor." },
      { status: 401 }
    );
  }

  const rol: string = user.user_metadata?.rol ?? "";

  if (SADECE_PM_PREFIXLER.some((p) => pathname.startsWith(p))) {
    if (request.method === "PUT" && rol !== "PM") {
      return NextResponse.json(
        { error: "Bu işlem için PM yetkisi gereklidir." },
        { status: 403 }
      );
    }
  }

  if (pathname === "/senaryolar/api/senaryolar" && request.method === "POST") {
    if (rol !== "IU") {
      return NextResponse.json(
        { error: "Senaryo oluşturma yetkisi yalnızca IU rolündeki kullanıcılara aittir." },
        { status: 403 }
      );
    }
  }

  if (pathname === "/senaryolar/api/talepler" && request.method === "POST") {
    if (rol !== "PM") {
      return NextResponse.json(
        { error: "Talep oluşturma yetkisi yalnızca PM rolündeki kullanıcılara aittir." },
        { status: 403 }
      );
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};