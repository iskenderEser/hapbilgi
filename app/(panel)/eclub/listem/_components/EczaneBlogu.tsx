"use client";

import { Fragment, useRef, useState } from "react";
import { ChevronDown, Clock3, Pencil, Plus, UserRoundX, X } from "lucide-react";
import type { EclubGecisTalebi, Eczane, Kisi, YeniKisiForm } from "../_types";
import { KISI_ROL_ETIKETLERI, epostaGecerliMi, telefonGecerliMi } from "../_types";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DepoAramaliSecim, type DepoAramaliSecimHandle } from "@/components/eclub/DepoAramaliSecim";
import { depoOzetEtiketi, type DepoKonumu } from "@/lib/eclub/depo";
import bmStyles from "@/app/(panel)/raporlar/bm/bm-report.module.css";
import styles from "./EczaneBlogu.module.css";

interface Props {
  eczane: Eczane;
  kisiler: Kisi[];
  gecisTalepleri: EclubGecisTalebi[];
  islemLoading: boolean;
  onListedenCikar: (eczaneId: string) => Promise<boolean>;
  onKisiEkle: (eczaneId: string, form: YeniKisiForm) => Promise<boolean>;
  onKisiGuncelle: (kisiId: string, eczaneId: string, alanlar: Partial<{ ad: string; soyad: string; eposta: string; telefon: string }>) => Promise<boolean>;
  onKisiPasifeAl: (kisiId: string, eczaneId: string) => Promise<boolean>;
}

const BOS_KISI: YeniKisiForm = { rol: "", ad: "", soyad: "", eposta: "", telefon: "" };
const ROL_SIRASI: Record<Kisi["rol"], number> = { eczaci: 0, ikinci_eczaci: 1, yardimci_eczaci: 2, eczane_teknisyeni: 3 };
const UNVAN_PIL_RENKLERI: Record<Kisi["rol"], string> = {
  eczaci: "border-red-200 bg-red-50 text-red-700",
  ikinci_eczaci: "border-blue-200 bg-blue-50 text-blue-700",
  yardimci_eczaci: "border-violet-200 bg-violet-50 text-violet-700",
  eczane_teknisyeni: "border-emerald-200 bg-emerald-50 text-emerald-700",
};
const KISI_GRID = { gridTemplateColumns: "minmax(180px,1.2fr) minmax(120px,.7fr) minmax(180px,1fr) minmax(110px,.65fr) minmax(170px,.8fr)" };

