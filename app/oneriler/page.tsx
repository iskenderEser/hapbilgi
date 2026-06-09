// app/oneriler/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";

interface Oneri {
  oneri_id: string;
  yayin_id: string;
  oneren_id: string;
  kullanici_id: string;
  oneri_baslangic: string;
  oneri_bitis: string;
  izlendi_mi: boolean;
  created_at: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  kullanici_adi: string;
  video_puani?: number | null;
  begeni_sayisi: number;
  favori_sayisi: number;
  begeni_mi: boolean;
  favori_mi: boolean;
}

interface Yayin {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
}

interface Kullanici {
  kullanici_id: string;
  ad: string;
  soyad: string;
  rol: string;
}

type DurumTipi = "izlendi" | "bekliyor" | "sureSiGecti";

const DURUM_BILGI: Record<DurumTipi, { etiket: string; renk: string; bg: string; border: string }> = {
  izlendi:     { etiket: "İzlendi",      renk: "#56aeff", bg: "#e6f1fb", border: "#56aeff" },
  bekliyor:    { etiket: "Bekliyor",     renk: "#737373", bg: "#f9fafb", border: "#e5e7eb" },
  sureSiGecti: { etiket: "Süresi Geçti", renk: "#bc2d0d", bg: "#fce8e3", border: "#bc2d0d" },
};

