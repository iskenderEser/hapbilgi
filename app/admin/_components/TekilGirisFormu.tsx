// app/admin/_components/TekilGirisFormu.tsx
//
// Tekil kullanıcı ekleme formu. useTekilForm hook'unun return ettiği state ve
// handler'ları prop olarak alır. Takım/Bölge select'leri takimlar prop'undan
// beslenir, rol select'i ROLLER sabitinden.

"use client";

import { SadeFormSecimi } from "@/components/kontrol/SadeKontroller";

import { telefonBicimle, telefonRakam } from "@/lib/admin/telefonBicim";
import { adSoyadCanliBicimle } from "@/lib/utils/adSoyadBicimle";
import { ROL_ADLARI } from "@/lib/utils/roller";
import { btnBase, inputStyle, labelStyle, RENK_BORDO, ROLLER, rowStyle } from "../_constants";
import type { Bolge, Takim } from "../_types";

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
      {/* Ad/Soyad kuralı (İskender talimatı, 21.07): nasıl yazılırsa yazılsın
          her kelime İlk Harf Büyük'e daha yazılırken çevrilir. */}
      <div style={rowStyle}>
        <span style={labelStyle}>Ad</span>
        <input type="text" value={p.tekilAd} onChange={(e) => p.setTekilAd(adSoyadCanliBicimle(e.target.value))}
          style={inputStyle} required minLength={2} />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Soyad</span>
        <input type="text" value={p.tekilSoyad} onChange={(e) => p.setTekilSoyad(adSoyadCanliBicimle(e.target.value))}
          style={inputStyle} required minLength={2} />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Rol</span>
        <SadeFormSecimi value={p.tekilRol} onChange={(e) => p.setTekilRol(e.target.value)} required aria-label="Rol" className="w-full">
          <option value="">Rol seçin...</option>
          {/* B-31: dropdown insan adı gösterir, değer kod kalır */}
          {ROLLER.map(r => <option key={r} value={r}>{ROL_ADLARI[r] ?? r}</option>)}
        </SadeFormSecimi>
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>E-posta</span>
        <input type="email" value={p.tekilEposta} onChange={(e) => p.setTekilEposta(e.target.value)}
          style={inputStyle} required />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Telefon</span>
        {/* Telefon kuralı (İskender, 23.07): 10 hane, ilk hane 5 zorunlu (0 dahil
            başka rakamla başlayamaz), gösterim 3-3-4 "542 000 0000". Kural yazarken
            uygulanır: ham rakam state'te, ekranda boşluklu; 5-dışı baş anında silinir. */}
        <input type="tel" value={telefonBicimle(p.tekilTelefon)}
          onChange={(e) => p.setTekilTelefon(telefonRakam(e.target.value))}
          style={inputStyle} required placeholder="542 000 0000" maxLength={12} />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Şifre</span>
        <input type="password" value={p.tekilSifre} onChange={(e) => p.setTekilSifre(e.target.value)}
          style={inputStyle} required minLength={6} />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Takım</span>
        <SadeFormSecimi value={p.tekilTakimId} onChange={(e) => p.handleTakimSec(e.target.value)} aria-label="Takım" className="w-full">
          <option value="">Takım seçin...</option>
          {p.takimlar.map(t => <option key={t.takim_id} value={t.takim_id}>{t.takim_adi}</option>)}
        </SadeFormSecimi>
      </div>

      {p.tekilTakimId && p.seciliTakimBolgeleri.length > 0 && (
        <div style={rowStyle}>
          <span style={labelStyle}>Bölge</span>
          <SadeFormSecimi value={p.tekilBolgeId} onChange={(e) => p.handleBolgeSec(e.target.value)} aria-label="Bölge" className="w-full">
            <option value="">Bölge seçin...</option>
            {p.seciliTakimBolgeleri.map(b => <option key={b.bolge_id} value={b.bolge_id}>{b.bolge_adi}</option>)}
          </SadeFormSecimi>
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