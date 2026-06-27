// components/challenge-club/ChallengeGonderModal.tsx
//
// BM'in başka bir BM'e challenge gönderme modalı.
// Tek ekran, iki dropdown: video + alıcı. Gönderilemeyenler disabled.
//
// Endpoint'ler:
//   - GET  /challenge-club/api/uygun-videolar
//   - GET  /challenge-club/api/uygun-aliciler?yayin_id=X
//   - POST /challenge-club/api  body: { yayin_id, alan_id }

"use client";

import { useEffect, useState } from "react";

interface UygunVideo {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
}

interface UygunAlici {
  kullanici_id: string;
  ad: string;
  soyad: string;
  gonderilebilir: boolean;
  sebep?: string;
}

interface Props {
  acik: boolean;
  onKapat: () => void;
  onGonderildi: () => void | Promise<void>;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export default function ChallengeGonderModal({
  acik,
  onKapat,
  onGonderildi,
  hata,
  basari,
}: Props) {
  const [videolar, setVideolar] = useState<UygunVideo[]>([]);
  const [aliciler, setAliciler] = useState<UygunAlici[]>([]);
  const [seciliVideoId, setSeciliVideoId] = useState<string>("");
  const [seciliAliciId, setSeciliAliciId] = useState<string>("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [aliciLoading, setAliciLoading] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  // Modal açıldığında videoları çek
  useEffect(() => {
    if (!acik) return;

    // State sıfırla
    setSeciliVideoId("");
    setSeciliAliciId("");
    setAliciler([]);

    const videolariYukle = async () => {
      setVideoLoading(true);
      try {
        const res = await fetch("/challenge-club/api/uygun-videolar");
        const d = await res.json();
        if (!res.ok) {
          hata(d.hata ?? "Videolar yüklenemedi.", d.adim, d.detay);
          setVideoLoading(false);
          return;
        }
        setVideolar(d.videolar ?? []);
      } catch (err) {
        hata("Videolar yüklenirken hata oluştu.", "fetch", String(err));
      }
      setVideoLoading(false);
    };

    videolariYukle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acik]);

  // Video seçildiğinde alıcıları çek
  useEffect(() => {
    if (!seciliVideoId) {
      setAliciler([]);
      return;
    }

    const alicilariYukle = async () => {
      setAliciLoading(true);
      setSeciliAliciId("");
      try {
        const res = await fetch(
          `/challenge-club/api/uygun-aliciler?yayin_id=${seciliVideoId}`
        );
        const d = await res.json();
        if (!res.ok) {
          hata(d.hata ?? "Alıcılar yüklenemedi.", d.adim, d.detay);
          setAliciLoading(false);
          return;
        }
        setAliciler(d.aliciler ?? []);
      } catch (err) {
        hata("Alıcılar yüklenirken hata oluştu.", "fetch", String(err));
      }
      setAliciLoading(false);
    };

    alicilariYukle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seciliVideoId]);

  const handleGonder = async () => {
    if (!seciliVideoId || !seciliAliciId) return;

    setGonderiliyor(true);
    try {
      const res = await fetch("/challenge-club/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yayin_id: seciliVideoId,
          alan_id: seciliAliciId,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Challenge gönderilemedi.", d.adim, d.detay);
        setGonderiliyor(false);
        return;
      }
      basari("Challenge başarıyla gönderildi.");
      setGonderiliyor(false);
      await onGonderildi();
      onKapat();
    } catch (err) {
      hata("Gönderim sırasında hata oluştu.", "fetch", String(err));
      setGonderiliyor(false);
    }
  };

  if (!acik) return null;

  const seciliAlici = aliciler.find((a) => a.kullanici_id === seciliAliciId);
  const gonderilebilirMi =
    seciliVideoId &&
    seciliAliciId &&
    seciliAlici?.gonderilebilir &&
    !gonderiliyor;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-md flex flex-col"
        style={{ maxHeight: "90vh" }}
      >
        {/* Başlık */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-gray-900">
              Challenge Gönder
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Tamamladığın bir videoyu başka bir BM'ye gönder.
            </div>
          </div>
          <button
            onClick={onKapat}
            disabled={gonderiliyor}
            className="text-gray-500 text-lg cursor-pointer border-none bg-transparent p-1"
            style={{ opacity: gonderiliyor ? 0.4 : 1 }}
          >
            ✕
          </button>
        </div>

        {/* İçerik */}
        <div className="px-5 py-5 flex flex-col gap-4 overflow-y-auto">
          {/* Video seçici */}
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1.5">
              Video
            </label>
            {videoLoading ? (
              <div className="text-xs text-gray-500 py-2">Yükleniyor...</div>
            ) : videolar.length === 0 ? (
              <div
                className="text-xs px-3 py-2.5 rounded-lg"
                style={{
                  background: "#fefce8",
                  border: "0.5px solid #fde68a",
                  color: "#854d0e",
                }}
              >
                Henüz tamamladığın bir CC videosu yok. Önce bir CC videosunu
                izleyip tamamlamalısın.
              </div>
            ) : (
              <select
                value={seciliVideoId}
                onChange={(e) => setSeciliVideoId(e.target.value)}
                disabled={gonderiliyor}
                className="w-full px-3 py-2.5 text-sm rounded-lg border bg-white cursor-pointer"
                style={{
                  border: "0.5px solid #e5e7eb",
                  fontFamily: "'Nunito', sans-serif",
                  color: "#374151",
                }}
              >
                <option value="">Seçiniz...</option>
                {videolar.map((v) => (
                  <option key={v.yayin_id} value={v.yayin_id}>
                    {v.urun_adi} — {v.teknik_adi}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Alıcı seçici */}
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1.5">
              Alıcı BM
            </label>
            {!seciliVideoId ? (
              <div
                className="text-xs px-3 py-2.5 rounded-lg"
                style={{
                  background: "#f3f4f6",
                  border: "0.5px solid #e5e7eb",
                  color: "#6b7280",
                }}
              >
                Önce video seçiniz.
              </div>
            ) : aliciLoading ? (
              <div className="text-xs text-gray-500 py-2">Yükleniyor...</div>
            ) : aliciler.length === 0 ? (
              <div
                className="text-xs px-3 py-2.5 rounded-lg"
                style={{
                  background: "#fefce8",
                  border: "0.5px solid #fde68a",
                  color: "#854d0e",
                }}
              >
                Firmanızda gönderilebilecek başka bir BM yok.
              </div>
            ) : (
              <select
                value={seciliAliciId}
                onChange={(e) => setSeciliAliciId(e.target.value)}
                disabled={gonderiliyor}
                className="w-full px-3 py-2.5 text-sm rounded-lg border bg-white cursor-pointer"
                style={{
                  border: "0.5px solid #e5e7eb",
                  fontFamily: "'Nunito', sans-serif",
                  color: "#374151",
                }}
              >
                <option value="">Seçiniz...</option>
                {aliciler.map((a) => (
                  <option
                    key={a.kullanici_id}
                    value={a.kullanici_id}
                    disabled={!a.gonderilebilir}
                  >
                    {a.ad} {a.soyad}
                    {!a.gonderilebilir ? ` — ${a.sebep ?? "uygun değil"}` : ""}
                  </option>
                ))}
              </select>
            )}

            {/* Seçili alıcı için sebep göster (disabled bir kullanıcıyı yine de görmek için) */}
            {seciliAlici && !seciliAlici.gonderilebilir && (
              <div
                className="text-xs px-3 py-2 rounded-lg mt-2"
                style={{
                  background: "#fef2f2",
                  border: "0.5px solid #fecaca",
                  color: "#bc2d0d",
                }}
              >
                {seciliAlici.sebep ?? "Bu BM'e gönderilemez."}
              </div>
            )}
          </div>
        </div>

        {/* Aksiyon barı */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-2.5 justify-end">
          <button
            onClick={onKapat}
            disabled={gonderiliyor}
            className="px-4 py-2 rounded-lg border bg-transparent text-gray-500 text-xs cursor-pointer"
            style={{
              border: "0.5px solid #e5e7eb",
              fontFamily: "'Nunito', sans-serif",
              opacity: gonderiliyor ? 0.4 : 1,
            }}
          >
            İptal
          </button>
          <button
            onClick={handleGonder}
            disabled={!gonderilebilirMi}
            className="px-5 py-2 rounded-lg border-none text-white text-xs font-semibold cursor-pointer"
            style={{
              background: "#56aeff",
              opacity: gonderilebilirMi ? 1 : 0.5,
              fontFamily: "'Nunito', sans-serif",
            }}
          >
            {gonderiliyor ? "Gönderiliyor..." : "Gönder"}
          </button>
        </div>
      </div>
    </div>
  );
}