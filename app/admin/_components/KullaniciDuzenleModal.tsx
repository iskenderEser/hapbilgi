// app/admin/_components/KullaniciDuzenleModal.tsx
//
// Admin kullanıcı düzenleme modalı (İskender 25.07). Tekil giriş kartıyla AYNI
// alanlar, mevcut bilgiler dolu gelir; admin nereyi isterse orayı düzeltir.
// Kaydet → onay sorulur → onay sonrası eski bilginin üstüne yazılır.
//
// kullanici_id değişmez: kullanıcının ürettiği puan, talep, izleme, senaryo/
// video/soru seti sahipliği — hepsi olduğu gibi devam eder, yalnız künye güncellenir.
//
// Şifre alanı boş bırakılırsa şifreye dokunulmaz (mevcut şifre okunamaz, bu
// yüzden doldurulmuş gelemez).

"use client";

import { useMemo, useState } from "react";
import { ROLLER, rowStyle, labelStyle, inputStyle, btnBase, RENK_BORDO } from "../_constants";
import { ROL_ADLARI } from "@/lib/utils/roller";
import { adSoyadCanliBicimle } from "@/lib/utils/adSoyadBicimle";
import { telefonBicimle, telefonRakam } from "@/lib/admin/telefonBicim";
import type { Kullanici, Takim } from "../_types";

export interface KullaniciGuncelleVerisi {
  ad: string;
  soyad: string;
  rol: string;
  eposta: string;
  telefon: string;
  sifre?: string;
  takim_id: string | null;
  bolge_id: string | null;
  yetki_kullanici_yonetim: boolean;
  yetki_aktif_pasif: boolean;
}

interface Props {
  kullanici: Kullanici;
  takimlar: Takim[];
  loading: boolean;
  onKapat: () => void;
  onKaydet: (veri: KullaniciGuncelleVerisi) => void;
}

