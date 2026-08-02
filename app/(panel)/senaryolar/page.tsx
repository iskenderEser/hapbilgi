// app/senaryolar/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useOkunmamisIdler } from "@/hooks/useOkunmamisIdler";
import { useAuth } from "@/app/providers/AuthProvider";
import { URETIM_HATTI_GORENLER } from "@/lib/utils/roller";
import { useListe, ListeArama, DahaFazlaGoster } from "@/components/liste";
import { talepIdGoster } from "@/lib/utils/talepId";
import DurumAnahtari from "@/components/DurumAnahtari";
import UretimVaryantiRozet from "@/components/UretimVaryantiRozet";
import { durumMesaji, kayitDurumKodu, type DurumKodu } from "@/lib/utils/durum/mesaj";
import type { TalepBilgisi } from "@/lib/utils/talepZinciri";

interface SenaryoSatir {
  talep_id: string;
  talep_no: number;
  firma_adi: string;
  senaryo_id: string;
  urun_adi: string;
  teknik_adi: string;
  // Ham durum taşınmaz: ekrana çıkan her metin tek sözlükten okunur.
  durum_kodu: DurumKodu;
  uretici_rol_adi: string | null;
  son_tarih: string;
  hazir_video: boolean;
  hazir_soru_seti: boolean;
}

// SenaryoJoin arayüzü kaldırıldı (25.07, Aşama 3): elle kurulan talep join'inin
// şeklini tarif ediyordu. Künye tek kapıdan geliyor, şekli TalepBilgisi'nde.

