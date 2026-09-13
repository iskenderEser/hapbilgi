// instrumentation.ts
//
// Next.js sunucu başlatma kancası (instrumentation).
// npm run dev ile başlayan local development ortamında tek örneği (singleton)
// bulunan güvenli local transkript kuyruk worker'ını devreye alır.
// Production ortamında (Vercel) KESİNLİKLE çalışmaz; üretimde yalnız Vercel Cron devrededir.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NODE_ENV === "development") {
      const { baslatLocalTranskriptWorker } = await import("@/lib/ogrenmeAraci/localTranskriptWorker");
      baslatLocalTranskriptWorker();
    }
  }
}
