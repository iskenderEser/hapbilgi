// app/eclub/listem/_components/EczaneBlogu.tsx
"use client";

import { useState } from "react";
import type { Eczane, Kisi, YeniKisiForm } from "../_types";
import { KISI_ROL_ETIKETLERI, epostaGecerliMi, telefonGecerliMi } from "../_types";

interface EczaneBloguProps {
  eczane: Eczane;
  kisiler: Kisi[]; // bu eczaneye ait aktif kişiler (page filtreler)
  islemLoading: boolean;
  onListedenCikar: (eczane_id: string) => Promise<boolean>;
  onKisiEkle: (eczane_id: string, form: YeniKisiForm) => Promise<boolean>;
  onKisiGuncelle: (kisi_id: string, eczane_id: string, alanlar: Partial<{ ad: string; soyad: string; eposta: string; telefon: string }>) => Promise<boolean>;
  onKisiPasifeAl: (kisi_id: string, eczane_id: string) => Promise<boolean>;
}

const BOS_KISI: YeniKisiForm = { rol: "", ad: "", soyad: "", eposta: "", telefon: "", sifre: "" };

export function EczaneBlogu({ eczane, kisiler, islemLoading, onListedenCikar, onKisiEkle, onKisiGuncelle, onKisiPasifeAl }: EczaneBloguProps) {
  // Kişi ekleme formu
  const [kisiFormAcik, setKisiFormAcik] = useState(false);
  const [yeniKisi, setYeniKisi] = useState<YeniKisiForm>(BOS_KISI);

  // Kişi satır düzenleme
  const [duzenlenenKisi, setDuzenlenenKisi] = useState<string | null>(null);
  const [kisiDuzenForm, setKisiDuzenForm] = useState<Partial<Kisi>>({});

  // Listeden çıkar onayı
  const [cikarOnay, setCikarOnay] = useState(false);

  const kisiKaydet = async () => {
    const ok = await onKisiEkle(eczane.eczane_id, yeniKisi);
    if (ok) { setYeniKisi(BOS_KISI); setKisiFormAcik(false); }
  };

  const kisiDuzenBaslat = (k: Kisi) => {
    setDuzenlenenKisi(k.kisi_id);
    setKisiDuzenForm({ ad: k.ad, soyad: k.soyad, eposta: k.eposta, telefon: k.telefon });
  };

  const kisiDuzenKaydet = async (kisi_id: string) => {
    const ok = await onKisiGuncelle(kisi_id, eczane.eczane_id, {
      ad: kisiDuzenForm.ad,
      soyad: kisiDuzenForm.soyad,
      eposta: kisiDuzenForm.eposta,
      telefon: kisiDuzenForm.telefon,
    });
    if (ok) { setDuzenlenenKisi(null); setKisiDuzenForm({}); }
  };

  const yeniKisiGecerli =
    yeniKisi.rol !== "" && yeniKisi.ad.trim() && yeniKisi.soyad.trim() &&
    epostaGecerliMi(yeniKisi.eposta) && telefonGecerliMi(yeniKisi.telefon) &&
    yeniKisi.sifre.length >= 6;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
      {/* Eczane başlık */}
      <div className="px-4 md:px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-gray-900">{eczane.eczane_adi}</span>
          <span className="text-xs text-gray-400 font-mono">{eczane.gln}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {eczane.toplam_kisi} kişi{eczane.eczaci_var ? "" : " · eczacı yok"}
          </span>
          {cikarOnay ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Emin misiniz?</span>
              <button onClick={async () => { const ok = await onListedenCikar(eczane.eczane_id); if (!ok) setCikarOnay(false); }}
                disabled={islemLoading}
                className="text-xs px-2.5 py-1 rounded-lg border-none text-white cursor-pointer" style={{ background: "#bc2d0d" }}>
                Evet, çıkar
              </button>
              <button onClick={() => setCikarOnay(false)}
                className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 bg-transparent text-gray-500 cursor-pointer">
                Vazgeç
              </button>
            </div>
          ) : (
            <button onClick={() => setCikarOnay(true)}
              className="text-xs px-2.5 py-1 rounded-lg bg-transparent cursor-pointer transition-colors"
              style={{ border: "0.5px solid #fecaca", color: "#bc2d0d" }}>
              Listemden çıkar
            </button>
          )}
        </div>
      </div>

      {/* Kişi satırları */}
      <div className="divide-y divide-gray-100">
        {kisiler.length === 0 && !kisiFormAcik && (
          <p className="text-sm text-gray-400 text-center py-4">Henüz kişi eklenmedi.</p>
        )}

        {kisiler.map((k) => (
          <div key={k.kisi_id} className="px-4 md:px-5 py-3">
            {duzenlenenKisi === k.kisi_id ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: k.rol === "eczaci" ? "#fff5f5" : "#eaf7e4", color: k.rol === "eczaci" ? "#e30a17" : "#10304a", border: `0.5px solid ${k.rol === "eczaci" ? "#e30a17" : "#7ed957"}` }}>
                  {KISI_ROL_ETIKETLERI[k.rol]}
                </span>
                <input value={kisiDuzenForm.ad ?? ""} onChange={(e) => setKisiDuzenForm((f) => ({ ...f, ad: e.target.value }))}
                  placeholder="Ad" className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs w-24" style={{ fontFamily: "'Nunito', sans-serif" }} />
                <input value={kisiDuzenForm.soyad ?? ""} onChange={(e) => setKisiDuzenForm((f) => ({ ...f, soyad: e.target.value }))}
                  placeholder="Soyad" className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs w-24" style={{ fontFamily: "'Nunito', sans-serif" }} />
                <input value={kisiDuzenForm.eposta ?? ""} onChange={(e) => setKisiDuzenForm((f) => ({ ...f, eposta: e.target.value }))}
                  placeholder="E-posta" className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs w-36" style={{ fontFamily: "'Nunito', sans-serif" }} />
                <input value={kisiDuzenForm.telefon ?? ""} onChange={(e) => setKisiDuzenForm((f) => ({ ...f, telefon: e.target.value.replace(/\D/g, "") }))}
                  placeholder="Telefon" maxLength={11} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs w-28" style={{ fontFamily: "'Nunito', sans-serif" }} />
                <button onClick={() => kisiDuzenKaydet(k.kisi_id)} disabled={islemLoading}
                  className="px-3 py-1.5 rounded-lg border-none bg-green-700 text-white text-xs font-semibold cursor-pointer">Kaydet</button>
                <button onClick={() => { setDuzenlenenKisi(null); setKisiDuzenForm({}); }}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-transparent text-gray-500 text-xs cursor-pointer">Vazgeç</button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap text-sm">
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: k.rol === "eczaci" ? "#fff5f5" : "#eaf7e4", color: k.rol === "eczaci" ? "#e30a17" : "#10304a", border: `0.5px solid ${k.rol === "eczaci" ? "#e30a17" : "#7ed957"}` }}>
                    {KISI_ROL_ETIKETLERI[k.rol]}
                  </span>
                  <span className="font-medium text-gray-900">{k.ad} {k.soyad}</span>
                  <span className="text-gray-500 text-xs">{k.eposta}</span>
                  <span className="text-gray-400 text-xs">{k.telefon}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => kisiDuzenBaslat(k)}
                    className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 bg-transparent text-gray-500 cursor-pointer hover:bg-gray-100 transition-colors">Düzenle</button>
                  <button onClick={() => onKisiPasifeAl(k.kisi_id, eczane.eczane_id)} disabled={islemLoading}
                    className="text-xs px-2.5 py-1 rounded-lg bg-transparent cursor-pointer transition-colors"
                    style={{ border: "0.5px solid #fecaca", color: "#bc2d0d" }}>
                    Pasife Al
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Kişi ekleme formu */}
        {kisiFormAcik && (
          <div className="px-4 md:px-5 py-3 bg-gray-50">
            <div className="flex items-center gap-2 flex-wrap">
              <select value={yeniKisi.rol} onChange={(e) => setYeniKisi((f) => ({ ...f, rol: e.target.value as YeniKisiForm["rol"] }))}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" style={{ fontFamily: "'Nunito', sans-serif" }}>
                <option value="">Rol seç</option>
                <option value="eczaci">Eczacı</option>
                <option value="eczane_teknisyeni">Eczane Teknisyeni</option>
              </select>
              <input value={yeniKisi.ad} onChange={(e) => setYeniKisi((f) => ({ ...f, ad: e.target.value }))}
                placeholder="Ad" maxLength={200} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs w-24" style={{ fontFamily: "'Nunito', sans-serif" }} />
              <input value={yeniKisi.soyad} onChange={(e) => setYeniKisi((f) => ({ ...f, soyad: e.target.value }))}
                placeholder="Soyad" maxLength={200} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs w-24" style={{ fontFamily: "'Nunito', sans-serif" }} />
              <input value={yeniKisi.eposta} onChange={(e) => setYeniKisi((f) => ({ ...f, eposta: e.target.value }))}
                placeholder="E-posta" maxLength={200} className="border rounded-lg px-2 py-1.5 text-xs w-36"
                style={{ fontFamily: "'Nunito', sans-serif", borderColor: yeniKisi.eposta && !epostaGecerliMi(yeniKisi.eposta) ? "#fca5a5" : "#e5e7eb" }} />
              <input value={yeniKisi.telefon} onChange={(e) => setYeniKisi((f) => ({ ...f, telefon: e.target.value.replace(/\D/g, "") }))}
                placeholder="Telefon (11 hane)" maxLength={11} className="border rounded-lg px-2 py-1.5 text-xs w-28"
                style={{ fontFamily: "'Nunito', sans-serif", borderColor: yeniKisi.telefon && !telefonGecerliMi(yeniKisi.telefon) ? "#fca5a5" : "#e5e7eb" }} />
              <input value={yeniKisi.sifre} onChange={(e) => setYeniKisi((f) => ({ ...f, sifre: e.target.value }))}
                placeholder="Şifre (min 6)" type="text" maxLength={72} className="border rounded-lg px-2 py-1.5 text-xs w-28"
                title="Kişinin giriş şifresi (geçici)"
                style={{ fontFamily: "'Nunito', sans-serif", borderColor: yeniKisi.sifre && yeniKisi.sifre.length < 6 ? "#fca5a5" : "#e5e7eb" }} />
              <button onClick={kisiKaydet} disabled={islemLoading || !yeniKisiGecerli}
                className="px-3 py-1.5 rounded-lg border-none bg-green-700 text-white text-xs font-semibold cursor-pointer"
                style={{ opacity: !yeniKisiGecerli ? 0.5 : 1 }}>Kaydet</button>
              <button onClick={() => { setKisiFormAcik(false); setYeniKisi(BOS_KISI); }}
                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-transparent text-gray-500 text-xs cursor-pointer">Vazgeç</button>
            </div>
          </div>
        )}
      </div>

      {/* Kişi ekle tetikleyici */}
      {!kisiFormAcik && (
        <div className="px-4 md:px-5 py-2.5 border-t border-gray-100">
          <button onClick={() => setKisiFormAcik(true)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-transparent text-gray-600 cursor-pointer hover:bg-gray-50 transition-colors">
            + Kişi ekle
          </button>
        </div>
      )}
    </div>
  );
}