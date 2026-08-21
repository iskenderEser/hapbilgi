// app/(panel)/eczanem/eczane/musterilerim/page.tsx
// Eczacı/teknisyen Eczanem — Müşteri Yönetimi: üstte müşteri kayıt kartı,
// altta eczaneye bağlı aktif müşterilerin listesi (tek sayfa, sekme yok).
// Sidebar kabuğu (panel) layout'undan gelir; başlık/zemin EclubKisiSayfa desenidir.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { EclubKisiSayfa, EclubKisiBaslik } from "@/components/eclub/EclubKisiSayfa";
import { YenileButonu } from "@/components/ui/yenile-butonu";

interface MusteriSatiri {
  musteri_id: string;
  ad_soyad: string;
  telefon: string; // maskeli gelir (son-4-hane)
  eposta: string | null;
  aktif_mi: boolean;
  created_at: string;
}

// Listede ad-soyad, kayıt nasıl olursa olsun her kelimenin ilk harfi büyük
// gösterilir (Türkçe-uyumlu: i→İ, I→ı).
function ilkHarfleriBuyut(ad: string): string {
  return ad
    .split(/\s+/)
    .filter(Boolean)
    .map((k) => k.charAt(0).toLocaleUpperCase("tr-TR") + k.slice(1).toLocaleLowerCase("tr-TR"))
    .join(" ");
}

