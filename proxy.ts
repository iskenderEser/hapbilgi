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
  // /admin/api/* (giris ve test-verileri-sil hariç) yalnızca rolü admin olan
  // kullanıcıya açıktır. Yetki, kullanıcının değiştirebildiği user_metadata'dan
  // DEĞİL, yetkili kaynak olan kullanicilar tablosundan (service_role) doğrulanır.
  // test-verileri-sil bilinçli olarak girişsiz bir test aracıdır; proxy onu
  // kesmez (deploy öncesi bu endpoint tamamen kaldırılacaktır).
  // İleride firma admini eklenince firma_id de buradan çekilip /firmalar/[firma_id]
  // yoluyla karşılaştırılabilir.
  if (
    pathname.startsWith("/admin/api/") &&
    !pathname.startsWith("/admin/api/giris") &&
    !pathname.startsWith("/admin/api/test-verileri-sil")
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

  // --- Challenge Club firma bekçisi ----------------------------------------
  // /challenge-club/* ve /cc-ligi/* (sayfa + API) yalnızca firması CC açık
  // (firmalar.cc_aktif = true) olan kullanıcıya açıktır. Admin bu işi
  // FirmaSidebar toggle'ı ile firma bazında kapatır; kapalı firmada o firmanın
  // hiçbir kullanıcısı (BM, TM, üretici, yönetici...) CC'yi göremez/erişemez.
  //
  // Tek noktadan kontrol: 8 CC API'sine ve 3 CC sayfasına ayrı ayrı dokunmak
  // yerine engel burada uygulanır. Sorgu YALNIZCA CC yollarında çalışır
  // (diğer isteklerde firma sorgusu yapılmaz — dar kapsam).
  if (
    pathname.startsWith("/challenge-club") ||
    pathname.startsWith("/cc-ligi")
  ) {
    const ccApiYolu = pathname.includes("/api/") || pathname.endsWith("/api");

    if (!user) {
      // Oturum yoksa: API → 401, sayfa → login'e
      if (ccApiYolu) {
        return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const ccSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: ccKullanici } = await ccSupabase
      .from("kullanicilar")
      .select("firma_id")
      .eq("kullanici_id", user.id)
      .single();

    if (ccKullanici?.firma_id) {
      const { data: ccFirma } = await ccSupabase
        .from("firmalar")
        .select("cc_aktif")
        .eq("firma_id", ccKullanici.firma_id)
        .single();

      if (ccFirma && ccFirma.cc_aktif === false) {
        // Firma CC kapalı: API → 403 JSON, sayfa → ana-sayfa
        if (ccApiYolu) {
          return NextResponse.json(
            { error: "Challenge Club firmanız için kapalıdır." },
            { status: 403 }
          );
        }
        return NextResponse.redirect(new URL("/ana-sayfa", request.url));
      }
    }
    // cc_aktif = true veya firma yok → geç (akış aşağıda sürer)
  }
  // -------------------------------------------------------------------------

  // --- HBStore firma bekçisi -----------------------------------------------
  // /store/* (sayfa + API) yalnızca firması HBStore açık (firmalar.hbstore_aktif
  // = true) olan kullanıcıya açıktır. Admin bu işi FirmaSidebar toggle'ı ile
  // firma bazında kapatır; kapalı firmada o firmanın hiçbir kullanıcısı
  // (sipariş veren UTT/KD_UTT/BM, sipariş izleyen TM/GM/yönetici...) store'a
  // erişemez.
  //
  // Tek noktadan kontrol: store API'lerine ve sayfalarına ayrı ayrı guard
  // koymak yerine engel burada uygulanır (CC bekçisiyle aynı desen). Sorgu
  // YALNIZCA /store yollarında çalışır — diğer isteklerde firma sorgusu yapılmaz.
  if (pathname.startsWith("/store")) {
    const storeApiYolu = pathname.includes("/api/") || pathname.endsWith("/api");

    if (!user) {
      if (storeApiYolu) {
        return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const storeSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: storeKullanici } = await storeSupabase
      .from("kullanicilar")
      .select("firma_id")
      .eq("kullanici_id", user.id)
      .single();

    if (storeKullanici?.firma_id) {
      const { data: storeFirma } = await storeSupabase
        .from("firmalar")
        .select("hbstore_aktif")
        .eq("firma_id", storeKullanici.firma_id)
        .single();

      if (storeFirma && storeFirma.hbstore_aktif === false) {
        if (storeApiYolu) {
          return NextResponse.json(
            { error: "HBStore firmanız için kapalıdır." },
            { status: 403 }
          );
        }
        return NextResponse.redirect(new URL("/ana-sayfa", request.url));
      }
    }
    // hbstore_aktif = true veya firma yok → geç
  }
  // -------------------------------------------------------------------------

  // --- E-Club firma bekçisi ------------------------------------------------
  // /eclub/* (sayfa + API) yalnızca firması E-Club açık (firmalar.eclub_aktif
  // = true) olan kullanıcıya açıktır. Admin bu işi FirmaSidebar toggle'ı ile
  // firma bazında kapatır; kapalı firmada o firmanın kullanıcıları (UTT/KD_UTT)
  // E-Club liste yönetimine erişemez.
  //
  // NOT: /admin/eclub bu bekçinin KAPSAMINDA DEĞİLDİR (o /admin/api bekçisiyle
  // ve sayfa auth guard'ıyla korunur, firma bağımsızdır). Burada yalnızca
  // /eclub yolları kontrol edilir. Sorgu YALNIZCA /eclub yollarında çalışır.
  if (pathname.startsWith("/eclub")) {
    const eclubApiYolu = pathname.includes("/api/") || pathname.endsWith("/api");

    if (!user) {
      if (eclubApiYolu) {
        return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const eclubSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: eclubKullanici } = await eclubSupabase
      .from("kullanicilar")
      .select("firma_id")
      .eq("kullanici_id", user.id)
      .single();

    if (eclubKullanici?.firma_id) {
      const { data: eclubFirma } = await eclubSupabase
        .from("firmalar")
        .select("eclub_aktif")
        .eq("firma_id", eclubKullanici.firma_id)
        .single();

      if (eclubFirma && eclubFirma.eclub_aktif === false) {
        if (eclubApiYolu) {
          return NextResponse.json(
            { error: "E-Club firmanız için kapalıdır." },
            { status: 403 }
          );
        }
        return NextResponse.redirect(new URL("/ana-sayfa", request.url));
      }
    }
    // eclub_aktif = true veya firma yok → geç
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