"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  CircleAlert,
  Film,
  RefreshCw,
  Send,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import UttEczanemDokum from "./_components/UttEczanemDokum";

interface Yayin {
  yayin_id: string;
  urun_adi: string;
  yayin_tarihi: string | null;
}

interface Eczane {
  eczane_id: string;
  eczane_adi: string;
  aktif_uye_sayisi: number;
  esik_uygun: boolean;
}

interface GonderimKaydi {
  yayin_id: string;
  eczane_id: string;
  created_at: string;
}

interface Veri {
  esik: number;
  yayinlar: Yayin[];
  eczaneler: Eczane[];
  gonderimler: GonderimKaydi[];
}

const tarihYaz = (deger: string | null) => {
  if (!deger) return "Yayın tarihi yok";
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(deger));
};

function OzetKarti({ ikon: Icon, etiket, deger, detay, renk, zemin }: {
  ikon: typeof Film;
  etiket: string;
  deger: number;
  detay: string;
  renk: string;
  zemin: string;
}) {
  return (
    <Card className="gap-0 border-[#dfe7f1] py-0 shadow-[0_5px_16px_rgba(31,55,90,0.035)]">
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#8190a3]">{etiket}</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-[#203653]">{deger.toLocaleString("tr-TR")}</p>
          <p className="mt-0.5 text-[10px] font-semibold text-[#8796a8]">{detay}</p>
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ color: renk, background: zemin }}>
          <Icon className="size-4.5" />
        </span>
      </CardContent>
    </Card>
  );
}

