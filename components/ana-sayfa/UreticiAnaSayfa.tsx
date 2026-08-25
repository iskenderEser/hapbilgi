// components/ana-sayfa/UreticiAnaSayfa.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useHataMesaji } from "@/components/HataMesaji";
import { HedefRolPilleri, VaryantPill, AsamaPill, DurumPill, Pill, type PillAsama, type PillRenk } from "@/components/pill";
import { useListe, ListeArama, DahaFazlaGoster } from "@/components/liste";
import type { HedefRoller } from "@/lib/utils/roller";
import { ROL_ADLARI } from "@/lib/utils/roller";
import { talepIdGoster } from "@/lib/utils/talepId";
import { rolTeknikKullanirMi } from "@/lib/uretici/yetenekler";
import { type DurumKodu } from "@/lib/utils/durum/mesaj";
import type { AuthKullanici } from "@/types/auth";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";

interface TakipSatiri {
  talep_id: string;
  talep_no: number | null;
  firma_adi: string;
  urun_adi: string;
  teknik_adi: string;
  hedef_roller: HedefRoller;
  hazir_video: boolean;
  hazir_soru_seti: boolean;
  asama: PillAsama;
  durum_kodu: DurumKodu;
  tarih: string;
  yol: string;
  kategori: string;
}

interface PMVeri {
  satirlar: TakipSatiri[];
  istatistikler: {
    inceleme_bekleyen: number;
    yayin_bekleyen: number;
    yayinda: number;
    toplam: number;
  };
}

interface Props {
  user: AuthKullanici;
  rol: string;
  adSoyad: string;
}

