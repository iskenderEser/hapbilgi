// lib/ogrenmeAraci/localTranskriptWorker.ts
//
// Yalnız local development ortamında (npm run dev) çalışan, Vercel Cron
// bulunmadığında transkript kuyruğunu arka planda otomatik tüketen
// güvenli tekil (singleton) worker mekanizması.
// Production'da (NODE_ENV === 'production') KESİNLİKLE çalışmaz.
// Tarayıcı sayfasının açık olmasına bağlı değildir; sunucu sürecinde döner.
// Mevcut cron ve lease mekanizmasını doğrudan kullanır.

import { transkriptKuyrugunuTuket } from "@/lib/ogrenmeAraci/transkriptKuyrukIsleyici";

const GLOBAL_WORKER_KEY = Symbol.for("hapbilgi.localTranskriptWorker");

interface GlobalWorkerState {
  baslatildi: boolean;
  intervalId: NodeJS.Timeout | null;
  mesgul: boolean;
}

function getGlobalState(): GlobalWorkerState {
  const globalObj = globalThis as unknown as { [key: symbol]: GlobalWorkerState };
  if (!globalObj[GLOBAL_WORKER_KEY]) {
    globalObj[GLOBAL_WORKER_KEY] = {
      baslatildi: false,
      intervalId: null,
      mesgul: false,
    };
  }
  return globalObj[GLOBAL_WORKER_KEY];
}

/**
 * Local geliştirme worker'ını başlatır.
 * Production ortamında çağrılsa bile hiçbir işlem yapmaz.
 */
export function baslatLocalTranskriptWorker(secenekler?: {
  periyotMs?: number;
  zorla?: boolean;
}): boolean {
  // 1. Production Koruması: Production ortamında ASLA çalışmaz
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction && !secenekler?.zorla) {
    return false;
  }

  // 2. Yalnızca Node.js sunucu çalışma zamanında çalışır
  if (typeof window !== "undefined") {
    return false;
  }

  const state = getGlobalState();

  // 3. Tekillik (Singleton) Koruması: Zaten başlatılmışsa ikinci kez başlatma
  if (state.baslatildi) {
    return true;
  }

  state.baslatildi = true;
  const periyotMs = secenekler?.periyotMs ?? 3000;

  const kuyrukDongusu = async () => {
    if (state.mesgul) return;
    state.mesgul = true;
    try {
      await transkriptKuyrugunuTuket({
        maxSureMs: 10_000,
        maxIsSayisi: 3,
        leaseSaniye: 180,
      });
    } catch {
      // Worker sessizce sonraki periyodu bekler, sunucuyu çökertmez
    } finally {
      state.mesgul = false;
    }
  };

  // İlk döngüyü hemen tetikle, ardından periyodik sürdür
  void kuyrukDongusu();
  state.intervalId = setInterval(kuyrukDongusu, periyotMs);

  // Node.js sürecinin kapanmasını engellememesi için unref
  if (state.intervalId.unref) {
    state.intervalId.unref();
  }

  return true;
}

/**
 * Testler veya sunucu kapanışı için worker'ı durdurur.
 */
export function durdurLocalTranskriptWorker(): void {
  const state = getGlobalState();
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  state.baslatildi = false;
  state.mesgul = false;
}

/**
 * Worker'ın durumunu ve korumalarını sorgular.
 */
export function localTranskriptWorkerDurumu(): {
  calisiyor: boolean;
  singleton: boolean;
  productionKorumasi: boolean;
} {
  const state = getGlobalState();
  return {
    calisiyor: state.baslatildi,
    singleton: true,
    productionKorumasi: process.env.NODE_ENV === "production",
  };
}
