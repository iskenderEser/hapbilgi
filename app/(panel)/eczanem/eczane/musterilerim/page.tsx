// app/(panel)/eczanem/eczane/musterilerim/page.tsx
// Eczacı/teknisyen Eczanem — Müşteri Yönetimi: iki sekme.
//   • Yeni Müşteri Kaydı: doğrudan (şifreli) kayıt + SMS'li davet + davet durumları.
//   • Müşteri Listesi: eczaneye bağlı aktif müşteriler (davet/doğrudan fark etmez).
// Sidebar kabuğu (panel) layout'undan gelir; başlık/zemin EclubKisiSayfa desenidir.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { EclubKisiSayfa, EclubKisiBaslik } from "@/components/eclub/EclubKisiSayfa";

interface MusteriSatiri {
  musteri_id: string;
  ad_soyad: string;
  telefon: string; // maskeli gelir (son-4-hane)
  eposta: string | null; // sentetik davet adresleri null gelir
  kayit_turu: "davet" | "dogrudan";
  created_at: string;
}

type Sekme = "kayit" | "liste";

export default function EczanemMusterilerimPage() {
  const { mesajlar, hata, basari } = useHataMesaji();

  const [sekme, setSekme] = useState<Sekme>("kayit");

  // Yeni Davet (SMS) formu.
  const [dAd, setDAd] = useState("");
  const [dSoyad, setDSoyad] = useState("");
  const [telefon, setTelefon] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  // Doğrudan (şifreli) kayıt formu — müşteri /login ile girer.
  const [kAd, setKAd] = useState("");
  const [kSoyad, setKSoyad] = useState("");
  const [kTel, setKTel] = useState("");
  const [kEposta, setKEposta] = useState("");
  const [kSifre, setKSifre] = useState("");
  const [kGonderiliyor, setKGonderiliyor] = useState(false);

  // Müşteri listesi.
  const [musteriler, setMusteriler] = useState<MusteriSatiri[]>([]);
  const [listeYukleniyor, setListeYukleniyor] = useState(false);

  const musterileriCek = useCallback(async () => {
    setListeYukleniyor(true);
    try {
      const res = await fetch("/eczanem/eczane/api/musteriler");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Müşteriler yüklenemedi.", "müşteri listesi"); return; }
      setMusteriler(data.musteriler ?? []);
    } catch {
      hata("Müşteriler yüklenemedi.", "müşteri listesi");
    } finally {
      setListeYukleniyor(false);
    }
  }, [hata]);

  useEffect(() => { if (sekme === "liste") musterileriCek(); }, [sekme, musterileriCek]);

  const davetGonder = async (e: React.FormEvent) => {
    e.preventDefault();
    setGonderiliyor(true);
    try {
      const res = await fetch("/eczanem/eczane/api/davetler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_soyad: `${dAd} ${dSoyad}`.trim(), telefon }),
      });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Davet gönderilemedi.", "davet"); return; }
      basari("Davet gönderildi — müşterinize SMS ile kod iletildi.");
      setDAd("");
      setDSoyad("");
      setTelefon("");
    } catch {
      hata("Davet gönderilemedi.", "davet");
    } finally {
      setGonderiliyor(false);
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

  const SEKMELER: { id: Sekme; ad: string }[] = [
    { id: "kayit", ad: "Yeni Müşteri Kaydı" },
    { id: "liste", ad: "Müşteri Listesi" },
  ];

  return (
    <EclubKisiSayfa>
      <HataMesajiContainer mesajlar={mesajlar} />
      <EclubKisiBaslik
        ikon={Users}
        ustEtiket="Eczanem"
        baslik="Müşteri Yönetimi"
        aciklama="Sözlü rızasını aldığınız müşterilerinizi kaydedin veya davet edin; kayıtlı müşterilerinizi görüntüleyin."
      />

      {/* Sekme barı */}
      <div className="flex gap-1 border-b border-gray-200">
        {SEKMELER.map((s) => {
          const aktif = sekme === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSekme(s.id)}
              className="px-4 py-2.5 text-sm bg-transparent"
              style={{
                border: "none",
                borderBottom: aktif ? "2px solid #3589d8" : "2px solid transparent",
                color: aktif ? "#3589d8" : "#8190a3",
                fontWeight: aktif ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {s.ad}
            </button>
          );
        })}
      </div>

      {sekme === "kayit" ? (
        <>
          <form onSubmit={musteriKaydet} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-sm font-semibold text-gray-700 mb-3">Doğrudan Kayıt</div>
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
                <input
                  type="password"
                  value={kSifre}
                  onChange={(e) => setKSifre(e.target.value)}
                  placeholder="Şifre (en az 6 karakter)"
                  minLength={6}
                  autoComplete="new-password"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  required
                />
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

          <form onSubmit={davetGonder} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-sm font-semibold text-gray-700 mb-3">SMS ile Davet</div>
            <div className="text-xs text-gray-500 mb-4">
              Sözlü rızasını aldığınız müşterinizin adını ve cep telefonunu girin; kendisine SMS ile
              tek kullanımlık kod ve üyelik bağlantısı gönderilir.
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={dAd}
                onChange={(e) => setDAd(e.target.value)}
                placeholder="Ad"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                required
              />
              <input
                type="text"
                value={dSoyad}
                onChange={(e) => setDSoyad(e.target.value)}
                placeholder="Soyad"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                required
              />
              <input
                type="tel"
                inputMode="numeric"
                maxLength={11}
                value={telefon}
                onChange={(e) => setTelefon(e.target.value.replace(/\D/g, ""))}
                placeholder="05XXXXXXXXX"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                required
              />
              <button
                type="submit"
                disabled={gonderiliyor}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "#b45309" }}
              >
                {gonderiliyor ? "Gönderiliyor…" : "Davet Gönder"}
              </button>
            </div>
          </form>
        </>
      ) : (
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
                    <th className="py-2 pr-3 font-semibold whitespace-nowrap">Kayıt Türü</th>
                    <th className="py-2 font-semibold whitespace-nowrap">Kayıt Tarihi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {musteriler.map((m) => {
                    const dogrudan = m.kayit_turu === "dogrudan";
                    return (
                    <tr key={m.musteri_id}>
                      <td className="py-2.5 pr-3 text-gray-800">{m.ad_soyad}</td>
                      <td className="py-2.5 pr-3 text-gray-600 whitespace-nowrap">{m.telefon}</td>
                      <td className="py-2.5 pr-3 text-gray-600">{m.eposta ?? "—"}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        <span
                          className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={dogrudan
                            ? { background: "#e6f0fa", color: "#3589d8" }
                            : { background: "#fdf1e3", color: "#b45309" }}
                        >
                          {dogrudan ? "Doğrudan Kayıt" : "Davet"}
                        </span>
                      </td>
                      <td className="py-2.5 text-gray-500 whitespace-nowrap">{new Date(m.created_at).toLocaleDateString("tr-TR")}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </EclubKisiSayfa>
  );
}