export default function SenaryolarListePage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const [satirlar, setSatirlar] = useState<SenaryoSatir[]>([]);
  const [loading, setLoading] = useState(true);
  const [aktifDurum, setAktifDurum] = useState<DurumKodu>("onay_bekleniyor");
  const { mesajlar, hata } = useHataMesaji();

  const okunmamisIdler = useOkunmamisIdler("senaryo");

  useEffect(() => {
  if (authYukleniyor) return;
  if (!kullanici) {
    router.push("/login");
    return;
  }
  if (!URETIM_HATTI_GORENLER.includes(kullanici.rol)) {
    router.push("/ana-sayfa");
    return;
  }
 }, [kullanici, authYukleniyor, router]);

  const veriCek = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    // 1) Senaryoları talep + ürün/teknik ile çek (en yeniden eskiye)
    const { data: senaryolar, error: sError } = await supabase
      .from("senaryolar")
      .select(`
        senaryo_id,
        talep_id,
        iu_id,
        created_at,
        talepler!inner ( talep_id )
      `)
      .order("created_at", { ascending: false });

    if (sError || !senaryolar) {
      hata("Senaryolar yüklenemedi.", "senaryolar tablosu SELECT", sError?.message);
      setLoading(false);
      return;
    }

    // 2) Talep bazlı tekilleştir — her talep için sadece en yeni senaryo
    const talepMap = new Map<string, any>();
    for (const s of senaryolar) {
      if (!talepMap.has(s.talep_id)) {
        talepMap.set(s.talep_id, s);
      }
    }
    const tekilSenaryolar = Array.from(talepMap.values());

    // 3) Son durumları view'dan toplu çek
    const senaryoIds = tekilSenaryolar.map((s: any) => s.senaryo_id);
    const sonDurumMap = new Map<string, { durum: string; created_at: string }>();

    if (senaryoIds.length > 0) {
      const { data: sonDurumlar, error: sdError } = await supabase
        .from("v_senaryo_son_durum")
        .select("senaryo_id, durum, created_at")
        .in("senaryo_id", senaryoIds);

      if (sdError) {
        hata("Senaryo son durumları yüklenemedi.", "v_senaryo_son_durum SELECT", sdError.message);
        setLoading(false);
        return;
      }

      sonDurumlar?.forEach((sd: any) => {
        sonDurumMap.set(sd.senaryo_id, { durum: sd.durum, created_at: sd.created_at });
      });
    }


    // Talep künyeleri TEK KAPIDAN, toplu (25.07, Aşama 3): liste kaç talep
    // içeriyorsa hepsi tek istekte gelir; ekran alan listesi ve ad kuralı bilmez.
    const kunyeMap = new Map<string, TalepBilgisi>();
    {
      const talepIdler = tekilSenaryolar.map((s: any) => s.talep_id);
      if (talepIdler.length > 0) {
        const res = await fetch(`/talepler/api/kunye?talep_idler=${talepIdler.join(",")}`);
        const veri = await res.json();
        if (res.ok) for (const k of veri.kunyeler as TalepBilgisi[]) kunyeMap.set(k.talep_id, k);
      }
    }

    // Talebi açanın unvanı künyeden gelir (25.07): buradaki ayrı kullanicilar
    // sorgusu kaldırıldı — aynı blok üç liste ekranında birebir tekrar ediyordu.

    // 4) Satırları kur — talep bazlı tek satır
    const sonuc: SenaryoSatir[] = tekilSenaryolar.map((s: any) => {
      const talep = kunyeMap.get(s.talep_id);
      const sonDurum = sonDurumMap.get(s.senaryo_id);

      return {
        talep_id: s.talep_id,
        talep_no: talep?.talep_no ?? 0,
        firma_adi: talep?.firma_adi ?? "",
        senaryo_id: s.senaryo_id,
        urun_adi: talep?.urun_adi ?? "-",
        teknik_adi: talep?.teknik_adi ?? "-",
        hazir_video: talep?.hazir_video ?? false,
        hazir_soru_seti: talep?.hazir_soru_seti ?? false,
        durum_kodu: kayitDurumKodu(sonDurum?.durum, !!s.iu_id),
        uretici_rol_adi: talep?.uretici_rol_adi ?? null,
        son_tarih: sonDurum?.created_at ?? s.created_at,
      };
    });

    setSatirlar(sonuc);
    setLoading(false);
  }, [hata]);

  useEffect(() => { if (kullanici) veriCek(); }, [kullanici, veriCek]);

  const sayim = useMemo(() => {
    const s: Partial<Record<DurumKodu, number>> = {};
    for (const r of satirlar) s[r.durum_kodu] = (s[r.durum_kodu] ?? 0) + 1;
    return s;
  }, [satirlar]);

  // Sıra önemli: önce durum sekmesi (DurumAnahtari), sonra arama, sonra dilimleme.
  // Arama ve "daha fazla göster" merkezden (components/liste) — 9 liste ekranı
  // aynı davranışı paylaşsın diye; sayfa yalnız aranabilir alanları tanımlar.
  const durumSuzulmus = satirlar.filter(s => s.durum_kodu === aktifDurum);
  const liste = useListe({
    veri: durumSuzulmus,
    aramaAlanlari: [
      { anahtar: "no", etiket: "Talep No", deger: (s: typeof durumSuzulmus[number]) => s.talep_no },
      { anahtar: "ad", etiket: "Ürün / Eğitim", deger: (s: typeof durumSuzulmus[number]) => s.urun_adi },
    ],
  });
  const filtreliSatirlar = liste.gorunen;

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  // durumRenk kaldırıldı (25.07): metin ve renk tek sözlükten — lib/utils/durum/mesaj.ts.

  // Auth guard layout'ta; erişim kontrolü useEffect'te; burada veri spinner'ı.
  if (!kullanici || loading) {
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
    <>

      <div className="max-w-6xl mx-auto px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

          <DurumAnahtari baslik="Senaryolar" rol={kullanici.rol} asama="Senaryo" aktif={aktifDurum} onSec={setAktifDurum} sayim={sayim} />

          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs text-gray-500">{liste.toplam} kayıt</span>
            <ListeArama arama={liste.arama} />
          </div>

          {liste.toplam === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">
              {satirlar.length === 0 ? "Henüz senaryo bulunmuyor."
                : liste.hamToplam === 0 ? "Bu durumda senaryo yok."
                : "Aramanıza uyan kayıt bulunamadı."}
            </div>
          ) : (
            <>
              <div className="md:hidden">
                {filtreliSatirlar.map((s) => {
                  const durum = durumMesaji(s.durum_kodu, kullanici.rol, { asama: "Senaryo", rolAdi: s.uretici_rol_adi, tarih: s.son_tarih });
                  const okunmamis = okunmamisIdler.has(s.senaryo_id);
                  return (
                    <div key={s.talep_id} onClick={() => router.push(`/senaryolar/${s.talep_id}`)}
                      className="px-4 py-3 border-b border-gray-50 cursor-pointer"
                      style={okunmamis ? { boxShadow: "inset 3px 0 0 0 #bc2d0d" } : undefined}>
                      <div className="text-xs text-gray-500 mb-1">{talepIdGoster(s.firma_adi, s.talep_no)}</div>
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {okunmamis && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#bc2d0d" }} />
                          )}
                          <span className="text-sm text-gray-900" style={{ fontWeight: okunmamis ? 700 : 600 }}>{s.urun_adi}</span>
                          <UretimVaryantiRozet hazirVideo={s.hazir_video} hazirSoruSeti={s.hazir_soru_seti} />
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full leading-tight"
                          style={{ background: durum.renk.bg, color: durum.renk.text, border: `0.5px solid ${durum.renk.border}`, fontSize: 11 }}>
                          {durum.metin}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">{s.teknik_adi}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{formatTarih(s.son_tarih)}</div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-2.5 text-gray-400 font-medium text-xs uppercase">ID</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Ürün / Eğitim</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Teknik</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase w-56">Son Durum</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Tarih</th>
                      <th className="px-5 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtreliSatirlar.map((s) => {
                      const durum = durumMesaji(s.durum_kodu, kullanici.rol, { asama: "Senaryo", rolAdi: s.uretici_rol_adi, tarih: s.son_tarih });
                      const okunmamis = okunmamisIdler.has(s.senaryo_id);
                      return (
                        <tr key={s.talep_id} onClick={() => router.push(`/senaryolar/${s.talep_id}`)}
                          className="border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors duration-100"
                          style={okunmamis ? { boxShadow: "inset 3px 0 0 0 #bc2d0d" } : undefined}>
                          <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{talepIdGoster(s.firma_adi, s.talep_no)}</td>
                          <td className="px-3 py-3 text-gray-900">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {okunmamis && (
                                <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#bc2d0d" }} />
                              )}
                              <span style={{ fontWeight: okunmamis ? 700 : 500 }}>{s.urun_adi}</span>
                              <UretimVaryantiRozet hazirVideo={s.hazir_video} hazirSoruSeti={s.hazir_soru_seti} />
                            </div>
                          </td>
                          <td className="px-3 py-3 text-gray-500">{s.teknik_adi}</td>
                          <td className="px-3 py-3">
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full inline-block max-w-full break-words text-center leading-snug"
                              style={{ background: durum.renk.bg, color: durum.renk.text, border: `0.5px solid ${durum.renk.border}` }}>
                              {durum.metin}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-gray-500 text-xs">{formatTarih(s.son_tarih)}</td>
                          <td className="px-5 py-3">
                            <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" width="16" height="16"><path d="M9 5l7 7-7 7"/></svg>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <DahaFazlaGoster
                dahaVar={liste.dahaVar}
                gorunenSayi={liste.gorunen.length}
                toplam={liste.toplam}
                onGoster={liste.dahaFazlaGoster}
              />
            </>
          )}
        </div>
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </>
  );
}