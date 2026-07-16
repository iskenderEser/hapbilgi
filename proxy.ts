import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_ROLLER, ECLUB_TUKETICI_ROLLERI, MUSTERI_ROLU, TUKETICI_ROLLER } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";

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
  // test-verileri-sil de bu bekçinin ARKASINDADIR (12.07.2026 — canlıda girişsiz
  // silme ucu bırakılamaz); deploy öncesi endpoint yine tamamen kaldırılacaktır.
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

  // --- E-Club Store firma bekçisi ------------------------------------------
  // /eclub/store/* (sayfa + API) yalnızca firması E-Club Store açık
  // (firmalar.eclub_store_aktif = true) olan kullanıcıya açıktır. Bu bekçi
  // /eclub bekçisinden ÖNCE gelir çünkü /eclub/store aynı zamanda /eclub ile
  // başlar; store kapalı ama E-Club açık firmada yalnızca store engellenir.
  // (E-Club de kapalıysa /eclub bekçisi zaten aşağıda tüm /eclub'ı keser.)
  if (pathname.startsWith("/eclub/store")) {
    const storeApiYolu = pathname.includes("/api/") || pathname.endsWith("/api");

    if (!user) {
      if (storeApiYolu) {
        return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const esSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: esKullanici } = await esSupabase
      .from("kullanicilar")
      .select("firma_id")
      .eq("kullanici_id", user.id)
      .single();

    if (esKullanici?.firma_id) {
      const { data: esFirma } = await esSupabase
        .from("firmalar")
        .select("eclub_store_aktif")
        .eq("firma_id", esKullanici.firma_id)
        .single();

      if (esFirma && esFirma.eclub_store_aktif === false) {
        if (storeApiYolu) {
          return NextResponse.json(
            { error: "E-Club Store firmanız için kapalıdır." },
            { status: 403 }
          );
        }
        return NextResponse.redirect(new URL("/ana-sayfa", request.url));
      }
    }
    // eclub_store_aktif = true veya firma yok → geç (akış /eclub bekçisine sürer)
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

  // --- Eczanem bekçisi (beşinci) --------------------------------------------
  // Eczanem bağımsız modüldür ve ROL tabanlı korunur: ne müşterinin ne
  // eczacının firma_id'si vardır, bu yüzden diğer bekçilerdeki firma-bayrağı
  // deseni burada uygulanamaz (eczanem_aktif bayrağı UTT ekranlarında, iç
  // uygulama tarafında devreye girer). Rol, tek kaynak rolCozucu'dan okunur.
  //
  // İki dal — sıralama kritiktir (/eclub/store dersi): önce özel prefix
  // /eczanem/eczane (eczacı/teknisyen, E-Club oturumu), sonra genel /eczanem
  // (müşteri). Girişsiz istisnalar: müşteri giriş sayfası/API'leri ve davet
  // kabulü — bunlar oturum ÖNCESİ akışlardır, koruma OTP mekanizmasındadır.
  if (pathname.startsWith("/eczanem")) {
    const girissizYol =
      pathname.startsWith("/eczanem/giris") ||
      pathname.startsWith("/eczanem/api/giris") ||
      pathname.startsWith("/eczanem/davet") ||
      pathname.startsWith("/eczanem/api/davet-kabul");

    if (!girissizYol) {
      const apiYolu = pathname.includes("/api/") || pathname.endsWith("/api");
      const eczaneDali = pathname.startsWith("/eczanem/eczane");
      const uttDali = pathname.startsWith("/eczanem/utt");
      // Eczacı ve UTT dalları iç uygulama oturumuyla (/login) girilir; müşteri
      // dalının kendi giriş ekranı vardır (/eczanem/giris).
      const icUygulamaDali = eczaneDali || uttDali;

      if (!user) {
        if (apiYolu) {
          return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
        }
        return NextResponse.redirect(new URL(icUygulamaDali ? "/login" : "/eczanem/giris", request.url));
      }

      const eczanemSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const rol = await rolCozucu(eczanemSupabase, user.id);

      if (eczaneDali) {
        if (!ECLUB_TUKETICI_ROLLERI.includes(rol)) {
          if (apiYolu) {
            return NextResponse.json({ error: "Bu bölüm eczacı/teknisyene açıktır." }, { status: 403 });
          }
          return NextResponse.redirect(new URL(rol === MUSTERI_ROLU ? "/eczanem" : "/ana-sayfa", request.url));
        }
      } else if (uttDali) {
        if (!TUKETICI_ROLLER.includes(rol)) {
          if (apiYolu) {
            return NextResponse.json({ error: "Bu bölüm UTT'ye açıktır." }, { status: 403 });
          }
          return NextResponse.redirect(
            new URL(ECLUB_TUKETICI_ROLLERI.includes(rol) ? "/eczanem/eczane" : rol === MUSTERI_ROLU ? "/eczanem" : "/ana-sayfa", request.url)
          );
        }
      } else if (rol !== MUSTERI_ROLU) {
        if (apiYolu) {
          return NextResponse.json({ error: "Bu bölüm Eczanem üyelerine açıktır." }, { status: 403 });
        }
        return NextResponse.redirect(
          new URL(ECLUB_TUKETICI_ROLLERI.includes(rol) ? "/eczanem/eczane" : "/ana-sayfa", request.url)
        );
      }
      // Rol uygun → geç
    }
  }
  // -------------------------------------------------------------------------

  return supabaseResponse;
}

export const config = {
  // sw.js + manifest.json + PWA ikonları statik dosyadır; oturum/rol katmanından
  // geçmeleri gereksiz (push planı P1 — SW kök scope'tan serbest sunulur).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|icon-192.png|icon-512.png|logo.png).*)"],
};