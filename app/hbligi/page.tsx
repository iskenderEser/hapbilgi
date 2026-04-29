// app/hbligi/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

interface LigSatiri {
  sira: number;
  lig_id: string;
  kullanici_id: string;
  ad: string;
  rol: string;
  bolge: string;
  takim: string;
  firma: string;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puani: number;
  toplam_puan: number;
  guncelleme_tarihi: string;
}

interface Filtreler {
  bolgeler: { bolge_id: string; bolge_adi: string }[];
  takimlar: { takim_id: string; takim_adi: string }[];
  firmalar: { firma_id: string; firma_adi: string }[];
}

export default function HBLigiPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState<string>("");
  const [lig, setLig] = useState<LigSatiri[]>([]);
  const [filtreler, setFiltreler] = useState<Filtreler>({ bolgeler: [], takimlar: [], firmalar: [] });
  const [loading, setLoading] = useState(true);
  const [secilenBolge, setSecilenBolge] = useState("");
  const [secilenTakim, setSecilenTakim] = useState("");
  const [secilenFirma, setSecilenFirma] = useState("");

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

  const veriCek = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (secilenBolge) params.set("bolge_id", secilenBolge);
    if (secilenTakim) params.set("takim_id", secilenTakim);
    if (secilenFirma) params.set("firma_id", secilenFirma);
    const res = await fetch(`/hbligi/api?${params.toString()}`);
    const data = await res.json();
    setLig(data.lig ?? []);
    setFiltreler(data.filtreler ?? { bolgeler: [], takimlar: [], firmalar: [] });
    setLoading(false);
  };

  useEffect(() => { if (user) veriCek(); }, [user, secilenBolge, secilenTakim, secilenFirma]);

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  const siraRenk = (sira: number) => {
    if (sira === 1) return "#f59e0b";
    if (sira === 2) return "#9ca3af";
    if (sira === 3) return "#b45309";
    return "#e5e7eb";
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
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ""} rol={rol} onCikis={handleCikis} />

      <div className="max-w-4xl mx-auto px-3 py-4 md:px-6 md:py-6 flex flex-col gap-4">

        {/* Başlık */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 m-0">HBLigi</h1>
            {lig.length > 0 && lig[0].guncelleme_tarihi && (
              <p className="text-xs text-gray-400 mt-1 mb-0">Son güncelleme: {formatTarih(lig[0].guncelleme_tarihi)}</p>
            )}
          </div>
          <span className="text-xs text-gray-500">{lig.length} kişi</span>
        </div>

        {/* Filtreler */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 md:px-5 py-3.5 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Firma</label>
            <select value={secilenFirma} onChange={(e) => { setSecilenFirma(e.target.value); setSecilenTakim(""); setSecilenBolge(""); }}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 bg-white"
              style={{ fontFamily: "'Nunito', sans-serif", minWidth: 140 }}>
              <option value="">Tümü</option>
              {filtreler.firmalar.map(f => <option key={f.firma_id} value={f.firma_id}>{f.firma_adi}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Takım</label>
            <select value={secilenTakim} onChange={(e) => { setSecilenTakim(e.target.value); setSecilenBolge(""); }}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 bg-white"
              style={{ fontFamily: "'Nunito', sans-serif", minWidth: 140 }}>
              <option value="">Tümü</option>
              {filtreler.takimlar.map(t => <option key={t.takim_id} value={t.takim_id}>{t.takim_adi}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Bölge</label>
            <select value={secilenBolge} onChange={(e) => setSecilenBolge(e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 bg-white"
              style={{ fontFamily: "'Nunito', sans-serif", minWidth: 140 }}>
              <option value="">Tümü</option>
              {filtreler.bolgeler.map(b => <option key={b.bolge_id} value={b.bolge_id}>{b.bolge_adi}</option>)}
            </select>
          </div>
          {(secilenBolge || secilenTakim || secilenFirma) && (
            <button onClick={() => { setSecilenBolge(""); setSecilenTakim(""); setSecilenFirma(""); }}
              className="px-3 py-1.5 rounded-lg border border-gray-200 bg-transparent text-gray-500 text-xs cursor-pointer"
              style={{ fontFamily: "'Nunito', sans-serif" }}>
              Filtreyi Temizle
            </button>
          )}
        </div>

        {/* Lig tablosu */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {lig.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">Henüz lig verisi bulunmuyor.</div>
          ) : (
            <>
              {/* Mobile: kart görünümü */}
              <div className="md:hidden">
                {lig.map((l) => (
                  <div key={l.lig_id} className="px-4 py-3 border-b border-gray-50"
                    style={{ background: l.kullanici_id === user?.id ? "#f0f9ff" : "white" }}>
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: siraRenk(l.sira) }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: l.sira <= 3 ? "white" : "#737373" }}>{l.sira}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-900 truncate" style={{ fontWeight: l.kullanici_id === user?.id ? 700 : 500 }}>
                          {l.ad}
                          {l.kullanici_id === user?.id && <span className="text-xs ml-1" style={{ color: "#56aeff" }}>sen</span>}
                        </span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: "#56aeff" }}>{l.toplam_puan}</span>
                    </div>
                    <div className="flex gap-3 ml-9">
                      <span className="text-xs text-gray-400">{l.bolge}</span>
                      <span className="text-xs text-gray-400">{l.takim}</span>
                    </div>
                    <div className="flex gap-4 ml-9 mt-1">
                      {[
                        { label: "İzleme", val: l.izleme_puani },
                        { label: "Cevap", val: l.cevaplama_puani },
                        { label: "Öneri", val: l.oneri_puani },
                        { label: "Extra", val: l.extra_puani },
                      ].map(({ label, val }) => (
                        <div key={label} className="flex flex-col">
                          <span className="text-xs text-gray-400">{label}</span>
                          <span className="text-xs text-gray-700 font-medium">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: tablo görünümü */}
              <div className="hidden md:block">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-center px-3 py-2.5 text-gray-400 font-medium" style={{ width: 40 }}>#</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Ad Soyad</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Bölge</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Takım</th>
                      <th className="text-center px-2 py-2.5 text-gray-400 font-medium">İzleme</th>
                      <th className="text-center px-2 py-2.5 text-gray-400 font-medium">Cevap</th>
                      <th className="text-center px-2 py-2.5 text-gray-400 font-medium">Öneri</th>
                      <th className="text-center px-2 py-2.5 text-gray-400 font-medium">Extra</th>
                      <th className="text-center px-3 py-2.5 text-gray-400 font-medium">Toplam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lig.map((l) => (
                      <tr key={l.lig_id} className="border-b border-gray-50"
                        style={{ background: l.kullanici_id === user?.id ? "#f0f9ff" : "white" }}>
                        <td className="px-3 py-3 text-center">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center mx-auto"
                            style={{ background: siraRenk(l.sira) }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: l.sira <= 3 ? "white" : "#737373" }}>{l.sira}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-gray-900" style={{ fontWeight: l.kullanici_id === user?.id ? 700 : 500 }}>
                          {l.ad}
                          {l.kullanici_id === user?.id && <span className="text-xs ml-1" style={{ color: "#56aeff" }}>sen</span>}
                        </td>
                        <td className="px-3 py-3 text-gray-500">{l.bolge}</td>
                        <td className="px-3 py-3 text-gray-500">{l.takim}</td>
                        <td className="px-2 py-3 text-center text-gray-700">{l.izleme_puani}</td>
                        <td className="px-2 py-3 text-center text-gray-700">{l.cevaplama_puani}</td>
                        <td className="px-2 py-3 text-center text-gray-700">{l.oneri_puani}</td>
                        <td className="px-2 py-3 text-center text-gray-700">{l.extra_puani}</td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-sm font-bold" style={{ color: "#56aeff" }}>{l.toplam_puan}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}