export function EczaneBlogu({ eczane, kisiler, gecisTalepleri, islemLoading, onListedenCikar, onKisiEkle, onKisiGuncelle, onKisiPasifeAl }: Props) {
  const [acik, setAcik] = useState(false);
  const [kayitliDepolar, setKayitliDepolar] = useState<DepoKonumu[] | null | undefined>(undefined);
  const depoDuzenleyiciRef = useRef<DepoAramaliSecimHandle>(null);
  const [depoSiliniyor, setDepoSiliniyor] = useState(false);
  const [depoSilmeHatasi, setDepoSilmeHatasi] = useState("");
  const [davetIslem, setDavetIslem] = useState<string | null>(null);
  const [davetMesaji, setDavetMesaji] = useState("");
  const [gonderilenDavetler, setGonderilenDavetler] = useState<string[]>([]);
  const [kisiFormAcik, setKisiFormAcik] = useState(false);
  const [yeniKisi, setYeniKisi] = useState<YeniKisiForm>(BOS_KISI);
  const [duzenlenenKisi, setDuzenlenenKisi] = useState<string | null>(null);
  const [duzenForm, setDuzenForm] = useState<Partial<Kisi>>({});
  const siraliKisiler = [...kisiler].sort((a, b) => ROL_SIRASI[a.rol] - ROL_SIRASI[b.rol] || `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, "tr"));
  const eczaciAdlari = siraliKisiler.filter((kisi) => kisi.rol === "eczaci").map((kisi) => `${kisi.ad} ${kisi.soyad}`.trim()).join(", ");
  const rolAdedi = (rol: Kisi["rol"]) => kisiler.filter((kisi) => kisi.rol === rol).length;
  const yeniKisiGecerli = yeniKisi.rol !== "" && !!yeniKisi.ad.trim() && !!yeniKisi.soyad.trim() && epostaGecerliMi(yeniKisi.eposta) && telefonGecerliMi(yeniKisi.telefon);

  const davetiGonder = async (kisiId: string) => {
    if (davetIslem) return;
    setDavetIslem(kisiId); setDavetMesaji("");
    try {
      const r = await fetch("/eclub/listem/api/davet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kisi_id: kisiId, eczane_id: eczane.eczane_id }) });
      const d = await r.json();
      if (r.ok && d.gonderildi) setGonderilenDavetler((ids) => [...ids, kisiId]);
      setDavetMesaji(d.hata ?? d.mesaj ?? "Davet gönderilemedi.");
    } catch { setDavetMesaji("Bağlantı hatası. Davet gönderilemedi."); }
    finally { setDavetIslem(null); }
  };
  const kisiKaydet = async () => {
    if (await onKisiEkle(eczane.eczane_id, yeniKisi)) { setYeniKisi(BOS_KISI); setKisiFormAcik(false); }
  };
  const duzenBaslat = (kisi: Kisi) => {
    setDuzenlenenKisi(kisi.kisi_id);
    setDuzenForm({ ad: kisi.ad, soyad: kisi.soyad, eposta: kisi.eposta, telefon: kisi.telefon });
  };
  const duzenKaydet = async (kisiId: string) => {
    if (await onKisiGuncelle(kisiId, eczane.eczane_id, { ad: duzenForm.ad, soyad: duzenForm.soyad, eposta: duzenForm.eposta, telefon: duzenForm.telefon })) { setDuzenlenenKisi(null); setDuzenForm({}); }
  };

  return (
    <Fragment>
      <tr className={acik ? bmStyles.openRow : undefined}>
        <td>
          <button type="button" className={bmStyles.uttToggle} onClick={() => setAcik(!acik)} aria-expanded={acik}>
            <strong>{eczane.eczane_adi}</strong>
            <ChevronDown size={14} className={acik ? bmStyles.chevronOpen : bmStyles.chevron} />
          </button>
        </td>
        <td>{eczaciAdlari ? `Eczacı ${eczaciAdlari}` : "—"}</td>
        <td style={{ textAlign: "right" }} className="whitespace-nowrap">
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive"><UserRoundX />Listemden çıkar</Button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eczanenin listenizden kalıcı olarak çıkarılmasını onaylıyor musunuz?</AlertDialogTitle><AlertDialogDescription>{eczane.eczane_adi} E‑Club listenizden çıkarılacak.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Vazgeç</AlertDialogCancel><AlertDialogAction disabled={islemLoading} onClick={() => void onListedenCikar(eczane.eczane_id)} className="bg-destructive hover:bg-destructive/90">Onaylıyorum</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
          </AlertDialog>
        </td>
      </tr>

      {acik && (
        <tr className={bmStyles.detailRow}>
          <td colSpan={3}>
            <div className={bmStyles.bmDetailStack}>
              <div className={`${bmStyles.uttDetail} ${styles.ozetKartlari}`} data-depo-sayisi={kayitliDepolar?.length ?? 0}>
                <div className={bmStyles.detailIntro}><strong title={eczane.eczane_adi}>{eczane.eczane_adi}</strong><small title={`GLN ${eczane.gln}`}>GLN {eczane.gln}</small></div>
                <div className={bmStyles.detailGain}><span>Eczacı</span><strong>{rolAdedi("eczaci")}</strong></div>
                <div className={bmStyles.detailGain}><span>İkinci eczacı</span><strong>{rolAdedi("ikinci_eczaci")}</strong></div>
                <div className={bmStyles.detailGain}><span>Yardımcı eczacı</span><strong>{rolAdedi("yardimci_eczaci")}</strong></div>
                <div className={bmStyles.detailGain}><span>Eczane teknisyeni</span><strong>{rolAdedi("eczane_teknisyeni")}</strong></div>
                {kayitliDepolar?.length ? kayitliDepolar.map((depo, index) => (
                  <div key={depo.depo_sube_id} className={styles.depoKarti}>
                    <span>{index === 0 ? "1.Tercih" : index === 1 ? "2.Tercih" : "3. Tercih"}</span>
                    <button type="button" className={styles.depoSil} disabled={depoSiliniyor || kayitliDepolar.length === 1} aria-label={`${depoOzetEtiketi(depo)} tercihini kaldır`} title={kayitliDepolar.length === 1 ? "En az bir depo tercihi kalmalıdır." : "Depo tercihini kaldır"} onClick={async () => {
                      if (!depoDuzenleyiciRef.current) return;
                      setDepoSiliniyor(true); setDepoSilmeHatasi("");
                      try { const hata = await depoDuzenleyiciRef.current.tercihKaldir(depo.depo_sube_id); if (hata) setDepoSilmeHatasi(hata); }
                      finally { setDepoSiliniyor(false); }
                    }}><X size={12} /></button>
                    <strong title={`${depo.depo_adi}${depo.sube_adi ? ` / ${depo.sube_adi}` : ""} · ${depo.il} / ${depo.ilce} · ${depo.adres}`}>{depoOzetEtiketi(depo)}</strong>
                  </div>
                )) : <div className={styles.depoKarti}>
                  <span>1.Tercih</span>
                  <small>{kayitliDepolar === undefined ? "Yükleniyor…" : kayitliDepolar === null ? "Depo bilgisi alınamadı." : "Kayıtlı depo yok."}</small>
                </div>}
                <div className={styles.eklemeButonlari}>
                  <Button type="button" variant="outline" size="sm" className={styles.eklemeButonu} disabled={kisiFormAcik} onClick={() => setKisiFormAcik(true)}><Plus />Kişi ekle</Button>
                  <DepoAramaliSecim ref={depoDuzenleyiciRef} eczaneId={eczane.eczane_id}  onKayitliTercihler={(depolar) => { setKayitliDepolar(depolar); setDepoSilmeHatasi(""); }} />
                </div>
              </div>

              {davetMesaji && <p role="status" className="text-xs text-[#60758c]">{davetMesaji}</p>}
              {depoSilmeHatasi && <p role="alert" className="text-xs text-red-700">{depoSilmeHatasi}</p>}
              {siraliKisiler.length > 0 ? (
                <div className={bmStyles.nestedUttWrap}>
                  <div className={bmStyles.nestedUttHeader} style={KISI_GRID}><span>Kişi</span><span>Unvan</span><span>E‑posta</span><span>Telefon</span><span>İşlem</span></div>
                  {siraliKisiler.map((kisi) => (
                    <div key={kisi.kisi_id} className={bmStyles.nestedUttGroup}>
                      <div className={bmStyles.nestedUttRow} style={KISI_GRID}>
                        <span className={bmStyles.nestedUttIdentity}><strong>{kisi.ad} {kisi.soyad}</strong><small>{kisi.davet_bekliyor ? ((kisi.davet_gonderildi || gonderilenDavetler.includes(kisi.kisi_id)) ? "Davet bekliyor" : "Davet gönderimi bekliyor") : "Kişi bilgileri"}</small></span>
                        <span><Badge variant="outline" className={UNVAN_PIL_RENKLERI[kisi.rol]}>{KISI_ROL_ETIKETLERI[kisi.rol]}</Badge></span>
                        <span className="truncate">{kisi.eposta}</span>
                        <span>{kisi.telefon}</span>
                        <span className="flex flex-wrap justify-end gap-1">{kisi.davet_bekliyor && <Button variant="outline" size="sm" disabled={!!davetIslem || islemLoading} onClick={() => void davetiGonder(kisi.kisi_id)}>{davetIslem === kisi.kisi_id ? "Gönderiliyor…" : "Daveti yeniden gönder"}</Button>}<Button variant="outline" size="sm" onClick={() => duzenBaslat(kisi)}><Pencil />Düzenle</Button><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive">Pasife al</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Kişiyi pasife alın mı?</AlertDialogTitle><AlertDialogDescription>{kisi.ad} {kisi.soyad} aktif E‑Club listesinden çıkarılacak.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Vazgeç</AlertDialogCancel><AlertDialogAction disabled={islemLoading} onClick={() => void onKisiPasifeAl(kisi.kisi_id, eczane.eczane_id)} className="bg-destructive hover:bg-destructive/90">Pasife al</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></span>
                      </div>
                      {duzenlenenKisi === kisi.kisi_id && (
                        <div className={bmStyles.nestedUttDetail}>
                          <div><Label>Ad</Label><Input value={duzenForm.ad ?? ""} onChange={(e) => setDuzenForm((form) => ({ ...form, ad: e.target.value }))} /></div>
                          <div><Label>Soyad</Label><Input value={duzenForm.soyad ?? ""} onChange={(e) => setDuzenForm((form) => ({ ...form, soyad: e.target.value }))} /></div>
                          <div><Label>E‑posta</Label><Input type="email" value={duzenForm.eposta ?? ""} onChange={(e) => setDuzenForm((form) => ({ ...form, eposta: e.target.value }))} /></div>
                          <div><Label>Telefon</Label><Input value={duzenForm.telefon ?? ""} onChange={(e) => setDuzenForm((form) => ({ ...form, telefon: e.target.value.replace(/\D/g, "") }))} maxLength={11} /></div>
                          <div className="flex items-end gap-2"><Button variant="outline" size="sm" onClick={() => { setDuzenlenenKisi(null); setDuzenForm({}); }}>Vazgeç</Button><Button size="sm" disabled={islemLoading} onClick={() => void duzenKaydet(kisi.kisi_id)}>Kaydet</Button></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : <div className={bmStyles.empty}>Bu eczanede kayıtlı kişi bulunmuyor.</div>}

              {gecisTalepleri.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                  <div className="mb-3 flex items-start gap-2">
                    <Clock3 className="mt-0.5 size-4 shrink-0 text-amber-700" />
                    <div>
                      <h3 className="text-sm font-extrabold text-amber-900">E-Club üyelik geçişi bekleyenler</h3>
                      <p className="mt-1 text-[11px] font-semibold leading-5 text-amber-800">Bu kayıtlar henüz aktif değildir. Müşteri mevcut puanı için karar verdiğinde aynı giriş hesabıyla E-Club üyeliği etkinleştirilecektir.</p>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    {gecisTalepleri.map((talep) => (
                      <div key={talep.gecis_id} className="grid gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2.5 md:grid-cols-[minmax(160px,1fr)_minmax(130px,.7fr)_minmax(190px,1fr)_auto] md:items-center">
                        <div><strong className="block text-xs text-[#30475f]">{talep.ad} {talep.soyad}</strong><span className="text-[10px] font-semibold text-[#8796a8]">{talep.telefon}</span></div>
                        <Badge variant="outline" className="w-fit border-amber-200 bg-amber-50 text-amber-800">{KISI_ROL_ETIKETLERI[talep.rol]}</Badge>
                        <span className="truncate text-xs font-semibold text-[#60758c]">{talep.eposta}</span>
                        <Badge className="w-fit bg-amber-100 text-amber-800 hover:bg-amber-100">{talep.durum === "puan_kullaniliyor" ? "Puan kullanımı bekleniyor" : "Müşteri kararı bekleniyor"}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {kisiFormAcik && (
                <div className="rounded-xl border bg-white p-4">
                  <div className="mb-3"><h3 className="text-sm font-bold">Yeni kişi bilgileri</h3><p className="text-[11px] text-muted-foreground">Kişinin bilgilerini girin. Yeni üyeye şifre oluşturma daveti e-postayla gönderilir.</p></div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div><Label>Unvan</Label><Select value={yeniKisi.rol} onValueChange={(rol) => setYeniKisi((form) => ({ ...form, rol: rol as YeniKisiForm["rol"] }))}><SelectTrigger className="w-full"><SelectValue placeholder="Unvan seçin" /></SelectTrigger><SelectContent><SelectItem value="eczaci">Eczacı</SelectItem><SelectItem value="ikinci_eczaci">İkinci Eczacı</SelectItem><SelectItem value="yardimci_eczaci">Yardımcı Eczacı</SelectItem><SelectItem value="eczane_teknisyeni">Eczane Teknisyeni</SelectItem></SelectContent></Select></div>
                    <div><Label>Ad</Label><Input value={yeniKisi.ad} onChange={(e) => setYeniKisi((form) => ({ ...form, ad: e.target.value }))} /></div>
                    <div><Label>Soyad</Label><Input value={yeniKisi.soyad} onChange={(e) => setYeniKisi((form) => ({ ...form, soyad: e.target.value }))} /></div>
                    <div><Label>E‑posta</Label><Input type="email" value={yeniKisi.eposta} onChange={(e) => setYeniKisi((form) => ({ ...form, eposta: e.target.value }))} /></div>
                    <div><Label>Telefon</Label><Input value={yeniKisi.telefon} onChange={(e) => setYeniKisi((form) => ({ ...form, telefon: e.target.value.replace(/\D/g, "") }))} maxLength={11} /></div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => { setKisiFormAcik(false); setYeniKisi(BOS_KISI); }}>Vazgeç</Button><Button size="sm" disabled={islemLoading || !yeniKisiGecerli} onClick={() => void kisiKaydet()}>{islemLoading ? "Kaydediliyor…" : "Kişiyi kaydet"}</Button></div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
