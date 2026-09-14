"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { BekleyenDosya } from "../_types";
import { istemcideMetinCikar } from "@/lib/ogrenmeAraci/transkriptIstemciCikarici";
import {
  konusmaciAdiniTemizle,
  konusmaciAdlariGecerliMi,
  konusmaciEtiketiniGuncelle,
  konusmaciMetniniNormalizeEt,
  metindeIkiKonusmaciVarMi,
  metindekiIkiKonusmaciyiBul,
} from "@/lib/ogrenmeAraci/konusmaciAyraci";

interface PodcastTranskriptEditoruProps {
  bekleyenDosya: BekleyenDosya | null;
  metin: string;
  onaylandi: boolean;
  aiIstendi?: boolean;
  aracId?: string;
  islemDurumu?:
    | "bosta"
    | "taslak_hazirlaniyor"
    | "podcast_yukleniyor"
    | "podcast_dogrulaniyor"
    | "ai_kuyrukta"
    | "ai_isleniyor"
    | "transkript_hazir"
    | "hata";
  yuklemeYuzdesi?: number;
  onAiBaslat?: () => void | Promise<void>;
  aiYukleniyor?: boolean;
  hataMesaji?: string | null;
  onDosyaSec: (dosya: File, cikarilanMetin?: string) => void;
  onMetinDegisti: (yeniMetin: string) => void;
  onOnayla: () => void;
  onIptalEt: () => void;
  onAiIstendiDegisti?: (istendi: boolean) => void;
  onSunucuOnayla?: (metin: string) => Promise<{ ok: boolean; hata?: string }>;
  onSunucuIptal?: () => Promise<{ ok: boolean; hata?: string }>;
  acik?: boolean;
  onAcikDegisti?: (acik: boolean) => void;
  sekme?: "ai" | "dosya" | "metin";
  onSekmeDegisti?: (sekme: "ai" | "dosya" | "metin") => void;
}

