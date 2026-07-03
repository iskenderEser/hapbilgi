// app/eclub/listem/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";
import { useEclubListem } from "./_hooks/useEclubListem";
import { EczaneBlogu } from "./_components/EczaneBlogu";
import { glnGecerliMi, KISI_ROL_ETIKETLERI, type GlnSorguSonuc } from "./_types";

const ECLUB_UTT_ROLLERI = ["utt", "kd_utt"];

export default function EclubListemPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();

  const rolUygun = !!kullanici && ECLUB_UTT_ROLLERI.includes((kullanici.rol ?? "").toLowerCase());
  const hazir = !authYukleniyor && rolUygun;

  const {
    eczaneler, kisiler, loading, islemLoading,
    glnSorgula, eczaneEkle, eczaneListedenCikar, kisiEkle, kisiGuncelle, kisiPasifeAl,
  } = useEclubListem({ hazir, hata, basari });

  // Yeni eczane formu (ana "+") — GLN-öncelikli, master otomatik doldurma
  const [eczaneFormAcik, setEczaneFormAcik] = useState(false);
  const [yeniGln, setYeniGln] = useState("");
  const [sorguSonuc, setSorguSonuc] = useState<GlnSorguSonuc | null>(null);
  const [sorguLoading, setSorguLoading] = useState(false);
  // Elle ekleme alanları (master_yok durumunda)
  const [elleAd, setElleAd] = useState("");
  const [elleIl, setElleIl] = useState("");
  const [elleIlce, setElleIlce] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.push("/login"); return; }
    if (!rolUygun) { router.push("/ana-sayfa"); return; }
  }, [kullanici, authYukleniyor, rolUygun, router]);

  const handleCikis = async () => {
    await cikisYap();
    router.push("/login");
  };

  const kisilerByEczane = useMemo(() => {
    const map = new Map<string, typeof kisiler>();
    for (const k of kisiler) {
      const arr = map.get(k.eczane_id) ?? [];
      arr.push(k);
      map.set(k.eczane_id, arr);
    }
    return map;
  }, [kisiler]);

  const glnDegisti = (deger: string) => {
    const temiz = deger.replace(/\D/g, "").slice(0, 13);
    setYeniGln(temiz);
    setSorguSonuc(null);
    setElleAd(""); setElleIl(""); setElleIlce("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!glnGecerliMi(temiz)) return;
    setSorguLoading(true);
    debounceRef.current = setTimeout(async () => {
      const sonuc = await glnSorgula(temiz);
      setSorguSonuc(sonuc);
      setSorguLoading(false);
    }, 500);
  };

  const formTemizle = () => {
    setEczaneFormAcik(false);
    setYeniGln("");
    setSorguSonuc(null);
    setElleAd(""); setElleIl(""); setElleIlce("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  // Master onaylı eczaneyi listeye ekle
  const listemeEkle = async () => {
    const ok = await eczaneEkle(yeniGln);
    if (ok) formTemizle();
  };

  // Elle ekleme (master_yok) — admin onayına gönderir
  const onayaGonder = async () => {
    const ok = await eczaneEkle(yeniGln, { eczane_adi: elleAd.trim(), il: elleIl.trim(), ilce: elleIlce.trim() });
    if (ok) formTemizle();
  };

  if (authYukleniyor || !kullanici || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const glnTamam = glnGecerliMi(yeniGln);
  const elleGecerli = elleAd.trim().length > 0 && elleIl.trim().length > 0;

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={kullanici.email} rol={kullanici.rol} adSoyad={kullanici.adSoyad} onCikis={handleCikis} />

      <div className="max-w-4xl mx-auto px-3 py-4 md:px-6 md:py-6 flex flex-col gap-4">

        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-gray-900 m-0">E-Club Listem</h1>
          <p className="text-sm text-gray-500 m-0">Eczaneleri ve eczacı/teknisyen kişilerini buradan yönetin.</p>
        </div>

        {eczaneler.length === 0 && !eczaneFormAcik && (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
            <p className="text-sm text-gray-400 m-0">Henüz eczane eklenmedi. Aşağıdaki düğmeyle başlayın.</p>
          </div>
        )}

        {eczaneler.map((e) => (
          <EczaneBlogu
            key={e.eczane_id}
            eczane={e}
            kisiler={kisilerByEczane.get(e.eczane_id) ?? []}
            islemLoading={islemLoading}
            onListedenCikar={eczaneListedenCikar}
            onKisiEkle={kisiEkle}
            onKisiGuncelle={kisiGuncelle}
            onKisiPasifeAl={kisiPasifeAl}
          />
        ))}

        {/* Yeni eczane formu — GLN-öncelikli, master otomatik doldurma */}
        {eczaneFormAcik ? (
          <div className="bg-white border border-gray-200 rounded-xl px-4 md:px-5 py-4 flex flex-col gap-3">
            <p className="text-sm font-semibold text-gray-900 m-0">Yeni Eczane</p>

            <div>
              <label className="text-xs text-gray-500 block mb-1">GLN (13 hane)</label>
              <input value={yeniGln} onChange={(e) => glnDegisti(e.target.value)}
                placeholder="GLN girin, otomatik sorgulanır" maxLength={13} autoFocus
                className="border rounded-lg px-3 py-2 text-sm w-full md:w-72 box-border"
                style={{ fontFamily: "'Nunito', sans-serif", borderColor: yeniGln && !glnTamam ? "#fca5a5" : "#e5e7eb" }} />
              {yeniGln && !glnTamam && <p className="text-xs mt-1" style={{ color: "#bc2d0d" }}>GLN 13 haneli sayı olmalıdır.</p>}
            </div>

            {glnTamam && sorguLoading && <p className="text-xs text-gray-400 m-0">Sorgulanıyor…</p>}

            {/* DURUM 1: Master'da onaylı — otomatik doldurma */}
            {glnTamam && !sorguLoading && sorguSonuc?.var && sorguSonuc.eczane && (
              <div className="rounded-lg border border-gray-200 p-3 bg-gray-50 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900">{sorguSonuc.eczane.eczane_adi}</span>
                  <span className="text-xs text-gray-400 font-mono">{sorguSonuc.eczane.gln}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {sorguSonuc.eczane.il}{sorguSonuc.eczane.ilce ? ` / ${sorguSonuc.eczane.ilce}` : ""}
                </span>
                {(sorguSonuc.eczaci || (sorguSonuc.teknisyenler?.length ?? 0) > 0) ? (
                  <div className="flex flex-col gap-1">
                    {sorguSonuc.eczaci && (
                      <span className="text-xs text-gray-600">
                        <span className="text-red-600 font-medium">{KISI_ROL_ETIKETLERI.eczaci}:</span> {sorguSonuc.eczaci.ad} {sorguSonuc.eczaci.soyad}
                      </span>
                    )}
                    {(sorguSonuc.teknisyenler ?? []).map((t) => (
                      <span key={t.kisi_id} className="text-xs text-gray-600">
                        <span className="font-medium" style={{ color: "#10304a" }}>{KISI_ROL_ETIKETLERI.eczane_teknisyeni}:</span> {t.ad} {t.soyad}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">Bu eczanede kayıtlı kişi yok.</span>
                )}
                {sorguSonuc.listede ? (
                  <span className="text-xs text-gray-400">Bu eczane zaten listenizde.</span>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={listemeEkle} disabled={islemLoading}
                      className="px-4 py-2 rounded-lg border-none bg-green-700 text-white text-sm font-semibold cursor-pointer">Listeme ekle</button>
                    <button onClick={formTemizle}
                      className="px-4 py-2 rounded-lg border border-gray-200 bg-transparent text-gray-500 text-sm cursor-pointer">Vazgeç</button>
                  </div>
                )}
              </div>
            )}

            {/* DURUM 2: Master'da onay bekliyor */}
            {glnTamam && !sorguLoading && sorguSonuc && !sorguSonuc.var && sorguSonuc.onay_bekliyor && (
              <div className="rounded-lg border p-3 flex flex-col gap-1" style={{ borderColor: "#fde68a", background: "#fefce8" }}>
                <span className="text-sm font-medium" style={{ color: "#854d0e" }}>Bu eczane admin onayı bekliyor.</span>
                <span className="text-xs" style={{ color: "#854d0e" }}>Onaylanınca listenize ekleyebilirsiniz.</span>
                <button onClick={formTemizle} className="text-xs mt-1 self-start px-3 py-1.5 rounded-lg border border-gray-200 bg-transparent text-gray-500 cursor-pointer">Kapat</button>
              </div>
            )}

            {/* DURUM 3: Master'da yok — elle ekleme (admin onayına) */}
            {glnTamam && !sorguLoading && sorguSonuc && !sorguSonuc.var && sorguSonuc.master_yok && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-gray-500 m-0">Bu GLN resmi listede yok. Elle eklerseniz admin onayına gönderilir.</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <input value={elleAd} onChange={(e) => setElleAd(e.target.value)}
                    placeholder="Eczane adı" maxLength={200}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-40" style={{ fontFamily: "'Nunito', sans-serif" }} />
                  <input value={elleIl} onChange={(e) => setElleIl(e.target.value)}
                    placeholder="İl" maxLength={100}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32" style={{ fontFamily: "'Nunito', sans-serif" }} />
                  <input value={elleIlce} onChange={(e) => setElleIlce(e.target.value)}
                    placeholder="İlçe" maxLength={100}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32" style={{ fontFamily: "'Nunito', sans-serif" }} />
                </div>
                <div className="flex gap-2">
                  <button onClick={onayaGonder} disabled={islemLoading || !elleGecerli}
                    className="px-4 py-2 rounded-lg border-none bg-green-700 text-white text-sm font-semibold cursor-pointer"
                    style={{ opacity: !elleGecerli ? 0.5 : 1 }}>Onaya gönder</button>
                  <button onClick={formTemizle}
                    className="px-4 py-2 rounded-lg border border-gray-200 bg-transparent text-gray-500 text-sm cursor-pointer">Vazgeç</button>
                </div>
              </div>
            )}

            {!glnTamam && (
              <div className="flex justify-start">
                <button onClick={formTemizle} className="px-4 py-2 rounded-lg border border-gray-200 bg-transparent text-gray-500 text-sm cursor-pointer">Vazgeç</button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center">
            <button onClick={() => setEczaneFormAcik(true)}
              className="px-5 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm font-semibold cursor-pointer hover:bg-gray-50 transition-colors">
              + Yeni Eczane Ekle
            </button>
          </div>
        )}
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}