// lib/video/videoPlayer.ts
//
// PROVIDER-AGNOSTIK VIDEO OYNATICI ARAYÜZÜ
//
// Bu modül, video kaynağının provider'ından (Bunny.net, Mux, Cloudflare Stream,
// Vimeo, vb.) bağımsız bir oynatıcı arayüzü sunar. Tüketici kod (VideoOynatici)
// hangi provider olduğunu bilmek zorunda kalmaz; sadece `VideoPlayer` arayüzünü
// kullanır.
//
// MİMARİ:
//   1. `VideoPlayer` — Tüm adapter'ların uyacağı ortak sözleşme (event'lar + metodlar)
//   2. `Provider` adapter sınıfları — Her provider için bir tane (şu an sadece Bunny)
//   3. `createVideoPlayer(iframe, url)` — Fabrika; URL'den provider tespit eder
//
// YENİ PROVIDER EKLEMEK İÇİN:
//   1. `detectProvider(url)` fonksiyonuna yeni URL deseni ekle
//   2. `VideoPlayer` arayüzünü uygulayan yeni bir adapter sınıfı yaz
//   3. `createVideoPlayer` fabrika fonksiyonunda yeni `case` ekle
//   Diğer hiçbir yere dokunmaya gerek yoktur. VideoOynatici otomatik destekler.
//
// ÖRNEK ADAPTER İLERİDE EKLENEBİLECEK PROVIDER'LAR:
//   - Mux:               URL deseni `stream.mux.com/...` veya `*.mux.com/*`
//   - Cloudflare Stream: URL deseni `*.cloudflarestream.com/...`
//   - Vimeo:             URL deseni `player.vimeo.com/video/...` veya `vimeo.com/...`
//   - YouTube:           URL deseni `youtube.com/embed/...` veya `youtu.be/...`
//   - JW Player:         URL deseni `cdn.jwplayer.com/players/...`
//   - Wistia:            URL deseni `fast.wistia.net/embed/...`

// ─── ORTAK ARAYÜZ ────────────────────────────────────────────────────────────

/**
 * Tüm video oynatıcı adapter'larının uyduğu sözleşme.
 * Provider'a bağlı detaylar (postMessage, playerjs, native HTML5, vb.)
 * bu arayüzün arkasında gizlenir.
 */
export interface VideoPlayer {
  /** Player kullanıma hazır olduğunda çağrılır. Diğer event'ları bağlamak için bu callback içinde yapın. */
  onReady(callback: () => void): void;

  /** Her video saniye güncellemesinde tetiklenir. data.seconds: mevcut konum (s). */
  onTimeUpdate(callback: (data: { seconds: number }) => void): void;

  /** Video sona erdiğinde tetiklenir. NOT: Bazı provider'lar bu event'ı her zaman göndermez —
   *  bu yüzden tüketici kod manuel bitiş tespiti (timeupdate + duration) de yapmalıdır. */
  onEnded(callback: () => void): void;

  /** Kullanıcı seek bar'ını sürüklediğinde tetiklenir. */
  onSeeked(callback: () => void): void;

  /** Video toplam uzunluğunu (saniye) döner — async callback. */
  getDuration(callback: (duration: number) => void): void;

  /** Mevcut oynatma konumunu (saniye) döner — async callback. */
  getCurrentTime(callback: (current: number) => void): void;

  /** Oynatma konumunu (saniye) ayarlar. */
  setCurrentTime(seconds: number): void;

  /** Tüm dinleyicileri kaldırır, bellek temizliği yapar. */
  destroy(): void;
}

// ─── PROVIDER TESPİTİ ────────────────────────────────────────────────────────

export type Provider = "bunny" | "mux" | "cloudflareStream" | "vimeo" | "youtube" | "jwPlayer" | "wistia" | "bilinmeyen";

/**
 * URL'e bakarak hangi provider olduğunu tespit eder.
 * Tanımlanmamış URL'ler "bilinmeyen" döner — fabrika hata fırlatır.
 */