export function PodcastTranskriptEditoru({
  bekleyenDosya,
  metin,
  onaylandi,
  aiIstendi = false,
  aracId,
  islemDurumu = "bosta",
  yuklemeYuzdesi = 0,
  onAiBaslat,
  aiYukleniyor: ustAiYukleniyor,
  hataMesaji: ustHataMesaji,
  onDosyaSec,
  onMetinDegisti,
  onOnayla,
  onIptalEt,
  onAiIstendiDegisti,
  onSunucuOnayla,
  onSunucuIptal,
  acik: propsAcik,
  onAcikDegisti,
  sekme: propsSekme,
  onSekmeDegisti,
}: PodcastTranskriptEditoruProps) {
  const [yerelAcik, setYerelAcik] = useState<boolean>(
    Boolean(bekleyenDosya || metin || aiIstendi || (islemDurumu && islemDurumu !== "bosta"))
  );
  const acik = propsAcik !== undefined ? propsAcik : yerelAcik;
  const setAcik = (val: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof val === "function" ? val(acik) : val;
    setYerelAcik(nextVal);
    onAcikDegisti?.(nextVal);
  };

  const [yukleniyor, setYukleniyor] = useState<boolean>(false);
  const [hata, setHata] = useState<string | null>(null);
  const [basariMesaji, setBasariMesaji] = useState<string | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState<boolean>(false);
  const [yerelSekme, setYerelSekme] = useState<"ai" | "dosya" | "metin">(
    aiIstendi || (islemDurumu && islemDurumu !== "bosta") || (metin && metindeIkiKonusmaciVarMi(metin))
      ? "ai"
      : bekleyenDosya
      ? "dosya"
      : metin
      ? "metin"
      : "ai"
  );
  const sekme = propsSekme !== undefined ? propsSekme : yerelSekme;
  const setSekme = (val: "ai" | "dosya" | "metin") => {
    setYerelSekme(val);
    onSekmeDegisti?.(val);
  };

  useEffect(() => {
    if (islemDurumu && islemDurumu !== "bosta") {
      setAcik(true);
      setSekme("ai");
    } else if (aiIstendi) {
      setAcik(true);
      setSekme("ai");
    } else if (metin) {
      setAcik(true);
      if (metindeIkiKonusmaciVarMi(metin)) {
        setSekme("ai");
      }
    } else if (bekleyenDosya) {
      setAcik(true);
      setSekme("dosya");
    }
  }, [islemDurumu, aiIstendi, metin, bekleyenDosya]);

  // Komut 4: Transkript durumunu yalnız useTalepFormu yönetsin.
  // İkinci polling mekanizması kaldırıldı.
  const [yerelAiYukleniyor, setYerelAiYukleniyor] = useState<boolean>(false);
  const aiYukleniyor = ustAiYukleniyor ?? yerelAiYukleniyor;

  const aiIslemde =
    islemDurumu === "taslak_hazirlaniyor" ||
    islemDurumu === "podcast_yukleniyor" ||
    islemDurumu === "podcast_dogrulaniyor" ||
    islemDurumu === "ai_kuyrukta" ||
    islemDurumu === "ai_isleniyor";

  const aiDurumu =
    onaylandi
      ? "onaylandi"
      : islemDurumu === "hata"
      ? "hata"
      : islemDurumu === "ai_kuyrukta"
      ? "ai_bekliyor"
      : islemDurumu === "ai_isleniyor"
      ? "ai_isleniyor"
      : islemDurumu === "transkript_hazir"
      ? "ai_taslak"
      : "bosta";

  // İki konuşmacı ayrımı ve isteğe bağlı adlandırma
  const [ikiKonusmaciVar, setIkiKonusmaciVar] = useState<boolean>(() => {
    return Boolean(
      (aiIstendi || (islemDurumu && islemDurumu !== "bosta") || (metin && metindeIkiKonusmaciVarMi(metin))) &&
      !aiIslemde &&
      metin &&
      metindeIkiKonusmaciVarMi(metin)
    );
  });
  const [konusmaci1Input, setKonusmaci1Input] = useState<string>("");
  const [konusmaci2Input, setKonusmaci2Input] = useState<string>("");
  const oncekiEtiket1Ref = useRef<string>("Konuşmacı 1");
  const oncekiEtiket2Ref = useRef<string>("Konuşmacı 2");
  const [konusmaciHatasi, setKonusmaciHatasi] = useState<string | null>(null);
  const [gorunumModu, setGorunumModu] = useState<"onizleme" | "duzenle">("onizleme");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const yuksekligiAyarla = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const yeniYukseklik = Math.max(140, el.scrollHeight);
    el.style.height = `${yeniYukseklik}px`;
  }, []);

  useEffect(() => {
    yuksekligiAyarla();
  }, [metin, gorunumModu, yuksekligiAyarla]);

  useEffect(() => {
    // Komut 4: Sekme AI değilse, metin yoksa, yeni işlem sürüyorsa veya
    // metinde iki konuşmacı etiketi yoksa konuşmacı adlandırma alanını kapat.
    if (sekme !== "ai" || !metin || aiIslemde) {
      setIkiKonusmaciVar(false);
      setKonusmaciHatasi(null);
      return;
    }

    if (!metindeIkiKonusmaciVarMi(metin)) {
      setIkiKonusmaciVar(false);
      setKonusmaciHatasi(null);
      return;
    }

    const algilanan = metindekiIkiKonusmaciyiBul(metin);
    if (!algilanan) {
      setIkiKonusmaciVar(false);
      setKonusmaciHatasi(null);
      return;
    }

    setIkiKonusmaciVar(true);
    if (oncekiEtiket1Ref.current === "Konuşmacı 1" && algilanan.etiket1 !== "Konuşmacı 1" && !konusmaci1Input) {
      setKonusmaci1Input(algilanan.etiket1);
    }
    if (oncekiEtiket2Ref.current === "Konuşmacı 2" && algilanan.etiket2 !== "Konuşmacı 2" && !konusmaci2Input) {
      setKonusmaci2Input(algilanan.etiket2);
    }
    oncekiEtiket1Ref.current = algilanan.etiket1;
    oncekiEtiket2Ref.current = algilanan.etiket2;
  }, [metin, sekme, aiIslemde, konusmaci1Input, konusmaci2Input]);

  const etiketleriUygula = (ad1: string, ad2: string, guncelMetin: string) => {
    const dogrulama = konusmaciAdlariGecerliMi(ad1, ad2);
    if (!dogrulama.gecerli) {
      setKonusmaciHatasi(dogrulama.hata ?? null);
      return;
    }
    setKonusmaciHatasi(null);

    const yeni1 = konusmaciAdiniTemizle(ad1) || "Konuşmacı 1";
    const yeni2 = konusmaciAdiniTemizle(ad2) || "Konuşmacı 2";

    let araMetin = guncelMetin;
    if (oncekiEtiket1Ref.current !== yeni1) {
      araMetin = konusmaciEtiketiniGuncelle(araMetin, oncekiEtiket1Ref.current, yeni1);
      oncekiEtiket1Ref.current = yeni1;
    }
    if (oncekiEtiket2Ref.current !== yeni2) {
      araMetin = konusmaciEtiketiniGuncelle(araMetin, oncekiEtiket2Ref.current, yeni2);
      oncekiEtiket2Ref.current = yeni2;
    }

    if (araMetin !== guncelMetin) {
      onMetinDegisti(araMetin);
      setBasariMesaji(null);
    }
  };

  const handleKonusmaci1Degisti = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ham = e.target.value;
    setKonusmaci1Input(ham);
    etiketleriUygula(ham, konusmaci2Input, metin);
  };

  const handleKonusmaci2Degisti = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ham = e.target.value;
    setKonusmaci2Input(ham);
    etiketleriUygula(konusmaci1Input, ham, metin);
  };

  // Komut 4: Transkript durumunu yalnız useTalepFormu yönetsin.
  // PodcastTranskriptEditoru içindeki ikinci polling mekanizması kaldırıldı.
  // Endpoint sorgulaması (/api/ogrenme-araclari/${aracId}/transkript-durum) useTalepFormu tarafından yürütülür.
  const aiDurumunuSorgula = useCallback(async () => {
    // İkinci polling kaldırıldı; tek otorite useTalepFormu hook'udur.
    if (!aracId) return;
  }, [aracId]);

  const aiBaslatTekrar = async () => {
    if (onAiBaslat) {
      void onAiBaslat();
      return;
    }
    if (!aracId) return;
    setHata(null);
    setBasariMesaji(null);
    setYerelAiYukleniyor(true);
    // Yeni AI girişimi başladığında önceki transkripti ekranda gösterme!
    onMetinDegisti("");
    setKonusmaci1Input("");
    setKonusmaci2Input("");
    setIkiKonusmaciVar(false);
    setKonusmaciHatasi(null);

    try {
      const res = await fetch(`/api/ogrenme-araclari/${aracId}/transkript-ai-baslat`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setHata(data.hata ?? "AI transkripti başlatılamadı.");
      }
    } catch {
      setHata("AI transkripti başlatılırken ağ hatası oluştu.");
    } finally {
      setYerelAiYukleniyor(false);
    }
  };

  const dosyaYukle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    setHata(null);
    setYukleniyor(true);
    try {
      const sonuc = await istemcideMetinCikar(dosya);
      if (!sonuc.ok) {
        setHata(sonuc.hata);
        onDosyaSec(dosya);
      } else {
        onDosyaSec(dosya, sonuc.metin);
      }
    } catch {
      onDosyaSec(dosya);
    } finally {
      setYukleniyor(false);
    }
  };

  const handleOnaylaVeKaydet = async () => {
    setHata(null);
    setBasariMesaji(null);

    if (konusmaciHatasi) {
      setHata(konusmaciHatasi);
      return;
    }

    const nihaiMetin = metin.trim();
    if (nihaiMetin.length < 10) {
      setHata("Transkript metni en az 10 karakter olmalıdır.");
      return;
    }

    setKaydediliyor(true);
    try {
      if (onSunucuOnayla) {
        const sonuc = await onSunucuOnayla(nihaiMetin);
        if (!sonuc.ok) {
          setHata(sonuc.hata ?? "Transkript onaylanırken hata oluştu.");
          return;
        }
        setBasariMesaji("Transkript başarıyla onaylandı ve sunucuya kaydedildi.");
        onOnayla();
      } else if (aracId) {
        const res = await fetch(`/api/ogrenme-araclari/${aracId}/transkript-yonet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ islem: "onayla", nihai_metin: nihaiMetin }),
        });
        const data = await res.json();
        if (!res.ok) {
          setHata(data.hata ?? "Transkript onaylanırken hata oluştu.");
          return;
        }
        setBasariMesaji("Transkript başarıyla onaylandı ve sunucuya kaydedildi.");
        onOnayla();
      } else {
        // aracId yokken kullanıcı onayı yalnızca form tercihi olarak yerel state'e kaydedilir.
        // Kesinlikle sunucu kayıt bildirimi veya yeşil başarı mesajı gösterilmez.
        setBasariMesaji(null);
        onOnayla();
      }
    } catch {
      setHata("Transkript sunucuya kaydedilirken ağ hatası oluştu.");
    } finally {
      setKaydediliyor(false);
    }
  };

  const handleIptalEt = async () => {
    setHata(null);
    setBasariMesaji(null);

    setKaydediliyor(true);
    try {
      if (onSunucuIptal) {
        const sonuc = await onSunucuIptal();
        if (!sonuc.ok) {
          setHata(sonuc.hata ?? "Transkript iptal edilirken hata oluştu.");
          return;
        }
      } else if (aracId) {
        const res = await fetch(`/api/ogrenme-araclari/${aracId}/transkript-yonet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ islem: "iptal_et" }),
        });
        const data = await res.json();
        if (!res.ok) {
          setHata(data.hata ?? "Transkript iptal edilirken hata oluştu.");
          return;
        }
      }
      onAiIstendiDegisti?.(false);
      onIptalEt();
      setAcik(false);
    } catch {
      setHata("Transkript iptal edilirken ağ hatası oluştu.");
    } finally {
      setKaydediliyor(false);
    }
  };

  if (!acik) {
    return null;
  }

  const aiHata = islemDurumu === "hata" || Boolean(ustHataMesaji);

  return (
    <div className="space-y-3 rounded-xl border border-[#d6e3f2] bg-white p-3.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#263b58]">Podcast Transkripti</span>
          {islemDurumu === "taslak_hazirlaniyor" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-ping" />
              Taslak hazırlanıyor
            </span>
          ) : islemDurumu === "podcast_yukleniyor" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-ping" />
              Podcast yükleniyor: %{yuklemeYuzdesi ?? 0}
            </span>
          ) : islemDurumu === "podcast_dogrulaniyor" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-ping" />
              Podcast doğrulanıyor
            </span>
          ) : islemDurumu === "ai_kuyrukta" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              AI işi kuyruğa alındı
            </span>
          ) : islemDurumu === "ai_isleniyor" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-ping" />
              AI transkripti hazırlanıyor
            </span>
          ) : islemDurumu === "transkript_hazir" ? (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
              ✓ Transkript hazır
            </span>
          ) : islemDurumu === "hata" ? (
            <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700 border border-red-200">
              Transkript oluşturulamadı
            </span>
          ) : aracId && (onaylandi || aiDurumu === "onaylandi") ? (
            <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700 border border-green-200">
              ✓ Onaylandı
            </span>
          ) : !aracId && onaylandi ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
              Transkript, talep oluşturulurken kaydedilecek
            </span>
          ) : aiIslemde ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-ping" />
              AI transkripti hazırlanıyor
            </span>
          ) : aiHata ? (
            <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 border border-red-200">
              Transkript oluşturulamadı
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
              Taslak (Onay Bekliyor)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={kaydediliyor}
            onClick={handleIptalEt}
            className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline cursor-pointer disabled:opacity-50"
          >
            İptal Et / Transkriptsiz Devam Et
          </button>
        </div>
      </div>

      {hata && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {hata}
        </div>
      )}

      {basariMesaji && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-2 text-xs font-semibold text-green-800">
          ✓ {basariMesaji}
        </div>
      )}

      {/* Yükleme / Oluşturma Yöntemi Seçimi */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setSekme("ai");
            onAiIstendiDegisti?.(true);
          }}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
            sekme === "ai"
              ? "bg-[#2483e2] text-white"
              : "bg-gray-100 text-[#425672] hover:bg-gray-200"
          }`}
        >
          ✨ AI ile Oluştur (Gemini 3.5)
        </button>
        <button
          type="button"
          onClick={() => {
            setSekme("dosya");
            onAiIstendiDegisti?.(false);
          }}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
            sekme === "dosya"
              ? "bg-[#2483e2] text-white"
              : "bg-gray-100 text-[#425672] hover:bg-gray-200"
          }`}
        >
          DOCX / PDF Yükle
        </button>
        <button
          type="button"
          onClick={() => {
            setSekme("metin");
            onAiIstendiDegisti?.(false);
          }}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
            sekme === "metin"
              ? "bg-[#2483e2] text-white"
              : "bg-gray-100 text-[#425672] hover:bg-gray-200"
          }`}
        >
          Doğrudan Metin Yapıştır
        </button>
      </div>

      {/* AI Modu İçeriği */}
      {sekme === "ai" && (
        <div className="rounded-lg border border-blue-200 bg-[#f4f8fe] p-3 space-y-2">
          {islemDurumu === "taslak_hazirlaniyor" ? (
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <div>
                <p className="text-xs font-bold text-blue-900">Taslak hazırlanıyor</p>
                <p className="text-[11px] text-blue-700">Kalıcı taslak oturumu sunucuda hazırlanıyor...</p>
              </div>
            </div>
          ) : islemDurumu === "podcast_yukleniyor" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                <span>Podcast yükleniyor: %{yuklemeYuzdesi ?? 0}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, yuklemeYuzdesi ?? 0))}%` }}
                />
              </div>
              <p className="text-[11px] text-blue-700">Dosya güvenli Bunny depolama alanına aktarılıyor.</p>
            </div>
          ) : islemDurumu === "podcast_dogrulaniyor" ? (
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <div>
                <p className="text-xs font-bold text-blue-900">Podcast doğrulanıyor</p>
                <p className="text-[11px] text-blue-700">Ses kaydı ve depolama bütünlüğü kontrol ediliyor...</p>
              </div>
            </div>
          ) : islemDurumu === "ai_kuyrukta" ? (
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              <div>
                <p className="text-xs font-bold text-amber-900">AI işi kuyruğa alındı</p>
                <p className="text-[11px] text-amber-700">
                  İş kalıcı kuyrukta bekliyor. Arka plan worker&apos;ı sırayla işleme alacaktır.
                </p>
              </div>
            </div>
          ) : islemDurumu === "ai_isleniyor" || aiIslemde ? (
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <div>
                <p className="text-xs font-bold text-blue-900">AI transkripti hazırlanıyor</p>
                <p className="text-[11px] text-blue-700">Gemini modeli ses kaydını metne dönüştürüyor...</p>
              </div>
            </div>
          ) : islemDurumu === "transkript_hazir" ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
              <p className="text-xs font-bold text-emerald-900">Transkript hazır</p>
              <p className="text-[11px] text-emerald-700">
                AI transkripti başarıyla oluşturuldu. Aşağıdaki metni inceleyip onaylayabilirsiniz.
              </p>
            </div>
          ) : islemDurumu === "hata" || aiHata ? (
            <div className="space-y-2">
              <p className="text-xs font-bold text-red-800">Transkript oluşturulamadı</p>
              <p className="text-[11px] text-red-600">
                {ustHataMesaji || hata || "AI transkripti oluşturulurken bir hata meydana geldi."}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={aiYukleniyor}
                  onClick={onAiBaslat ?? aiBaslatTekrar}
                  className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {aiYukleniyor ? "Başlatılıyor..." : "Tekrar Dene"}
                </button>
                <button
                  type="button"
                  disabled={kaydediliyor}
                  onClick={handleIptalEt}
                  className="text-xs font-medium text-red-600 hover:underline cursor-pointer"
                >
                  Transkriptsiz Devam Et
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-[#203b5b]">
                ✨ Gemini 3.5 Transcribe ile Otomatik AI Transkripti
              </p>
              <p className="mt-1 text-[11px] text-[#425672] leading-relaxed">
                Talep oluşturulup podcast sesiniz yüklendikten sonra transkript arka planda otomatik çıkarılacaktır.
                Sonuç size taslak olarak sunulur; inceleyip onaylamadan yayın süreci başlamaz.
              </p>
              <div className="mt-2.5">
                <button
                  type="button"
                  disabled={aiYukleniyor}
                  onClick={() => onAiBaslat?.()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#2483e2] bg-[#2483e2] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1a6ec7] disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {aiYukleniyor ? "Başlatılıyor..." : "✨ AI ile Transkript Oluştur"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dosya Yükleme Modu */}
      {sekme === "dosya" && (
        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-lg border border-[#56aeff] bg-white px-3 py-1.5 text-xs font-semibold text-[#2483e2] hover:bg-[#f0f7ff]">
              {yukleniyor ? "Dosya Okunuyor..." : "Dosya Seç (.docx, .pdf, .txt)"}
              <input
                type="file"
                accept=".docx,.pdf,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="hidden"
                disabled={yukleniyor}
                onChange={dosyaYukle}
              />
            </label>
            {bekleyenDosya && (
              <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700">
                <span className="max-w-56 truncate">{bekleyenDosya.preview.dosya_adi}</span>
                <span className="text-gray-400">({(bekleyenDosya.preview.boyut / 1024).toFixed(1)} KB)</span>
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-[#7a8ca5]">
            DOCX veya PDF dosyanızdaki metin otomatik olarak çıkarılıp aşağıdaki düzenleme alanına aktarılır.
          </p>
        </div>
      )}

      {/* İki Konuşmacı Adlandırma Alanı (Yalnızca AI modunda, işlem bittiğinde ve metinde iki konuşmacı etiketi varsa) */}
      {sekme === "ai" && ikiKonusmaciVar && !aiIslemde && metindeIkiKonusmaciVarMi(metin) && (
        <div className="rounded-lg border border-blue-100 bg-[#f8fbff] p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-xs font-semibold text-[#203b5b]">
              👥 Konuşmacı Adlandırma (İsteğe Bağlı)
            </span>
            <span className="text-[11px] text-[#7a8ca5]">
              Boş bırakılırsa varsayılan &quot;Konuşmacı 1&quot; ve &quot;Konuşmacı 2&quot; etiketleri korunur.
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-[#425672] mb-1">
                Konuşmacı 1 adı
              </label>
              <input
                type="text"
                maxLength={50}
                value={konusmaci1Input}
                onChange={handleKonusmaci1Degisti}
                placeholder="Konuşmacı 1 (Örn. Ahmet)"
                className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:border-[#2483e2] focus:outline-none focus:ring-1 focus:ring-[#2483e2]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#425672] mb-1">
                Konuşmacı 2 adı
              </label>
              <input
                type="text"
                maxLength={50}
                value={konusmaci2Input}
                onChange={handleKonusmaci2Degisti}
                placeholder="Konuşmacı 2 (Örn. Ayşe)"
                className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:border-[#2483e2] focus:outline-none focus:ring-1 focus:ring-[#2483e2]"
              />
            </div>
          </div>
          {konusmaciHatasi && (
            <p className="text-[11px] font-medium text-red-600">{konusmaciHatasi}</p>
          )}
        </div>
      )}

      {/* Metin Düzenleme Alanı */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <label className="font-semibold text-[#425672]">
              Transkript Metni {gorunumModu === "onizleme" && !aiIslemde && metin.trim().length > 0 ? "(Okuma Görünümü)" : "(Düzenlenebilir)"}
            </label>
            {metin.trim().length > 0 && !aiIslemde && (
              <div className="inline-flex rounded-md border border-gray-200 bg-gray-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setGorunumModu("onizleme")}
                  className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition cursor-pointer ${
                    gorunumModu === "onizleme"
                      ? "bg-white text-[#2483e2] shadow-sm font-semibold"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <span>👁️</span> Önizleme
                </button>
                <button
                  type="button"
                  onClick={() => setGorunumModu("duzenle")}
                  className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition cursor-pointer ${
                    gorunumModu === "duzenle"
                      ? "bg-white text-[#2483e2] shadow-sm font-semibold"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <span>✏️</span> Düzenle
                </button>
              </div>
            )}
          </div>
          <span className="text-[#7a8ca5]">{aiIslemde ? 0 : metin.length} / 100.000 karakter</span>
        </div>

        {gorunumModu === "onizleme" && !aiIslemde && metin.trim().length > 0 && (
          <div
            onClick={() => setGorunumModu("duzenle")}
            title="Metni doğrudan düzenlemek için tıklayın"
            className="group relative min-h-[140px] resize-y cursor-text overflow-y-auto rounded-lg border border-gray-300 bg-white p-3 text-xs leading-relaxed text-gray-800 transition hover:border-[#2483e2]"
          >
            <div className="pointer-events-none absolute right-2.5 top-2.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 opacity-70 group-hover:opacity-100 group-hover:bg-blue-50 group-hover:text-[#2483e2]">
              Düzenlemek için tıkla ✏️
            </div>
            {metin.split("\n").map((satir, idx) => {
              if (!satir.trim()) {
                return <div key={idx} className="h-2.5" />;
              }
              const match = satir.match(/^(\*\*[^*]+:\*\*|\*\*[^*]+\*\*:\s*|\*\*[^*]+\*\*)\s*(.*)$/);
              if (match) {
                const baslik = match[1].replace(/\*\*/g, "");
                return (
                  <div key={idx} className="py-0.5">
                    <strong className="font-bold text-gray-900">{baslik}</strong>
                    <span> {match[2]}</span>
                  </div>
                );
              }
              return (
                <div key={idx} className="py-0.5">
                  {satir}
                </div>
              );
            })}
          </div>
        )}

        <textarea
          ref={textareaRef}
          rows={6}
          value={aiIslemde ? "" : metin}
          disabled={aiIslemde || kaydediliyor}
          onChange={(e) => {
            onMetinDegisti(e.target.value);
            setBasariMesaji(null);
            yuksekligiAyarla();
          }}
          placeholder={
            aiIslemde
              ? "AI transkripti hazırlanıyor, lütfen bekleyin..."
              : sekme === "ai"
              ? "AI transkripti tamamlandığında metin buraya aktarılacaktır..."
              : "Transkript metnini buraya yapıştırın veya yukarıdan DOCX/PDF dosyası seçin..."
          }
          className={`w-full min-h-[140px] resize-y rounded-lg border border-gray-300 p-2.5 text-xs leading-relaxed text-gray-800 focus:border-[#2483e2] focus:outline-none focus:ring-1 focus:ring-[#2483e2] disabled:bg-gray-50 disabled:text-gray-400 ${
            gorunumModu === "onizleme" && !aiIslemde && metin.trim().length > 0 ? "hidden" : ""
          }`}
        />
      </div>

      {/* Onay Butonları */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className="text-[11px] text-[#7a8ca5]">
          {aracId && (onaylandi || aiDurumu === "onaylandi")
            ? "Metin onaylanmıştır. Değişiklik yaparsanız yeniden onaylamanız gerekir."
            : !aracId && onaylandi
            ? "Transkript, talep oluşturulurken kaydedilecek."
            : "Podcast ile birlikte yayınlanabilmesi için transkripti onaylamalısınız."}
        </p>
        <div>
          {aracId && (onaylandi || aiDurumu === "onaylandi") ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700">
              ✓ Onaylandı
            </span>
          ) : !aracId && onaylandi ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
              Transkript, talep oluşturulurken kaydedilecek
            </span>
          ) : (
            <button
              type="button"
              disabled={kaydediliyor || metin.trim().length < 10 || Boolean(konusmaciHatasi)}
              onClick={handleOnaylaVeKaydet}
              className="rounded-lg bg-[#2483e2] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1a6ec7] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {kaydediliyor ? "Kaydediliyor..." : "Onayla ve Kaydet"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