export default function KullaniciDuzenleModal({ kullanici, takimlar, loading, onKapat, onKaydet }: Props) {
  const [ad, setAd] = useState(kullanici.ad ?? "");
  const [soyad, setSoyad] = useState(kullanici.soyad ?? "");
  const [rol, setRol] = useState(kullanici.rol ?? "");
  const [eposta, setEposta] = useState(kullanici.eposta ?? "");
  const [telefon, setTelefon] = useState(telefonRakam(kullanici.telefon ?? ""));
  const [sifre, setSifre] = useState("");
  const [takimId, setTakimId] = useState(kullanici.takim_id ?? "");
  const [bolgeId, setBolgeId] = useState(kullanici.bolge_id ?? "");
  const [yetkiKullanici, setYetkiKullanici] = useState(!!kullanici.yetki_kullanici_yonetim);
  const [yetkiAktifPasif, setYetkiAktifPasif] = useState(!!kullanici.yetki_aktif_pasif);
  const [onayAsamasi, setOnayAsamasi] = useState(false);

  const seciliTakimBolgeleri = useMemo(
    () => takimlar.find(t => t.takim_id === takimId)?.bolgeler ?? [],
    [takimlar, takimId],
  );

  const gonder = () => onKaydet({
    ad, soyad, rol, eposta, telefon,
    ...(sifre ? { sifre } : {}),
    takim_id: takimId || null,
    bolge_id: bolgeId || null,
    yetki_kullanici_yonetim: yetkiKullanici,
    yetki_aktif_pasif: yetkiAktifPasif,
  });

  return (
    <div
      onClick={onKapat}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px", zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white", borderRadius: "10px", padding: "20px",
          width: "100%", maxWidth: "560px", maxHeight: "90vh", overflow: "auto",
          fontFamily: "'Nunito', sans-serif",
        }}
      >
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#111", marginBottom: "4px" }}>
          Kullanıcıyı Düzenle
        </h3>
        <p style={{ fontSize: "11px", color: "#737373", marginBottom: "14px" }}>
          Değişiklik eski bilgilerin üstüne yazılır. Kullanıcının ürettiği puan ve
          içerikler etkilenmez.
        </p>

        <form onSubmit={(e) => { e.preventDefault(); setOnayAsamasi(true); }}>
          <div style={rowStyle}>
            <span style={labelStyle}>Ad</span>
            <input type="text" value={ad} onChange={(e) => setAd(adSoyadCanliBicimle(e.target.value))}
              style={inputStyle} required minLength={2} />
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Soyad</span>
            <input type="text" value={soyad} onChange={(e) => setSoyad(adSoyadCanliBicimle(e.target.value))}
              style={inputStyle} required minLength={2} />
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Rol</span>
            <select value={rol} onChange={(e) => setRol(e.target.value)} style={inputStyle} required>
              {ROLLER.map(r => <option key={r} value={r}>{ROL_ADLARI[r] ?? r}</option>)}
            </select>
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>E-posta</span>
            <input type="email" value={eposta} onChange={(e) => setEposta(e.target.value)}
              style={inputStyle} required />
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Telefon</span>
            <input type="tel" value={telefonBicimle(telefon)}
              onChange={(e) => setTelefon(telefonRakam(e.target.value))}
              style={inputStyle} required placeholder="542 000 0000" maxLength={12} />
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Şifre</span>
            <input type="password" value={sifre} onChange={(e) => setSifre(e.target.value)}
              style={inputStyle} minLength={6} placeholder="Değiştirmek istemiyorsanız boş bırakın" />
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Takım</span>
            <select value={takimId} onChange={(e) => { setTakimId(e.target.value); setBolgeId(""); }} style={inputStyle}>
              <option value="">Takım seçin...</option>
              {takimlar.map(t => <option key={t.takim_id} value={t.takim_id}>{t.takim_adi}</option>)}
            </select>
          </div>

          {takimId && seciliTakimBolgeleri.length > 0 && (
            <div style={rowStyle}>
              <span style={labelStyle}>Bölge</span>
              <select value={bolgeId} onChange={(e) => setBolgeId(e.target.value)} style={inputStyle}>
                <option value="">Bölge seçin...</option>
                {seciliTakimBolgeleri.map(b => <option key={b.bolge_id} value={b.bolge_id}>{b.bolge_adi}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: "flex", gap: "16px", padding: "12px 0", borderTop: "0.5px solid #e5e7eb", marginTop: "12px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#111", cursor: "pointer" }}>
              <input type="checkbox" checked={yetkiKullanici} onChange={(e) => setYetkiKullanici(e.target.checked)} />
              Kullanıcı yönetim yetkisi
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#111", cursor: "pointer" }}>
              <input type="checkbox" checked={yetkiAktifPasif} onChange={(e) => setYetkiAktifPasif(e.target.checked)} />
              Aktif/Pasif yetkisi
            </label>
          </div>

          {onayAsamasi ? (
            <div style={{ background: "#fffbeb", border: "0.5px solid #fcd34d", borderRadius: "6px", padding: "10px", marginTop: "12px" }}>
              <p style={{ fontSize: "12px", color: "#92400e", margin: "0 0 10px" }}>
                <strong>{ad} {soyad}</strong> kullanıcısının bilgileri güncellenecek ve eski
                bilgilerin üstüne yazılacak. Onaylıyor musunuz?
                {eposta.trim().toLowerCase() !== (kullanici.eposta ?? "").toLowerCase() &&
                  " E-posta değiştiği için kullanıcı bundan sonra yeni adresiyle giriş yapacak."}
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" onClick={gonder} disabled={loading}
                  style={{ ...btnBase, background: loading ? "#d1d5db" : RENK_BORDO, color: "white", border: "none" }}>
                  {loading ? "Kaydediliyor..." : "Evet, Kaydet"}
                </button>
                <button type="button" onClick={() => setOnayAsamasi(false)} disabled={loading}
                  style={{ ...btnBase, background: "white", color: "#737373", border: "0.5px solid #e5e7eb" }}>
                  Vazgeç
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <button type="submit" disabled={loading}
                style={{ ...btnBase, background: RENK_BORDO, color: "white", border: "none" }}>
                Kaydet
              </button>
              <button type="button" onClick={onKapat}
                style={{ ...btnBase, background: "white", color: "#737373", border: "0.5px solid #e5e7eb" }}>
                Kapat
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
