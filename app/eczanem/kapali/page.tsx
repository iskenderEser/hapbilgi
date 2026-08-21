"use client";

import { useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import EclubGecisKarti from "../_components/EclubGecisKarti";

export default function EczanemKapaliPage() {
  const { cikisYap } = useAuth();
  const [silmeAcik, setSilmeAcik] = useState(false);
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState("");
  const [siliniyor, setSiliniyor] = useState(false);
  const [bilgi, setBilgi] = useState("");

  const hesabimiSil = async (event: React.FormEvent) => {
    event.preventDefault();
    setHata("");
    setSiliniyor(true);
    try {
      const response = await fetch("/eczanem/api/hesabimi-sil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sifre }),
      });
      const data = await response.json();
      if (!response.ok) {
        setHata(data.hata ?? "Hesabınız silinemedi.");
        return;
      }
      await cikisYap();
    } catch {
      setHata("Hesabınız silinemedi; yeniden deneyin.");
    } finally {
      setSiliniyor(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="mx-auto max-w-md">
      <EclubGecisKarti hata={(mesaj) => setHata(mesaj)} basari={(mesaj) => setBilgi(mesaj)} />
      {bilgi && <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">{bilgi}</p>}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold text-gray-900">Eczanem şu anda kapalı</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Eczanem, bağlı olduğunuz firmalar için şu anda kullanıma açık değildir.
        </p>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => cikisYap()}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Çıkış yap
          </button>
          <button
            type="button"
            onClick={() => setSilmeAcik((acik) => !acik)}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            Hesabımı sil
          </button>
        </div>

        {silmeAcik && (
          <form onSubmit={hesabimiSil} className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-900">Hesabınız ve kişisel verileriniz kalıcı olarak silinecek.</p>
            <label className="mt-3 block text-xs font-semibold text-gray-700" htmlFor="kapali-silme-sifre">
              Onaylamak için şifrenizi girin
            </label>
            <input
              id="kapali-silme-sifre"
              type="password"
              value={sifre}
              onChange={(event) => setSifre(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-400"
              required
            />
            {hata && <p className="mt-2 text-xs text-red-700">{hata}</p>}
            <button
              type="submit"
              disabled={siliniyor || !sifre}
              className="mt-3 w-full rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {siliniyor ? "Siliniyor…" : "Evet, hesabımı kalıcı olarak sil"}
            </button>
          </form>
        )}
      </section>
      </div>
    </main>
  );
}