export default function OnerilerPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState<string>("");
  const [oneriler, setOneriler] = useState<Oneri[]>([]);
  const [yayinlar, setYayinlar] = useState<Yayin[]>([]);
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
  const [loading, setLoading] = useState(true);
  const [gonderLoading, setGonderLoading] = useState(false);
  const [secilenYayinlar, setSecilenYayinlar] = useState<string[]>([]);
  const [secilenKullanici, setSecilenKullanici] = useState<string>("");
  const [oneriBaslangic, setOneriBaslangic] = useState("");
  const [oneriBitis, setOneriBitis] = useState("");
  const { mesajlar, hata, basari } = useHataMesaji();

  // BM/TM tablo filtreleri ve sıralama
  const [filtreUTT, setFiltreUTT] = useState<string>("");
  const [filtreUrun, setFiltreUrun] = useState<string>("");
  const [filtreTeknik, setFiltreTeknik] = useState<string>("");
  const [filtreDurum, setFiltreDurum] = useState<"" | DurumTipi>("");
  const [sortKey, setSortKey] = useState<"baslangic" | "bitis" | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const handleBegeni = async (e: React.MouseEvent, yayin_id: string) => {
    e.stopPropagation();
    const res = await fetch("/izle/api/begeni", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yayin_id }) });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Beğeni işlemi başarısız.", d.adim, d.detay); return; }
    setOneriler(prev => prev.map(o => o.yayin_id === yayin_id ? { ...o, begeni_mi: d.begeni_mi, begeni_sayisi: d.begeni_mi ? o.begeni_sayisi + 1 : o.begeni_sayisi - 1 } : o));
  };

  const handleFavori = async (e: React.MouseEvent, yayin_id: string) => {
    e.stopPropagation();
    const res = await fetch("/izle/api/favori", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yayin_id }) });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Favori işlemi başarısız.", d.adim, d.detay); return; }
    setOneriler(prev => prev.map(o => o.yayin_id === yayin_id ? { ...o, favori_mi: d.favori_mi, favori_sayisi: d.favori_mi ? o.favori_sayisi + 1 : o.favori_sayisi - 1 } : o));
  };

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      setUser(data.user);
      setRol(data.user.user_metadata?.rol ?? "");
    });
  }, []);

  const handleCikis = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const veriCek = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/oneriler/api");
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Öneriler yüklenemedi.", data.adim, data.detay); }
    else { setOneriler(data.oneriler ?? []); }

    const rolKucu = (user?.user_metadata?.rol ?? "").toLowerCase();
    if (["tm", "bm"].includes(rolKucu)) {
      const yRes = await fetch("/oneriler/api/yayinlar");
      const yData = await yRes.json();
      if (!yRes.ok) { hata(yData.hata ?? "Yayınlar yüklenemedi.", yData.adim, yData.detay); }
      else { setYayinlar(yData.videolar ?? []); }

      const kRes = await fetch(`/kullanicilar/api?kapsamim=true&rol=utt,kd_utt`);
      const kData = await kRes.json();
      if (!kRes.ok) { hata(kData.hata ?? "Kullanıcılar yüklenemedi.", kData.adim, kData.detay); }
      else { setKullanicilar(kData.kullanicilar ?? []); }
    }
    setLoading(false);
  }, [user?.user_metadata?.rol]);

  useEffect(() => { if (user) veriCek(); }, [user, veriCek]);

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const formatTarihKisa = (tarih: string) => {
    const date = new Date(tarih);
    if (isNaN(date.getTime())) return "Geçersiz tarih";
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
  };

  const formatTarihTablo = (tarih: string) => {
    const date = new Date(tarih);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const rolKucu = rol.toLowerCase();
  const isBMTM = ["tm", "bm"].includes(rolKucu);
  const isUTT = ["utt", "kd_utt"].includes(rolKucu);

  const sureciGectiMi = (bitis: string) => new Date(bitis) < new Date();
  const henuzBaslamadiMi = (baslangic: string) => new Date(baslangic) > new Date();

  const kartDurumu = (o: Oneri): { renk: string; etiket: string; soluk: boolean } => {
    if (o.izlendi_mi) return { renk: "#56aeff", etiket: "İzlendi", soluk: false };
    if (sureciGectiMi(o.oneri_bitis)) return { renk: "#bc2d0d", etiket: "Süresi Geçti", soluk: true };
    if (henuzBaslamadiMi(o.oneri_baslangic)) return { renk: "#f59e0b", etiket: `${formatTarihKisa(o.oneri_baslangic)}'da izleyebilirsiniz`, soluk: true };
    return { renk: "#737373", etiket: "İzlenecek", soluk: false };
  };

  // BM/TM tablo için durum tipi (3 değer)
  const durumTipi = (o: Oneri): DurumTipi => {
    if (o.izlendi_mi) return "izlendi";
    if (sureciGectiMi(o.oneri_bitis)) return "sureSiGecti";
    return "bekliyor";
  };

  // Benzersiz değerler (dropdown seçenekleri)
  const benzersizUTTler = useMemo(
    () => Array.from(new Set(oneriler.map(o => o.kullanici_adi))).filter(Boolean).sort(),
    [oneriler]
  );
  const benzersizUrunler = useMemo(
    () => Array.from(new Set(oneriler.map(o => o.urun_adi))).filter(Boolean).sort(),
    [oneriler]
  );
  const benzersizTeknikler = useMemo(
    () => Array.from(new Set(oneriler.map(o => o.teknik_adi))).filter(Boolean).sort(),
    [oneriler]
  );

  // Filtreli ve sıralı liste
  const filtreliSiraliOneriler = useMemo(() => {
    let result = oneriler;
    if (filtreUTT) result = result.filter(o => o.kullanici_adi === filtreUTT);
    if (filtreUrun) result = result.filter(o => o.urun_adi === filtreUrun);
    if (filtreTeknik) result = result.filter(o => o.teknik_adi === filtreTeknik);
    if (filtreDurum) result = result.filter(o => durumTipi(o) === filtreDurum);
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const aVal = sortKey === "baslangic" ? a.oneri_baslangic : a.oneri_bitis;
        const bVal = sortKey === "baslangic" ? b.oneri_baslangic : b.oneri_bitis;
        const cmp = new Date(aVal).getTime() - new Date(bVal).getTime();
        return sortOrder === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [oneriler, filtreUTT, filtreUrun, filtreTeknik, filtreDurum, sortKey, sortOrder]);

  const toggleSort = (key: "baslangic" | "bitis") => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  const sortIcon = (key: "baslangic" | "bitis") => {
    if (sortKey !== key) return " ↕";
    return sortOrder === "asc" ? " ↑" : " ↓";
  };

  const handleYayinSec = (yayin_id: string) => {
    setSecilenYayinlar(prev => {
      if (prev.includes(yayin_id)) return prev.filter(id => id !== yayin_id);
      if (prev.length >= 3) { hata("Tek seferde en fazla 3 video önerilebilir."); return prev; }
      return [...prev, yayin_id];
    });
  };

  const handleBaslangicDegis = (deger: string) => {
    setOneriBaslangic(deger);
    if (oneriBitis && deger >= oneriBitis) setOneriBitis("");
  };

  const yarinStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const bitisMinStr = oneriBaslangic 
    ? new Date(new Date(oneriBaslangic).getTime() + 86400000).toISOString().slice(0, 10) 
    : "";

  const handleOneriGonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secilenKullanici || secilenYayinlar.length === 0 || !oneriBaslangic || !oneriBitis) return;
    setGonderLoading(true);

    const onerilerListesi = secilenYayinlar.map(yayin_id => ({
      yayin_id, 
      kullanici_id: secilenKullanici,
      oneri_baslangic: oneriBaslangic,
      oneri_bitis: oneriBitis,
    }));

    const res = await fetch("/oneriler/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ oneriler: onerilerListesi }) });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Öneri gönderilemedi.", d.adim, d.detay); }
    else {
      basari(`${d.oneriler?.length ?? 0} öneri başarıyla gönderildi.`);
      setSecilenYayinlar([]); setSecilenKullanici(""); setOneriBaslangic(""); setOneriBitis("");
      await veriCek();
    }
    setGonderLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ""} rol={rol} onCikis={handleCikis} />

      <div className="max-w-5xl mx-auto px-3 py-4 md:px-6 md:py-6 flex flex-col gap-5">

        {/* BM/TM — Yeni Öneri Formu */}
        {isBMTM && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 md:px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">Yeni Öneri</span>
              <span className="text-xs text-gray-500">Max 3 video, tek seferde</span>
            </div>

            <form onSubmit={handleOneriGonder} className="px-4 md:px-5 py-4 flex flex-col gap-3.5">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Kişi</label>
                <select value={secilenKullanici} onChange={(e) => setSecilenKullanici(e.target.value)} required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
                  style={{ fontFamily: "'Nunito', sans-serif" }}>
                  <option value="">Seçiniz</option>
                  {kullanicilar.map(k => <option key={k.kullanici_id} value={k.kullanici_id}>{k.ad} {k.soyad} ({k.rol})</option>)}
                </select>
              </div>

              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">İzlenme Başlangıç Günü</label>
                  <input type="date" value={oneriBaslangic} onChange={(e) => handleBaslangicDegis(e.target.value)} required
                    min={yarinStr}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    style={{ fontFamily: "'Nunito', sans-serif" }} />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">İzlenme Bitiş Günü</label>
                  <input type="date" value={oneriBitis} onChange={(e) => setOneriBitis(e.target.value)} required 
                    min={bitisMinStr}
                    disabled={!oneriBaslangic}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    style={{ fontFamily: "'Nunito', sans-serif" }} />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-2">
                  Videolar — {secilenYayinlar.length} / 3 seçildi
                </label>
                <div className="flex flex-col gap-1.5">
                  {yayinlar.length === 0 ? (
                    <p className="text-xs text-gray-400">Yayında video bulunmuyor.</p>
                  ) : (
                    yayinlar.map((y) => {
                      const secili = secilenYayinlar.includes(y.yayin_id);
                      return (
                        <div key={y.yayin_id} onClick={() => handleYayinSec(y.yayin_id)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer border transition-colors"
                          style={{ border: secili ? "1.5px solid #56aeff" : "0.5px solid #e5e7eb", background: secili ? "#e6f1fb" : "white" }}>
                          <div className="w-12 h-7 rounded flex-shrink-0 overflow-hidden bg-gray-200">
                            {y.thumbnail_url ? <img src={y.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full" style={{ background: "#b5d4f4" }} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold truncate" style={{ color: secili ? "#56aeff" : "#111" }}>{y.urun_adi}</div>
                            <div className="text-xs text-gray-500">{y.teknik_adi}</div>
                          </div>
                          <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ border: secili ? "none" : "0.5px solid #e5e7eb", background: secili ? "#56aeff" : "white" }}>
                            {secili && <svg width="8" height="8" viewBox="0 0 10 8" fill="white"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" /></svg>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button type="submit" disabled={gonderLoading || secilenYayinlar.length === 0 || !secilenKullanici}
                  className="text-white border-none rounded-lg px-5 py-2.5 text-xs font-semibold cursor-pointer"
                  style={{ background: "#56aeff", opacity: secilenYayinlar.length === 0 || !secilenKullanici ? 0.5 : 1, fontFamily: "'Nunito', sans-serif" }}>
                  {gonderLoading ? "Gönderiliyor..." : `${secilenYayinlar.length} Öneri Gönder`}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* BM/TM — Gönderilen Öneriler Tablosu */}
        {isBMTM && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 md:px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Gönderilen Öneriler</span>
              <span className="text-xs text-gray-500">
                {filtreliSiraliOneriler.length}{filtreliSiraliOneriler.length !== oneriler.length ? ` / ${oneriler.length}` : ""} kayıt
              </span>
            </div>

            {oneriler.length === 0 ? (
              <div className="p-10 text-center text-sm text-gray-400">Henüz öneri gönderilmedi.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ fontFamily: "'Nunito', sans-serif" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Önerilen Video</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">
                        <select
                          value={filtreUTT}
                          onChange={(e) => setFiltreUTT(e.target.value)}
                          className="bg-transparent border-none font-semibold text-gray-600 cursor-pointer outline-none"
                          style={{ fontFamily: "'Nunito', sans-serif", fontSize: "inherit" }}
                        >
                          <option value="">Önerilen UTT/KD_UTT</option>
                          {benzersizUTTler.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">
                        <select
                          value={filtreUrun}
                          onChange={(e) => setFiltreUrun(e.target.value)}
                          className="bg-transparent border-none font-semibold text-gray-600 cursor-pointer outline-none"
                          style={{ fontFamily: "'Nunito', sans-serif", fontSize: "inherit" }}
                        >
                          <option value="">Ürün</option>
                          {benzersizUrunler.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">
                        <select
                          value={filtreTeknik}
                          onChange={(e) => setFiltreTeknik(e.target.value)}
                          className="bg-transparent border-none font-semibold text-gray-600 cursor-pointer outline-none"
                          style={{ fontFamily: "'Nunito', sans-serif", fontSize: "inherit" }}
                        >
                          <option value="">Teknik</option>
                          {benzersizTeknikler.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </th>
                      <th
                        className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap cursor-pointer select-none"
                        onClick={() => toggleSort("baslangic")}
                      >
                        Başlangıç{sortIcon("baslangic")}
                      </th>
                      <th
                        className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap cursor-pointer select-none"
                        onClick={() => toggleSort("bitis")}
                      >
                        Bitiş{sortIcon("bitis")}
                      </th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">
                        <select
                          value={filtreDurum}
                          onChange={(e) => setFiltreDurum(e.target.value as "" | DurumTipi)}
                          className="bg-transparent border-none font-semibold text-gray-600 cursor-pointer outline-none"
                          style={{ fontFamily: "'Nunito', sans-serif", fontSize: "inherit" }}
                        >
                          <option value="">Durum</option>
                          <option value="izlendi">İzlendi</option>
                          <option value="bekliyor">Bekliyor</option>
                          <option value="sureSiGecti">Süresi Geçti</option>
                        </select>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtreliSiraliOneriler.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-10 text-center text-sm text-gray-400">
                          Filtre ile eşleşen öneri bulunamadı.
                        </td>
                      </tr>
                    ) : (
                      filtreliSiraliOneriler.map((o) => {
                        const dt = durumTipi(o);
                        const dbi = DURUM_BILGI[dt];
                        return (
                          <tr key={o.oneri_id} style={{ borderBottom: "1px solid #f3f4f6" }} className="hover:bg-gray-50">
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <div className="w-14 h-8 rounded overflow-hidden bg-gray-200">
                                {o.thumbnail_url ? <img src={o.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full" style={{ background: "#b5d4f4" }} />}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-gray-900 whitespace-nowrap">{o.kullanici_adi}</td>
                            <td className="px-3 py-2.5 text-gray-900 whitespace-nowrap">{o.urun_adi}</td>
                            <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{o.teknik_adi}</td>
                            <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{formatTarihTablo(o.oneri_baslangic)}</td>
                            <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{formatTarihTablo(o.oneri_bitis)}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span
                                className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: dbi.bg, color: dbi.renk, border: `0.5px solid ${dbi.border}` }}
                              >
                                {dbi.etiket}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* UTT — Kart Görünümü */}
        {isUTT && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Gelen Öneriler</span>
              <span className="text-xs text-gray-500">{oneriler.length} öneri</span>
            </div>

            {oneriler.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">
                Henüz öneri gelmedi.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {oneriler.map((o) => {
                  const { renk, etiket, soluk } = kartDurumu(o);
                  return (
                    <div key={o.oneri_id}
                      className="bg-white rounded-xl overflow-hidden transition-shadow duration-150"
                      style={{ border: `1.5px solid ${renk}`, opacity: soluk ? 0.6 : 1, cursor: soluk ? "default" : "pointer" }}
                      onClick={() => { if (!soluk) router.push(`/ana-sayfa?yayin_id=${o.yayin_id}&oneri_id=${o.oneri_id}`); }}
                      onMouseEnter={e => { if (!soluk) (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; }}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "none"}>

                      {/* Thumbnail */}
                      <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/9", background: "#b5d4f4" }}>
                        {o.thumbnail_url
                          ? <>
                              <img src={o.thumbnail_url} alt="thumbnail" className="w-full h-full object-cover" onError={(e) => {
                                const img = e.currentTarget as HTMLImageElement;
                                img.style.display = 'none';
                                const fallback = img.parentElement?.querySelector('.thumbnail-fallback') as HTMLElement | null;
                                if (fallback) fallback.style.display = 'block';
                              }} />
                              <div className="thumbnail-fallback w-full h-full absolute inset-0" style={{ display: 'none', background: "linear-gradient(135deg, #b5d4f4, #56aeff)" }} />
                            </>
                          : <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #b5d4f4, #56aeff)" }} />
                        }
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
                            <svg width="10" height="12" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z" /></svg>
                          </div>
                        </div>
                        <div className="absolute top-2 left-2">
                          <span className="text-white rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: renk, fontSize: 10 }}>{etiket}</span>
                        </div>
                      </div>

                      {/* Bilgi */}
                      <div className="px-3 py-2.5 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-gray-900 truncate">{o.urun_adi}</div>
                          <div className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">{o.teknik_adi}</div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs text-gray-500 truncate">
                            <span className="text-gray-400">Öneren:</span> {o.kullanici_adi}
                          </div>
                          <div className="text-xs flex-shrink-0" style={{ color: "#bc2d0d" }}>{formatTarihKisa(o.oneri_bitis)}'e kadar</div>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          {o.video_puani != null ? (
                            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 text-xs text-gray-500">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#56aeff" strokeWidth="2">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                              Video <span className="font-semibold text-gray-900 ml-0.5">{o.video_puani}</span>
                            </div>
                          ) : <div />}
                          <div className="flex items-center gap-2.5">
                            <div className="flex items-center gap-1 cursor-pointer" onClick={(e) => handleBegeni(e, o.yayin_id)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill={o.begeni_mi ? "#bc2d0d" : "none"} stroke="#bc2d0d" strokeWidth="2">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                              </svg>
                              <span className="text-xs" style={{ color: o.begeni_mi ? "#bc2d0d" : "#737373", fontWeight: o.begeni_mi ? 600 : 400 }}>{o.begeni_sayisi}</span>
                            </div>
                            <div className="flex items-center gap-1 cursor-pointer" onClick={(e) => handleFavori(e, o.yayin_id)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill={o.favori_mi ? "#56aeff" : "none"} stroke={o.favori_mi ? "#56aeff" : "#737373"} strokeWidth="2">
                                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                                <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                              </svg>
                              <span className="text-xs" style={{ color: o.favori_mi ? "#56aeff" : "#737373", fontWeight: o.favori_mi ? 600 : 400 }}>{o.favori_sayisi}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}