export default function UttEczanemPage() {
  const { mesajlar, hata, basari } = useHataMesaji();
  const [veri, setVeri] = useState<Veri | null>(null);
  const [seciliYayin, setSeciliYayin] = useState<string | null>(null);
  const [ilkYukleme, setIlkYukleme] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [veriHatasi, setVeriHatasi] = useState<string | null>(null);
  const [gonderilenEczane, setGonderilenEczane] = useState<string | null>(null);
  const [onayBekleyenEczane, setOnayBekleyenEczane] = useState<Eczane | null>(null);

  const veriCek = useCallback(async (ilk = false) => {
    if (!ilk) setYenileniyor(true);
    setVeriHatasi(null);
    try {
      const res = await fetch("/eczanem/utt/api", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        const mesaj = data.hata ?? data.error ?? "Eczanem verileri yüklenemedi.";
        setVeriHatasi(mesaj);
        hata(mesaj, "Eczanem verileri");
        return;
      }
      setVeri(data);
      setSeciliYayin((onceki) => {
        if (onceki && data.yayinlar?.some((yayin: Yayin) => yayin.yayin_id === onceki)) return onceki;
        return data.yayinlar?.[0]?.yayin_id ?? null;
      });
    } catch {
      const mesaj = "Eczanem verileri yüklenemedi.";
      setVeriHatasi(mesaj);
      hata(mesaj, "Eczanem verileri");
    } finally {
      setIlkYukleme(false);
      setYenileniyor(false);
    }
  }, [hata]);

  useEffect(() => { veriCek(true); }, [veriCek]);

  const yayinlar = veri?.yayinlar ?? [];
  const eczaneler = veri?.eczaneler ?? [];
  const esik = veri?.esik ?? 0;
  const seciliYayinKaydi = yayinlar.find((yayin) => yayin.yayin_id === seciliYayin) ?? null;
  const hazirEczaneSayisi = eczaneler.filter((eczane) => eczane.esik_uygun).length;
  const esikAltiSayisi = eczaneler.length - hazirEczaneSayisi;

  const gonderimMap = useMemo(() => new Map(
    (veri?.gonderimler ?? []).map((gonderim) => [`${gonderim.yayin_id}::${gonderim.eczane_id}`, gonderim]),
  ), [veri?.gonderimler]);

  const seciliYayinGonderilen = seciliYayin
    ? eczaneler.filter((eczane) => gonderimMap.has(`${seciliYayin}::${eczane.eczane_id}`)).length
    : 0;
  const gonderimOrani = eczaneler.length > 0 ? Math.round((seciliYayinGonderilen / eczaneler.length) * 100) : 0;

  const gonder = async () => {
    if (!seciliYayin || !onayBekleyenEczane) return;
    const eczaneId = onayBekleyenEczane.eczane_id;
    setGonderilenEczane(eczaneId);
    setOnayBekleyenEczane(null);
    try {
      const res = await fetch("/eczanem/utt/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yayin_id: seciliYayin, eczane_id: eczaneId }),
      });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? data.error ?? "Video gönderilemedi.", "Eczanem gönderimi"); return; }
      basari(data.mesaj ?? "Video eczaneye gönderildi.");
      await veriCek();
    } catch {
      hata("Video gönderilemedi.", "Eczanem gönderimi");
    } finally {
      setGonderilenEczane(null);
    }
  };

  if (ilkYukleme) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#f7f9fc]">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#71859d]">
          <span className="size-5 animate-spin rounded-full border-2 border-[#d7e4ef] border-t-[#3589d8]" /> Eczanem yükleniyor...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#f7f9fc]" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <HataMesajiContainer mesajlar={mesajlar} />
      <main className="mx-auto flex w-full max-w-[1480px] flex-col gap-5 px-3 py-4 md:px-6 md:py-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#3589d8]">
              <Sparkles className="size-3.5" /> Eczanem saha yönetimi
            </div>
            <h1 className="m-0 text-2xl font-extrabold tracking-[-0.03em] text-[#10213d] md:text-[28px]">Video Dağıtımı</h1>
            <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-[#78889d] md:text-sm">
              Eczanelerinizin üyelik hazırlığını izleyin, uygun eczanelere ürün videosu gönderin ve mutabakat toplamlarını takip edin.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={yenileniyor}
            onClick={() => veriCek()}
            className="border-[#d8e3ee] bg-white font-bold text-[#58708b] hover:bg-[#f4f8fb]"
          >
            <RefreshCw className={yenileniyor ? "animate-spin" : ""} /> Yenile
          </Button>
        </header>

        {veriHatasi && !veri ? (
          <Card className="gap-3 border-[#f2c9c9] bg-[#fffafa] py-8 text-center shadow-none">
            <CardContent className="flex flex-col items-center px-5">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-[#fdecec] text-[#b42318]"><CircleAlert /></span>
              <CardTitle className="mt-3 text-base text-[#7f1d1d]">Veriler yüklenemedi</CardTitle>
              <CardDescription className="mt-1">{veriHatasi}</CardDescription>
              <Button className="mt-4 bg-[#237ac8] hover:bg-[#1d69ad]" onClick={() => veriCek()}>Tekrar dene</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <section aria-label="Eczanem özeti" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <OzetKarti ikon={Film} etiket="Yayındaki video" deger={yayinlar.length} detay="Dağıtıma hazır içerik" renk="#237ac8" zemin="#edf6fd" />
              <OzetKarti ikon={Building2} etiket="Bağlı eczane" deger={eczaneler.length} detay="Aktif saha bağlantısı" renk="#6550b9" zemin="#f1effb" />
              <OzetKarti ikon={CheckCircle2} etiket="Gönderime hazır" deger={hazirEczaneSayisi} detay={`En az ${esik} aktif üye`} renk="#16865f" zemin="#eaf7f2" />
              <OzetKarti ikon={UsersRound} etiket="Eşik altında" deger={esikAltiSayisi} detay="Üyelik gelişimi gerekli" renk="#b7791f" zemin="#fff7e6" />
            </section>

            <section className="grid items-start gap-4 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.55fr)]">
              <Card className="gap-0 overflow-hidden border-[#dfe7f1] py-0 shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
                <CardHeader className="gap-1 border-b border-[#e5ecf4] px-4 py-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-extrabold text-[#203653]"><Film className="size-4 text-[#237ac8]" /> Video seçimi</CardTitle>
                  <CardDescription className="text-[11px] font-semibold text-[#7b8da5]">Eczaneye göndermek istediğiniz ürünü seçin.</CardDescription>
                </CardHeader>
                <CardContent className="p-2.5">
                  {yayinlar.length === 0 ? (
                    <div className="px-4 py-12 text-center">
                      <Film className="mx-auto size-7 text-[#9aabba]" />
                      <p className="mt-3 text-sm font-bold text-[#536981]">Dağıtıma hazır video yok</p>
                      <p className="mt-1 text-xs font-semibold text-[#8a99aa]">Eczanem hedefli yayınlar burada görünür.</p>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {yayinlar.map((yayin) => {
                        const secili = yayin.yayin_id === seciliYayin;
                        const gonderilen = eczaneler.filter((eczane) => gonderimMap.has(`${yayin.yayin_id}::${eczane.eczane_id}`)).length;
                        return (
                          <button
                            type="button"
                            key={yayin.yayin_id}
                            aria-pressed={secili}
                            onClick={() => setSeciliYayin(yayin.yayin_id)}
                            className={`group rounded-xl border p-3 text-left transition ${secili ? "border-[#7db8e8] bg-[#f0f7fd] shadow-[0_0_0_2px_rgba(35,122,200,0.08)]" : "border-[#e2e9f1] bg-white hover:border-[#b9cde0] hover:bg-[#fafcff]"}`}
                          >
                            <div className="flex items-start gap-3">
                              <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${secili ? "bg-[#237ac8] text-white" : "bg-[#edf3f8] text-[#6f879f]"}`}><Film className="size-4" /></span>
                              <span className="min-w-0 flex-1">
                                <strong className="block truncate text-sm text-[#203653]">{yayin.urun_adi}</strong>
                                <small className="mt-0.5 block text-[10px] font-semibold text-[#8695a7]">{tarihYaz(yayin.yayin_tarihi)}</small>
                                <span className="mt-2 flex items-center justify-between text-[10px] font-bold text-[#6f8298]">
                                  <span>{gonderilen}/{eczaneler.length} eczane</span>
                                  {secili && <span className="text-[#237ac8]">Seçili</span>}
                                </span>
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="gap-0 overflow-hidden border-[#dfe7f1] py-0 shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
                <CardHeader className="gap-3 border-b border-[#e5ecf4] px-4 py-4 md:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-sm font-extrabold text-[#203653]"><Building2 className="size-4 text-[#6550b9]" /> Eczaneleriniz</CardTitle>
                      <CardDescription className="mt-1 text-[11px] font-semibold text-[#7b8da5]">
                        {seciliYayinKaydi ? `${seciliYayinKaydi.urun_adi} için gönderim durumu` : "Önce bir video seçin."}
                      </CardDescription>
                    </div>
                    {seciliYayinKaydi && <Badge variant="outline" className="border-[#cbdceb] bg-[#f6faff] font-bold text-[#4c7194]">{seciliYayinGonderilen}/{eczaneler.length} gönderildi</Badge>}
                  </div>
                  {seciliYayinKaydi && (
                    <div className="grid gap-1.5">
                      <Progress value={gonderimOrani} className="h-1.5 bg-[#e8eff6] [&_[data-slot=progress-indicator]]:bg-[#237ac8]" />
                      <span className="text-right text-[10px] font-bold tabular-nums text-[#8190a3]">%{gonderimOrani}</span>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  {eczaneler.length === 0 ? (
                    <div className="px-5 py-14 text-center text-sm font-semibold text-[#8090a4]">Bağlı aktif eczaneniz bulunmuyor.</div>
                  ) : (
                    <Table>
                      <TableHeader className="bg-[#f8fafc]">
                        <TableRow className="hover:bg-[#f8fafc]">
                          <TableHead className="h-9 px-4 text-[10px] font-extrabold uppercase tracking-[0.07em] text-[#8090a4]">Eczane</TableHead>
                          <TableHead className="h-9 text-[10px] font-extrabold uppercase tracking-[0.07em] text-[#8090a4]">Aktif üye</TableHead>
                          <TableHead className="h-9 text-[10px] font-extrabold uppercase tracking-[0.07em] text-[#8090a4]">Durum</TableHead>
                          <TableHead className="h-9 px-4 text-right text-[10px] font-extrabold uppercase tracking-[0.07em] text-[#8090a4]">İşlem</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {eczaneler.map((eczane) => {
                          const gonderim = seciliYayin ? gonderimMap.get(`${seciliYayin}::${eczane.eczane_id}`) : null;
                          const gonderiliyor = gonderilenEczane === eczane.eczane_id;
                          return (
                            <TableRow key={eczane.eczane_id} className="border-[#edf1f5] hover:bg-[#fbfdff]">
                              <TableCell className="px-4 py-3.5">
                                <strong className="block max-w-[240px] truncate text-xs text-[#30475f] md:text-sm">{eczane.eczane_adi}</strong>
                                {gonderim && <small className="mt-0.5 block text-[10px] font-semibold text-[#8a98a9]">{tarihYaz(gonderim.created_at)}</small>}
                              </TableCell>
                              <TableCell className="py-3.5 text-xs font-extrabold tabular-nums text-[#405b74]">{eczane.aktif_uye_sayisi}</TableCell>
                              <TableCell className="py-3.5">
                                {gonderim ? (
                                  <Badge className="border border-[#bde5d5] bg-[#edf9f4] font-bold text-[#157254]">Gönderildi</Badge>
                                ) : eczane.esik_uygun ? (
                                  <Badge variant="outline" className="border-[#bcd8ee] bg-[#f2f8fd] font-bold text-[#286d9f]">Hazır</Badge>
                                ) : (
                                  <Badge variant="outline" className="border-[#efd7a5] bg-[#fff9ed] font-bold text-[#946414]">{esik - eczane.aktif_uye_sayisi} üye eksik</Badge>
                                )}
                              </TableCell>
                              <TableCell className="px-4 py-3.5 text-right">
                                {gonderim ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#16865f]"><CheckCircle2 className="size-3.5" /> Tamamlandı</span>
                                ) : (
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={!seciliYayin || !eczane.esik_uygun || gonderiliyor}
                                    onClick={() => setOnayBekleyenEczane(eczane)}
                                    className="h-8 bg-[#237ac8] px-3 font-bold hover:bg-[#1d69ad]"
                                  >
                                    {gonderiliyor ? <RefreshCw className="animate-spin" /> : <Send />} Gönder
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </section>

            <UttEczanemDokum hata={hata} />
          </>
        )}
      </main>

      <AlertDialog open={!!onayBekleyenEczane} onOpenChange={(acik) => { if (!acik) setOnayBekleyenEczane(null); }}>
        <AlertDialogContent className="border-[#dbe5ef] bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#203653]">Videoyu eczaneye gönderelim mi?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6 text-[#687b90]">
              <strong className="text-[#30475f]">{seciliYayinKaydi?.urun_adi}</strong> videosu <strong className="text-[#30475f]">{onayBekleyenEczane?.eczane_adi}</strong> eczanesine gönderilecek. Aynı video aynı eczaneye yeniden gönderilemez.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={gonder} className="bg-[#237ac8] hover:bg-[#1d69ad]"><Send /> Gönderimi onayla</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
