// app/admin/_components/TekilGirisFormu.tsx
//
// Tekil kullanıcı ekleme formu. useTekilForm hook'unun return ettiği state ve
// handler'ları prop olarak alır. Takım/Bölge select'leri takimlar prop'undan
// beslenir, rol select'i ROLLER sabitinden.

"use client";

import { ROLLER, rowStyle, labelStyle, inputStyle, btnBase, RENK_BORDO } from "../_constants";
import { ROL_ADLARI } from "@/lib/utils/roller";
import type { Takim, Bolge } from "../_types";

interface TekilGirisFormuProps {
  takimlar: Takim[];
  tekilAd: string;
  setTekilAd: (v: string) => void;
  tekilSoyad: string;
  setTekilSoyad: (v: string) => void;
  tekilRol: string;
  setTekilRol: (v: string) => void;
  tekilEposta: string;
  setTekilEposta: (v: string) => void;
  tekilTelefon: string;
  setTekilTelefon: (v: string) => void;
  tekilSifre: string;
  setTekilSifre: (v: string) => void;
  tekilTakimId: string;
  tekilBolgeId: string;
  seciliTakimBolgeleri: Bolge[];
  tekilYetkiKullanici: boolean;
  setTekilYetkiKullanici: (v: boolean) => void;
  tekilYetkiAktifPasif: boolean;
  setTekilYetkiAktifPasif: (v: boolean) => void;
  tekilLoading: boolean;
  handleTakimSec: (takim_id: string) => void;
  handleBolgeSec: (bolge_id: string) => void;
  handleTekilKaydet: (e: React.FormEvent) => void;
}

export default function TekilGirisFormu(p: TekilGirisFormuProps) {
  return (
    <form onSubmit={p.handleTekilKaydet} style={{ maxWidth: "600px" }}>
      <div style={rowStyle}>
        <span style={labelStyle}>Ad</span>
        <input type="text" value={p.tekilAd} onChange={(e) => p.setTekilAd(e.target.value)}
          style={inputStyle} required minLength={2} />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Soyad</span>
        <input type="text" value={p.tekilSoyad} onChange={(e) => p.setTekilSoyad(e.target.value)}
          style={inputStyle} required minLength={2} />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Rol</span>
        <select value={p.tekilRol} onChange={(e) => p.setTekilRol(e.target.value)} style={inputStyle} required>
          <option value="">Rol seçin...</option>
          {/* B-31: dropdown insan adı gösterir, değer kod kalır */}
          {ROLLER.map(r => <option key={r} value={r}>{ROL_ADLARI[r] ?? r}</option>)}
        </select>
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>E-posta</span>
        <input type="email" value={p.tekilEposta} onChange={(e) => p.setTekilEposta(e.target.value)}
          style={inputStyle} required />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Telefon</span>
        {/* Telefon kuralı (İskender talimatı, 21.07): 11 hane, 0 ile başlamaz, ilk hane 5. */}
        <input type="tel" value={p.tekilTelefon} onChange={(e) => p.setTekilTelefon(e.target.value.replace(/[^\d\s-]/g, "").slice(0, 13))}
          style={inputStyle} required placeholder="5XXXXXXXXXX (11 hane)" maxLength={13} />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Şifre</span>
        <input type="password" value={p.tekilSifre} onChange={(e) => p.setTekilSifre(e.target.value)}
          style={inputStyle} required minLength={6} />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Takım</span>
        <select value={p.tekilTakimId} onChange={(e) => p.handleTakimSec(e.target.value)} style={inputStyle}>
          <option value="">Takım seçin...</option>
          {p.takimlar.map(t => <option key={t.takim_id} value={t.takim_id}>{t.takim_adi}</option>)}
        </select>
      </div>

      {p.tekilTakimId && p.seciliTakimBolgeleri.length > 0 && (
        <div style={rowStyle}>
          <span style={labelStyle}>Bölge</span>
          <select value={p.tekilBolgeId} onChange={(e) => p.handleBolgeSec(e.target.value)} style={inputStyle}>
            <option value="">Bölge seçin...</option>
            {p.seciliTakimBolgeleri.map(b => <option key={b.bolge_id} value={b.bolge_id}>{b.bolge_adi}</option>)}
          </select>
        </div>
      )}

      <div style={{ display: "flex", gap: "16px", padding: "12px 0", borderTop: "0.5px solid #e5e7eb", marginTop: "12px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#111", fontFamily: "'Nunito', sans-serif", cursor: "pointer" }}>
          <input type="checkbox" checked={p.tekilYetkiKullanici}
            onChange={(e) => p.setTekilYetkiKullanici(e.target.checked)} />
          Kullanıcı yönetim yetkisi
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#111", fontFamily: "'Nunito', sans-serif", cursor: "pointer" }}>
          <input type="checkbox" checked={p.tekilYetkiAktifPasif}
            onChange={(e) => p.setTekilYetkiAktifPasif(e.target.checked)} />
          Aktif/Pasif yetkisi
        </label>
      </div>

      <button type="submit" disabled={p.tekilLoading}
        style={{ ...btnBase, background: p.tekilLoading ? "#d1d5db" : RENK_BORDO, color: "white", border: "none", marginTop: "12px" }}>
        {p.tekilLoading ? "Kaydediliyor..." : "Kaydet"}
      </button>
    </form>
  );
}