export default function EczanemMusterilerimPage() {
  const { mesajlar, hata, basari } = useHataMesaji();

  // Müşteri kayıt formu — müşteri /login ile (e-posta/telefon + şifre) girer.
  const [kAd, setKAd] = useState("");
  const [kSoyad, setKSoyad] = useState("");
  const [kTel, setKTel] = useState("");
  const [kEposta, setKEposta] = useState("");
  const [kSifre, setKSifre] = useState("");
  const [kSifreGoster, setKSifreGoster] = useState(false);
  const [kGonderiliyor, setKGonderiliyor] = useState(false);
  const [baglaTel, setBaglaTel] = useState("");
  const [baglaniyor, setBaglaniyor] = useState(false);

  // Müşteri listesi.
  const [musteriler, setMusteriler] = useState<MusteriSatiri[]>([]);
  const [listeYukleniyor, setListeYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);

  const musterileriCek = useCallback(async (ilkYukleme = false) => {
    if (ilkYukleme) setListeYukleniyor(true);
    else setYenileniyor(true);
    try {
      const res = await fetch("/eczanem/eczane/api/musteriler");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Müşteriler yüklenemedi.", "müşteri listesi"); return; }
      setMusteriler(data.musteriler ?? []);
    } catch {
      hata("Müşteriler yüklenemedi.", "müşteri listesi");
    } finally {
      if (ilkYukleme) setListeYukleniyor(false);
      else setYenileniyor(false);
    }
  }, [hata]);

  useEffect(() => { void musterileriCek(true); }, [musterileriCek]);

  const kayitliMusteriyiBagla = async () => {
    setBaglaniyor(true);
    try {
      const res = await fetch("/eczanem/eczane/api/musteri-ekle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ islem: "bagla", telefon: baglaTel }),
      });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Müşteri bağlanamadı.", "kayıtlı müşteri bağı"); return; }
      basari(data.mesaj ?? "Kayıtlı müşteri eczanenize bağlandı.");
      setBaglaTel("");
      void musterileriCek();
    } catch {
      hata("Müşteri bağlanamadı.", "kayıtlı müşteri bağı");
    } finally {
      setBaglaniyor(false);
    }
  };

  const musteriKaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    setKGonderiliyor(true);
    try {
      const res = await fetch("/eczanem/eczane/api/musteri-ekle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_soyad: `${kAd} ${kSoyad}`.trim(), telefon: kTel, eposta: kEposta, sifre: kSifre }),
      });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Müşteri kaydedilemedi.", "müşteri kaydı"); return; }
      basari("Müşteri kaydedildi — belirlediğiniz telefon/e-posta ve şifreyle giriş yapabilir.");
      setKAd("");
      setKSoyad("");
      setKTel("");
      setKEposta("");
      setKSifre("");
      musterileriCek();
    } catch {
      hata("Müşteri kaydedilemedi.", "müşteri kaydı");
    } finally {
      setKGonderiliyor(false);
    }
  };

  const durumDegistir = async (musteri_id: string, aktif_mi: boolean) => {
    try {
      const res = await fetch("/eczanem/eczane/api/musteriler", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ musteri_id, aktif_mi }),
      });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Durum güncellenemedi.", "müşteri durumu"); return; }
      musterileriCek();
    } catch {
      hata("Durum güncellenemedi.", "müşteri durumu");
    }
  };

  const musteriSil = async (musteri_id: string) => {
    if (!window.confirm("Bu müşteriyi listeden silmek istediğinize emin misiniz? Kalıcı silme değildir; iz kaydı tutulur.")) return;
    try {
      const res = await fetch("/eczanem/eczane/api/musteriler", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ musteri_id }),
      });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Müşteri silinemedi.", "müşteri silme"); return; }
      basari("Müşteri listeden silindi.");
      musterileriCek();
    } catch {
      hata("Müşteri silinemedi.", "müşteri silme");
    }
  };

  return (
    <EclubKisiSayfa>
      <HataMesajiContainer mesajlar={mesajlar} />
      <EclubKisiBaslik
        ikon={Users}
        ustEtiket="Eczanem"
        baslik="Müşteri Yönetimi"
        aciklama="Sözlü rızasını aldığınız müşterilerinizi kaydedin; kayıtlı müşterilerinizi görüntüleyin."
        aksiyon={<YenileButonu yenileniyor={yenileniyor} onYenile={() => musterileriCek()} disabled={baglaniyor || kGonderiliyor} />}
      />

      {/* Üst: kayıtlı müşteriyi bağlama */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="text-sm font-semibold text-gray-700 mb-2">Kayıtlı Müşteriyi Eczaneme Bağla</div>
        <div className="text-xs text-gray-500 mb-4">
          Müşteri daha önce başka bir eczanede kaydolduysa yalnız cep telefonuyla eczanenize bağlayın. Mevcut e-posta ve şifresi değişmez.
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="tel"
            inputMode="numeric"
            maxLength={11}
            value={baglaTel}
            onChange={(e) => setBaglaTel(e.target.value.replace(/\D/g, ""))}
            placeholder="05XXXXXXXXX"
            aria-label="Kayıtlı müşteri cep telefonu"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={kayitliMusteriyiBagla}
            disabled={baglaniyor || baglaTel.length !== 11}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "#b45309" }}
          >
            {baglaniyor ? "Bağlanıyor…" : "Kayıtlı Müşteriyi Bağla"}
          </button>
        </div>
      </div>

      {/* Yeni müşteri kayıt kartı */}
      <form onSubmit={musteriKaydet} className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="text-sm font-semibold text-gray-700 mb-2">Yeni Müşteri Kaydı</div>
        <div className="text-xs text-gray-500 mb-4">
          Sözlü rızasını aldığınız müşterinizin bilgilerini girip bir şifre belirleyin; müşteri
          bu cep telefonu (veya e-posta) ve şifreyle giriş yapar.
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={kAd}
              onChange={(e) => setKAd(e.target.value)}
              placeholder="Ad"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              required
            />
            <input
              type="text"
              value={kSoyad}
              onChange={(e) => setKSoyad(e.target.value)}
              placeholder="Soyad"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              required
            />
            <input
              type="tel"
              inputMode="numeric"
              maxLength={11}
              value={kTel}
              onChange={(e) => setKTel(e.target.value.replace(/\D/g, ""))}
              placeholder="05XXXXXXXXX"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={kEposta}
              onChange={(e) => setKEposta(e.target.value)}
              placeholder="E-posta"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              required
            />
            <div className="relative flex-1">
              <input
                type={kSifreGoster ? "text" : "password"}
                value={kSifre}
                onChange={(e) => setKSifre(e.target.value)}
                placeholder="Şifre (en az 6 karakter)"
                minLength={6}
                autoComplete="new-password"
                className="w-full border border-gray-300 rounded-lg pl-3 pr-10 py-2 text-sm"
                required
              />
              <button
                type="button"
                onClick={() => setKSifreGoster((g) => !g)}
                aria-label={kSifreGoster ? "Şifreyi gizle" : "Şifreyi göster"}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none p-0 cursor-pointer text-gray-400 hover:text-gray-600"
              >
                {kSifreGoster ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                    <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
                    <path d="M1 1l22 22" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            <button
              type="submit"
              disabled={kGonderiliyor}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "#b45309" }}
            >
              {kGonderiliyor ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>
      </form>

      {/* Alt: müşteri listesi */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="text-sm font-semibold text-gray-700 mb-3">
          Müşteri Listesi{musteriler.length > 0 ? ` (${musteriler.length})` : ""}
        </div>
        {listeYukleniyor ? (
          <div className="text-sm text-gray-400">Yükleniyor…</div>
        ) : musteriler.length === 0 ? (
          <div className="text-sm text-gray-400">Henüz kayıtlı müşteri yok.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3 font-semibold">Müşteri</th>
                  <th className="py-2 pr-3 font-semibold">Cep Tel</th>
                  <th className="py-2 pr-3 font-semibold">E-posta</th>
                  <th className="py-2 pr-3 font-semibold whitespace-nowrap">Durum</th>
                  <th className="py-2 font-semibold whitespace-nowrap">Kayıt Tarihi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {musteriler.map((m) => (
                  <tr key={m.musteri_id} className={m.aktif_mi ? "" : "bg-gray-50"}>
                    <td className="py-2.5 pr-3 text-gray-800">{ilkHarfleriBuyut(m.ad_soyad)}</td>
                    <td className="py-2.5 pr-3 text-gray-600 whitespace-nowrap">{m.telefon}</td>
                    <td className="py-2.5 pr-3 text-gray-600">{m.eposta ?? "—"}</td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <select
                        value={m.aktif_mi ? "aktif" : "pasif"}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "sil") musteriSil(m.musteri_id);
                          else durumDegistir(m.musteri_id, v === "aktif");
                        }}
                        className="border border-gray-300 rounded-lg px-2 py-1 text-xs bg-white"
                        style={{ color: m.aktif_mi ? "#15803d" : "#b45309" }}
                      >
                        <option value="aktif">Aktif</option>
                        <option value="pasif">Pasif</option>
                        <option value="sil">Sil</option>
                      </select>
                    </td>
                    <td className="py-2.5 text-gray-500 whitespace-nowrap">{new Date(m.created_at).toLocaleDateString("tr-TR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </EclubKisiSayfa>
  );
}