export default function UreticiAnaSayfa({ user, rol, adSoyad }: Props) {
  const router = useRouter();
  const [pmVeri, setPmVeri] = useState<PMVeri | null>(null);
  const [takimAdi, setTakimAdi] = useState("");
  const [loading, setLoading] = useState(true);
  const [aktifFiltre, setAktifFiltre] = useState<string>("tumu");
  const { hata } = useHataMesaji();

  useEffect(() => {
    const veriCek = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data: kullanici } = await supabase.from("kullanicilar").select("takim_id").eq("kullanici_id", user.id).single();
      if (kullanici?.takim_id) {
        const { data: takim } = await supabase.from("takimlar").select("takim_adi").eq("takim_id", kullanici.takim_id).single();
        setTakimAdi(takim?.takim_adi ?? "");
      }
      const res = await fetch("/ana-sayfa/api");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Veriler yüklenemedi.", data.adim, data.detay); }
      else { setPmVeri(data); }
      setLoading(false);
    };
    veriCek();
  }, [user]);

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });

  // Yayın Listesi üretimi biten kayıtları gösterir; hedef ekranı ise yayın durumu
  // belirler. Yalnız canlı yayınlar salt-izleme kataloğuna, diğerleri mevcut yayın
  // yönetimi akışına gider. Canlı yayın üreticinin kendi hedef-kitle kataloğunda açılır.
  const satirYolu = (satir: TakipSatiri) =>
    satir.durum_kodu === "yayinda"
      ? "/sizin-yayinlariniz"
      : satir.yol;

  const bugunTarih = () =>
    new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });

  // durumRenk kaldırıldı (25.07): metin ve renk artık tek sözlükten okunur —
  // lib/utils/durum/mesaj.ts. Aynı durum her ekranda aynı yazar, aynı renkte çıkar.
  // asamaRenk kaldırıldı (27.07): aşama pill'i artık nötr (AsamaPill). Renkli
  // olduğunda durum pill'iyle çakışıyordu — #eff6ff hem "Video aşaması" hem
  // "inceleme bekleniyor" demekti. Renk yalnız durumda anlam taşır.

  // Boş durum örnek satırındaki soluk pill'lerin rengi (gerçek veri değil, tanıtım).
  const ORNEK_RENK: PillRenk = { bg: "#f3f4f6", metin: "#9ca3af", kenar: "#e5e7eb" };

  // Satır türetimi ve liste kancası, yükleme dönüşünün ÜSTÜNDE durmak zorunda:
  // React kancaları koşulsuz çağrılmalı, erken return'ün altına konamaz.
  const tumSatirlar = pmVeri?.satirlar ?? [];

  // KAPSAM (27.07, İskender kararı): Yayın Listesi YALNIZ üretimi bitenleri gösterir
  // — yayına alınmayı bekleyen, planlanan, yayında, yayını durdurulan. Üretimi süren
  // talepler burada değil, Talepler sayfasındaki "Devam Eden Taleplerim" tablosunda;
  // iptal edilenler de oradaki kendi tablosunda. Önceden üçü de bu listedeydi ve
  // aynı talepler iki ekranda birden görünüyordu (Merve'de 6 kaydın 5'i tekrardı).
  const satirlar = tumSatirlar.filter(s => s.asama === "Tamamlandı");

  const filtrelenmisKategori = aktifFiltre === "tumu" ? satirlar : satirlar.filter(s => s.kategori === aktifFiltre);

  // Arama + kademeli listeleme merkezden (components/liste) — Talepler sayfasıyla
  // aynı davranış. Sıra önemli: önce kategori süzgeci (stat kartları), sonra arama.
  const liste = useListe({
    veri: filtrelenmisKategori,
    aramaAlanlari: [
      { anahtar: "no", etiket: "Talep No", deger: (s: TakipSatiri) => s.talep_no },
      { anahtar: "ad", etiket: "Ürün / Eğitim", deger: (s: TakipSatiri) => s.urun_adi },
    ],
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const istat = pmVeri?.istatistikler ?? { inceleme_bekleyen: 0, yayin_bekleyen: 0, yayinda: 0, toplam: 0 };
  const filtrelenmis = liste.gorunen;
  // Ad çözülemezse rolün unvanı yazılır — "PM" kod dilidir ve bu bileşeni 13
  // üretici rolün hepsi kullanıyor (Eğitim Müdürü de "Merhaba PM" görüyordu).
  const ad = adSoyad.split(" ")[0] || ROL_ADLARI[rol.toLowerCase()] || "";
  // Örnek satır yalnız hiç talep yokken çıkar. Talep var ama hiçbiri bitmemişse
  // tanıtım satırı değil, normal "içerik yok" mesajı doğru olan.
  const hicTalepYok = tumSatirlar.length === 0;

  // TEKNİK kolonu yalnız içeriği teknik taşıyan rollerde görünür (pm/egt_*);
  // med_md/İK'da hiç gösterilmez (veri-güdümlü, rol-başına hardcode yok).
  const teknikGoster = rolTeknikKullanirMi(rol.toLowerCase());
  // Sütun düzeni (27.07): ÜRETİM YÖNTEMİ kendi sütununa çıktı — varyant rozetleri
  // ürün adının altında duruyordu, "Hazır" ekiyle o satır uzayınca yer sıkıştı.
  // Varyant ürün adının parçası değil, satırın bağımsız bir özelliğidir.
  // Sıra: ID · ÜRÜN/EĞİTİM · (TEKNİK) · ÜRETİM YÖNTEMİ · HEDEF ROL · AŞAMA · DURUM · YAYIN TARİHİ
  //
  // EŞİT SÜTUN + HİZA (27.07, İskender): iki sorun tek satırda çözülür.
  // (1) Sütunlar eşit paylı — eskiden DURUM 1.8fr ile diğerlerinin iki katıydı;
  //     durum metinleri iki kelimeye indiği için o genişlik artık gereksiz ve
  //     sütun aralıkları göze eşitsiz görünüyordu.
  // (2) minmax(0,1fr) ŞART: çıplak `1fr` aslında `minmax(auto,1fr)`dir, yani
  //     hücrenin İÇERİĞİ payından genişse o sütun şişer. Başlık ve her veri satırı
  //     ayrı birer grid olduğundan bu şişme yalnız o satırı kaydırıyor, satırlar
  //     birbirine hizalanmıyordu (ÜRETİM YÖNTEMİ hücresi kimi satırda boş, kiminde
  //     iki pill olduğu için fark büyüdü). minmax(0,…) içerik alt sınırını sıfırlar.
  // Tek istisna ÜRETİM YÖNTEMİ (İskender kararı 27.07, seçenek B): iki varyantı
  // olan talepte "Hazır Video" + "Hazır Soru" eşit payda (~160px) yan yana
  // sığmayıp alt alta düşüyor, o satır diğerlerinden yüksek kalıyordu. 1.4 pay
  // ile ikisi tek satırda durur; kalan yedi sütun eşit paylı kalır.
  const gridCols = teknikGoster
    ? "repeat(3, minmax(0, 1fr)) minmax(0, 1.4fr) repeat(4, minmax(0, 1fr)) 20px"
    : "repeat(2, minmax(0, 1fr)) minmax(0, 1.4fr) repeat(4, minmax(0, 1fr)) 20px";

  // Boş durum: hiç talep yoksa (üretim başlamadan önce) tabloyu tanıtan soluk örnek
  // satır + açıklama gösterilir; filtre yüzünden boşsa normal "içerik yok" mesajı kalır.
  const bosMesaj = (
    <div className="p-10 text-center text-sm text-gray-400">Bu kategoride içerik bulunmuyor.</div>
  );
  const ornekSatirDesktop = (
    <>
      <div className="grid gap-3 px-5 py-3 items-center" style={{ gridTemplateColumns: gridCols, opacity: 0.5 }} aria-hidden="true">
        <div className="text-xs text-gray-400 italic truncate text-center">FirmaAdı_10001</div>
        <div className="text-sm font-semibold text-gray-400 italic truncate text-center">Ürün / Eğitim adı</div>
        {teknikGoster && <div className="text-xs text-gray-400 italic truncate text-center">Teknik adı</div>}
        <div className="text-center"><Pill renk={ORNEK_RENK}>Hazır Video</Pill></div>
        <div className="text-center"><Pill renk={ORNEK_RENK}>UTT</Pill></div>
        <div className="text-center"><Pill renk={ORNEK_RENK}>Senaryo</Pill></div>
        <div className="text-center"><Pill renk={ORNEK_RENK} sarabilir>Onayınız Bekleniyor</Pill></div>
        <span className="text-xs text-gray-400 italic text-center">—</span>
        <span className="text-gray-200 text-base">›</span>
      </div>
      <div className="px-5 py-4 text-center text-xs text-gray-400 border-t border-gray-100">
        Henüz üretimin yok. İlk talebini açtığında üretim akışın burada görünecek.
      </div>
    </>
  );
  const ornekSatirMobil = (
    <>
      <div className="px-4 py-3" style={{ opacity: 0.5 }} aria-hidden="true">
        <div className="text-xs text-gray-400 italic mb-1">FirmaAdı_10001</div>
        <div className="text-sm font-bold text-gray-400 italic mb-1.5">Ürün / Eğitim adı</div>
        <div className="flex gap-2 items-center flex-wrap">
          <Pill renk={ORNEK_RENK} sarabilir>Onayınız Bekleniyor</Pill>
          <Pill renk={ORNEK_RENK}>Senaryo</Pill>
          <Pill renk={ORNEK_RENK}>UTT</Pill>
          {teknikGoster && <span className="text-xs text-gray-400 italic">Teknik adı</span>}
        </div>
        <div className="text-xs text-gray-400 mt-1 italic">—</div>
      </div>
      <div className="px-4 py-4 text-center text-xs text-gray-400 border-t border-gray-100">
        Henüz üretimin yok. İlk talebini açtığında üretim akışın burada görünecek.
      </div>
    </>
  );

  return (
    <div className="max-w-6xl mx-auto px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">

      {/* Karşılama */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-extrabold text-gray-900 m-0">Merhaba {ad}, 👋</h1>
          <p className="text-sm text-gray-500 mt-1">
            {takimAdi && <strong style={{ color: "#56aeff", fontWeight: 700 }}>{takimAdi} · </strong>}
            {ROL_ADLARI[rol.toLowerCase()] ?? rol.toUpperCase()}
          </p>
        </div>
        <span className="hidden md:inline text-[10px] text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1 whitespace-nowrap">
          {bugunTarih()}
        </span>
      </div>

      {/* Stat kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        {([
          { label: "Sizden Onay Bekleyen", value: istat.inceleme_bekleyen, sub: "Senaryo, video veya soru seti", renk: "#bc2d0d", git: "/talepler" },
          { label: "Yayına Alınmayı Bekleyen", value: istat.yayin_bekleyen, sub: "Onaylı, yayına alınmadı", renk: "#f59e0b", filtre: "yayin-bekleyen" },
          { label: "Yayında Olanlar", value: istat.yayinda, sub: "UTT'ler izleyebilir", renk: "#16a34a", filtre: "yayinda" },
          { label: "Toplam Talep", value: istat.toplam, sub: "Tüm içerik kalemleri", renk: "#56aeff", filtre: "tumu" },
        ] as { label: string; value: number; sub: string; renk: string; filtre?: string; git?: string }[]).map(k => (
          <div
            key={k.filtre ?? k.git}
            onClick={() => (k.git ? router.push(k.git) : setAktifFiltre(aktifFiltre === k.filtre ? "tumu" : k.filtre!))}
            className="bg-white border border-gray-200 rounded-xl p-3 md:p-5 cursor-pointer transition-shadow duration-150"
            style={{
              borderLeft: `3px solid ${k.renk}`,
              boxShadow: aktifFiltre === k.filtre ? `0 0 0 2px ${k.renk}33` : "none",
            }}
          >
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{k.label}</div>
            <div className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-none">{k.value}</div>
            <div className="hidden md:block text-xs text-gray-500 mt-1.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* İçerik tablosu başlık */}
      <div className="flex items-center justify-between mb-3">
        <div className="inline-flex items-center">
          <span className="text-base font-bold text-gray-900">Yayın Listesi</span>
          <SayfaRehberi anahtar="uretici-yayin-listesi" className="ml-1.5 -translate-y-1.5" />
        </div>
        <div className="flex items-center gap-2">
          {aktifFiltre !== "tumu" && (
            <button
              onClick={() => setAktifFiltre("tumu")}
              className="text-xs text-gray-500 bg-transparent border border-gray-200 rounded-full px-3 py-1 cursor-pointer"
              style={{ fontFamily: "'Nunito', sans-serif" }}
            >
              Filtreyi Kaldır
            </button>
          )}
          <ListeArama arama={liste.arama} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

        {/* Mobile: kart görünümü */}
        <div className="md:hidden">
          {filtrelenmis.length === 0 ? (
            hicTalepYok ? ornekSatirMobil : bosMesaj
          ) : (
            filtrelenmis.map((s, i) => {
              return (
                <div
                  key={`${s.talep_id}-${i}`}
                  onClick={() => router.push(satirYolu(s))}
                  className="px-4 py-3 cursor-pointer"
                  style={{ borderBottom: i < filtrelenmis.length - 1 ? "1px solid #f3f4f6" : "none" }}
                >
                  <div className="text-xs text-gray-500 mb-1">{talepIdGoster(s.firma_adi, s.talep_no)}</div>
                  {/* Mobilde sütun yok: varyant rozeti adın altında kalır. */}
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0 mb-1.5">
                    <span className="text-sm font-bold text-gray-900">{s.urun_adi}</span>
                    <VaryantPill hazirVideo={s.hazir_video} hazirSoruSeti={s.hazir_soru_seti} />
                  </div>
                  {/* Durum tam metindir, kısaltılmaz — mobilde kendi satırından başlar
                      ve sararak sığar (İskender kararı 25.07: "uzayacaksa uzasın"). */}
                  <div className="flex gap-2 items-center flex-wrap">
                    <DurumPill kod={s.durum_kodu} rol={rol} tarih={s.tarih} />
                    <AsamaPill asama={s.asama} />
                    <HedefRolPilleri hedefRoller={s.hedef_roller} />
                    {teknikGoster && <span className="text-xs text-gray-500">{s.teknik_adi}</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{formatTarih(s.tarih)}</div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop: tablo görünümü */}
        <div className="hidden md:block">
          <div className="grid gap-3 px-5 py-2.5 bg-gray-50 border-b border-gray-200" style={{ gridTemplateColumns: gridCols }}>
            {["ID", "Ürün / Eğitim", ...(teknikGoster ? ["TEKNİK"] : []), "ÜRETİM YÖNTEMİ", "HEDEF ROL", "AŞAMA", "DURUM", "YAYIN TARİHİ", ""].map((h, i) => (
              <div key={i} className="text-xs font-bold text-gray-400 uppercase tracking-wide text-center">{h}</div>
            ))}
          </div>
          {filtrelenmis.length === 0 ? (
            hicTalepYok ? ornekSatirDesktop : bosMesaj
          ) : (
            filtrelenmis.map((s, i) => {
              return (
                <div
                  key={`${s.talep_id}-${i}`}
                  onClick={() => router.push(satirYolu(s))}
                  className="grid gap-3 px-5 py-3 items-center cursor-pointer bg-white hover:bg-gray-50 transition-colors duration-100"
                  style={{
                    gridTemplateColumns: gridCols,
                    borderBottom: i < filtrelenmis.length - 1 ? "1px solid #f3f4f6" : "none",
                  }}
                >
                  {/* Tüm hücreler ortalı (İskender kararı 27.07): başlık ile içerik
                      aynı eksende dursun. Pill'ler inline-flex olduğu için text-center
                      onları da ortalar; varyant hücresi flex olduğundan justify-center. */}
                  <div className="text-xs text-gray-500 truncate text-center" title={talepIdGoster(s.firma_adi, s.talep_no)}>{talepIdGoster(s.firma_adi, s.talep_no)}</div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-gray-900 truncate block text-center">{s.urun_adi}</span>
                  </div>
                  {teknikGoster && <div className="text-xs text-gray-500 truncate text-center">{s.teknik_adi}</div>}
                  <div className="flex justify-center"><VaryantPill hazirVideo={s.hazir_video} hazirSoruSeti={s.hazir_soru_seti} kendiSatirinda={false} /></div>
                  <div className="text-center"><HedefRolPilleri hedefRoller={s.hedef_roller} /></div>
                  <div className="text-center"><AsamaPill asama={s.asama} /></div>
                  <div className="text-center"><DurumPill kod={s.durum_kodu} rol={rol} tarih={s.tarih} /></div>
                  <span className="text-xs text-gray-400 whitespace-nowrap text-center">{formatTarih(s.tarih)}</span>
                  <span className="text-gray-300 text-base">›</span>
                </div>
              );
            })
          )}
        </div>

        <DahaFazlaGoster
          dahaVar={liste.dahaVar}
          gorunenSayi={liste.gorunen.length}
          toplam={liste.toplam}
          onGoster={liste.dahaFazlaGoster}
        />

      </div>
    </div>
  );
}