export function detectProvider(url: string): Provider {
  if (!url) return "bilinmeyen";

  // Bunny.net — üç farklı URL formatı:
  //   - iframe.mediadelivery.net/embed/...  → playerjs API destekler
  //   - player.mediadelivery.net/embed/...  → playerjs API destekler (yeni player)
  //   - player.mediadelivery.net/play/...   → playerjs desteklemez; lib içeride embed'e çevirir
  if (url.includes("iframe.mediadelivery.net") || url.includes("player.mediadelivery.net")) {
    return "bunny";
  }

  // İleride eklenecek provider'lar — şimdilik placeholder:
  // if (url.includes("stream.mux.com") || url.includes(".mux.com")) return "mux";
  // if (url.includes("cloudflarestream.com")) return "cloudflareStream";
  // if (url.includes("player.vimeo.com") || url.includes("vimeo.com")) return "vimeo";
  // if (url.includes("youtube.com/embed") || url.includes("youtu.be")) return "youtube";
  // if (url.includes("cdn.jwplayer.com")) return "jwPlayer";
  // if (url.includes("fast.wistia.net") || url.includes("wistia.com")) return "wistia";

  return "bilinmeyen";
}

// ─── BUNNY ADAPTER ───────────────────────────────────────────────────────────

/**
 * Bunny URL'lerini playerjs'in anlayabileceği `embed/` formatına çevirir.
 *
 *   /play/  → /embed/   (yeni player'ın paylaşım URL'i playerjs ile çalışmaz,
 *                        embed formatına çevrilince çalışır)
 *
 * iframe.mediadelivery.net/embed/... ve player.mediadelivery.net/embed/...
 * zaten geçerli; dokunulmaz.
 */
export function bunnyEmbedUrl(url: string): string {
  if (url.includes("/play/")) {
    return url.replace("/play/", "/embed/");
  }
  return url;
}

const PLAYERJS_URL = "https://assets.mediadelivery.net/playerjs/playerjs-latest.min.js";

/** playerjs script'inin tek seferlik yüklenmesi için promise — birden çok adapter aynı script'i bekler. */
let playerjsYukleniyor: Promise<void> | null = null;

function playerjsYukle(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("playerjs server tarafında yüklenemez."));

  // Zaten yüklü mü?
  if ((window as any).playerjs) return Promise.resolve();

  // Yüklenme zaten başlamış mı?
  if (playerjsYukleniyor) return playerjsYukleniyor;

  // Sayfada zaten <script> tag'i var mı? (başka bir lib eklemiş olabilir)
  const mevcut = document.querySelector(`script[src="${PLAYERJS_URL}"]`);
  if (mevcut) {
    playerjsYukleniyor = new Promise((resolve) => {
      const interval = setInterval(() => {
        if ((window as any).playerjs) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
    return playerjsYukleniyor;
  }

  // Yeni script ekle
  playerjsYukleniyor = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PLAYERJS_URL;
    script.async = true;
    script.onload = () => {
      if ((window as any).playerjs) resolve();
      else reject(new Error("playerjs script yüklendi ama window.playerjs tanımsız."));
    };
    script.onerror = () => reject(new Error("playerjs script yüklenemedi."));
    document.head.appendChild(script);
  });

  return playerjsYukleniyor;
}

/**
 * Bunny.net video oynatıcısı için adapter.
 * playerjs kütüphanesini kullanır. Üç URL formatını da destekler:
 *   - iframe.mediadelivery.net/embed/...
 *   - player.mediadelivery.net/embed/...
 *   - player.mediadelivery.net/play/...  (içeride embed'e çevrilir)
 */
class BunnyAdapter implements VideoPlayer {
  private iframe: HTMLIFrameElement;
  private player: any = null;
  private hazirCallback: (() => void) | null = null;
  private bekleyenEventler: Array<() => void> = [];

  constructor(iframe: HTMLIFrameElement, url: string) {
    this.iframe = iframe;

    // URL'i embed formatına çevir (gerekiyorsa)
    const embedUrl = bunnyEmbedUrl(url);
    if (embedUrl !== iframe.src) {
      iframe.src = embedUrl;
    }

    // playerjs'i yükle, sonra player'ı kur
    playerjsYukle()
      .then(() => {
        this.player = new (window as any).playerjs.Player(this.iframe);
        this.player.on("ready", () => {
          // ready callback'i kuruluyse çağır
          if (this.hazirCallback) this.hazirCallback();
          // Bekleyen event kayıtlarını şimdi yap
          this.bekleyenEventler.forEach((fn) => fn());
          this.bekleyenEventler = [];
        });
      })
      .catch((err) => {
        console.error("[BunnyAdapter] playerjs yüklenemedi:", err);
      });
  }

  onReady(callback: () => void): void {
    this.hazirCallback = callback;
  }

  onTimeUpdate(callback: (data: { seconds: number }) => void): void {
    const kur = () => this.player?.on("timeupdate", callback);
    if (this.player) kur();
    else this.bekleyenEventler.push(kur);
  }

  onEnded(callback: () => void): void {
    const kur = () => this.player?.on("ended", callback);
    if (this.player) kur();
    else this.bekleyenEventler.push(kur);
  }

  onSeeked(callback: () => void): void {
    const kur = () => this.player?.on("seeked", callback);
    if (this.player) kur();
    else this.bekleyenEventler.push(kur);
  }

  getDuration(callback: (duration: number) => void): void {
    this.player?.getDuration(callback);
  }

  getCurrentTime(callback: (current: number) => void): void {
    this.player?.getCurrentTime(callback);
  }

  setCurrentTime(seconds: number): void {
    this.player?.setCurrentTime(seconds);
  }

  destroy(): void {
    // playerjs'in resmi destroy metodu yok; off ile event'leri kaldırırız.
    try {
      this.player?.off("ready");
      this.player?.off("timeupdate");
      this.player?.off("ended");
      this.player?.off("seeked");
    } catch (e) {
      // playerjs sürümüne göre off metodu davranışı değişebilir; sessiz geç.
    }
    this.player = null;
    this.hazirCallback = null;
    this.bekleyenEventler = [];
  }
}

// ─── FABRİKA ─────────────────────────────────────────────────────────────────

/**
 * Verilen iframe ve URL için doğru adapter'ı kurar ve döner.
 *
 * Bilinmeyen URL → Error fırlatır. Tüketici try/catch ile yakalamalı,
 * kullanıcıya açık bir hata göstermeli ("Bu video kaynağı şu an desteklenmiyor").
 *
 * KULLANIM:
 *   const player = createVideoPlayer(iframeRef.current, video.video_url);
 *   player.onReady(() => {
 *     player.getDuration(sure => console.log("Süre:", sure));
 *     player.onTimeUpdate(data => console.log("Konum:", data.seconds));
 *     player.onEnded(() => console.log("Bitti"));
 *   });
 *
 * @throws Error bilinmeyen provider için
 */
export function createVideoPlayer(iframe: HTMLIFrameElement, url: string): VideoPlayer {
  const provider = detectProvider(url);

  switch (provider) {
    case "bunny":
      return new BunnyAdapter(iframe, url);

    // İleride eklenecek case'ler:
    //
    // case "mux":
    //   return new MuxAdapter(iframe, url);
    //   // Mux Player Web Component (<mux-player>) veya postMessage API kullanır.
    //   // Döküman: https://docs.mux.com/guides/video/mux-player
    //
    // case "cloudflareStream":
    //   return new CloudflareStreamAdapter(iframe, url);
    //   // Stream Player SDK kullanır (window.Stream).
    //   // Döküman: https://developers.cloudflare.com/stream/viewing-videos/using-the-stream-player/
    //
    // case "vimeo":
    //   return new VimeoAdapter(iframe, url);
    //   // Vimeo Player SDK kullanır (@vimeo/player paketi).
    //   // Döküman: https://developer.vimeo.com/player/sdk
    //
    // case "youtube":
    //   return new YouTubeAdapter(iframe, url);
    //   // YouTube IFrame Player API kullanır.
    //   // Döküman: https://developers.google.com/youtube/iframe_api_reference
    //
    // case "jwPlayer":
    //   return new JwPlayerAdapter(iframe, url);
    //
    // case "wistia":
    //   return new WistiaAdapter(iframe, url);

    case "bilinmeyen":
    default:
      throw new Error(
        `Desteklenmeyen video kaynağı: ${url}\n\n` +
        `Şu anda yalnızca Bunny.net (iframe.mediadelivery.net veya player.mediadelivery.net) destekleniyor. ` +
        `Diğer provider'lar (Mux, Cloudflare Stream, Vimeo, YouTube, JW Player, Wistia) ileride eklenebilir — ` +
        `eklemek için lib/video/videoPlayer.ts dosyasındaki talimata bakın.`
      );
  }
}
