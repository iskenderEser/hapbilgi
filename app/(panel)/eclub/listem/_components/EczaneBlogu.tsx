"use client";

import { Fragment, useState } from "react";
import { ChevronDown, Pencil, Plus, UserRoundX } from "lucide-react";
import type { Eczane, Kisi, YeniKisiForm } from "../_types";
import { KISI_ROL_ETIKETLERI, epostaGecerliMi, telefonGecerliMi } from "../_types";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import bmStyles from "@/app/(panel)/raporlar/bm/bm-report.module.css";

interface Props {
  sira: number;
  eczane: Eczane;
  kisiler: Kisi[];
  islemLoading: boolean;
  onListedenCikar: (eczaneId: string) => Promise<boolean>;
  onKisiEkle: (eczaneId: string, form: YeniKisiForm) => Promise<boolean>;
  onKisiGuncelle: (kisiId: string, eczaneId: string, alanlar: Partial<{ ad: string; soyad: string; eposta: string; telefon: string }>) => Promise<boolean>;
  onKisiPasifeAl: (kisiId: string, eczaneId: string) => Promise<boolean>;
}

const BOS_KISI: YeniKisiForm = { rol: "", ad: "", soyad: "", eposta: "", telefon: "", sifre: "" };
const ROL_SIRASI: Record<Kisi["rol"], number> = { eczaci: 0, ikinci_eczaci: 1, yardimci_eczaci: 2, eczane_teknisyeni: 3 };
const KISI_GRID = { gridTemplateColumns: "minmax(180px,1.2fr) minmax(120px,.7fr) minmax(180px,1fr) minmax(110px,.65fr) minmax(170px,.8fr)" };

export function EczaneBlogu({ sira, eczane, kisiler, islemLoading, onListedenCikar, onKisiEkle, onKisiGuncelle, onKisiPasifeAl }: Props) {
  const [acik, setAcik] = useState(false);
  const [kisiFormAcik, setKisiFormAcik] = useState(false);
  const [yeniKisi, setYeniKisi] = useState<YeniKisiForm>(BOS_KISI);
  const [duzenlenenKisi, setDuzenlenenKisi] = useState<string | null>(null);
  const [duzenForm, setDuzenForm] = useState<Partial<Kisi>>({});
  const siraliKisiler = [...kisiler].sort((a, b) => ROL_SIRASI[a.rol] - ROL_SIRASI[b.rol] || `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, "tr"));
  const rolAdedi = (rol: Kisi["rol"]) => kisiler.filter((kisi) => kisi.rol === rol).length;
  const yeniKisiGecerli = yeniKisi.rol !== "" && !!yeniKisi.ad.trim() && !!yeniKisi.soyad.trim() && epostaGecerliMi(yeniKisi.eposta) && telefonGecerliMi(yeniKisi.telefon) && yeniKisi.sifre.length >= 6;

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
          <span className={bmStyles.rank}>{sira}</span>
          <button type="button" className={bmStyles.uttToggle} onClick={() => setAcik(!acik)} aria-expanded={acik}>
            <strong>{eczane.eczane_adi}</strong>
            <small>{eczane.toplam_kisi} kayıtlı kişi</small>
            <ChevronDown size={14} className={acik ? bmStyles.chevronOpen : bmStyles.chevron} />
          </button>
        </td>
        <td>{eczane.gln}</td>
        <td>{eczane.eczaci_var ? "Var" : "Yok"}</td>
        <td>{eczane.teknisyen_sayisi}</td>
        <td className={bmStyles.net}>{eczane.toplam_kisi}</td>
        <td>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive"><UserRoundX />Listemden çıkar</Button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eczaneyi listenizden çıkarın mı?</AlertDialogTitle><AlertDialogDescription>{eczane.eczane_adi} E‑Club listenizden kaldırılacak.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Vazgeç</AlertDialogCancel><AlertDialogAction disabled={islemLoading} onClick={() => void onListedenCikar(eczane.eczane_id)} className="bg-destructive hover:bg-destructive/90">Evet, çıkar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
          </AlertDialog>
        </td>
      </tr>

      {acik && (
        <tr className={bmStyles.detailRow}>
          <td colSpan={6}>
            <div className={bmStyles.bmDetailStack}>
              <div className={bmStyles.uttDetail}>
                <div className={bmStyles.detailIntro}><span>Eczane</span><strong>{eczane.eczane_adi}</strong><small>GLN {eczane.gln}</small></div>
                <div className={bmStyles.detailGain}><span>Eczacı</span><strong>{rolAdedi("eczaci")}</strong></div>
                <div className={bmStyles.detailGain}><span>İkinci eczacı</span><strong>{rolAdedi("ikinci_eczaci")}</strong></div>
                <div className={bmStyles.detailGain}><span>Yardımcı eczacı</span><strong>{rolAdedi("yardimci_eczaci")}</strong></div>
                <div className={bmStyles.detailGain}><span>Eczane teknisyeni</span><strong>{rolAdedi("eczane_teknisyeni")}</strong></div>
              </div>

              {siraliKisiler.length > 0 ? (
                <div className={bmStyles.nestedUttWrap}>
                  <div className={bmStyles.nestedUttHeader} style={KISI_GRID}><span>Kişi</span><span>Unvan</span><span>E‑posta</span><span>Telefon</span><span>İşlem</span></div>
                  {siraliKisiler.map((kisi) => (
                    <div key={kisi.kisi_id} className={bmStyles.nestedUttGroup}>
                      <div className={bmStyles.nestedUttRow} style={KISI_GRID}>
                        <span className={bmStyles.nestedUttIdentity}><strong>{kisi.ad} {kisi.soyad}</strong><small>Kişi bilgileri</small></span>
                        <span><Badge variant="outline">{KISI_ROL_ETIKETLERI[kisi.rol]}</Badge></span>
                        <span className="truncate">{kisi.eposta}</span>
                        <span>{kisi.telefon}</span>
                        <span className="flex justify-end gap-1"><Button variant="outline" size="sm" onClick={() => duzenBaslat(kisi)}><Pencil />Düzenle</Button><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive">Pasife al</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Kişiyi pasife alın mı?</AlertDialogTitle><AlertDialogDescription>{kisi.ad} {kisi.soyad} aktif E‑Club listesinden çıkarılacak.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Vazgeç</AlertDialogCancel><AlertDialogAction disabled={islemLoading} onClick={() => void onKisiPasifeAl(kisi.kisi_id, eczane.eczane_id)} className="bg-destructive hover:bg-destructive/90">Pasife al</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></span>
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

              {kisiFormAcik ? (
                <div className="rounded-xl border bg-white p-4">
                  <div className="mb-3"><h3 className="text-sm font-bold">Yeni kişi bilgileri</h3><p className="text-[11px] text-muted-foreground">Kişinin unvanını ve giriş bilgilerini tanımlayın.</p></div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div><Label>Unvan</Label><Select value={yeniKisi.rol} onValueChange={(rol) => setYeniKisi((form) => ({ ...form, rol: rol as YeniKisiForm["rol"] }))}><SelectTrigger className="w-full"><SelectValue placeholder="Unvan seçin" /></SelectTrigger><SelectContent><SelectItem value="eczaci">Eczacı</SelectItem><SelectItem value="ikinci_eczaci">İkinci Eczacı</SelectItem><SelectItem value="yardimci_eczaci">Yardımcı Eczacı</SelectItem><SelectItem value="eczane_teknisyeni">Eczane Teknisyeni</SelectItem></SelectContent></Select></div>
                    <div><Label>Ad</Label><Input value={yeniKisi.ad} onChange={(e) => setYeniKisi((form) => ({ ...form, ad: e.target.value }))} /></div>
                    <div><Label>Soyad</Label><Input value={yeniKisi.soyad} onChange={(e) => setYeniKisi((form) => ({ ...form, soyad: e.target.value }))} /></div>
                    <div><Label>E‑posta</Label><Input type="email" value={yeniKisi.eposta} onChange={(e) => setYeniKisi((form) => ({ ...form, eposta: e.target.value }))} /></div>
                    <div><Label>Telefon</Label><Input value={yeniKisi.telefon} onChange={(e) => setYeniKisi((form) => ({ ...form, telefon: e.target.value.replace(/\D/g, "") }))} maxLength={11} /></div>
                    <div><Label>Geçici şifre</Label><Input value={yeniKisi.sifre} onChange={(e) => setYeniKisi((form) => ({ ...form, sifre: e.target.value }))} /></div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => { setKisiFormAcik(false); setYeniKisi(BOS_KISI); }}>Vazgeç</Button><Button size="sm" disabled={islemLoading || !yeniKisiGecerli} onClick={() => void kisiKaydet()}>{islemLoading ? "Kaydediliyor…" : "Kişiyi kaydet"}</Button></div>
                </div>
              ) : <Button variant="outline" size="sm" className="w-fit bg-white" onClick={() => setKisiFormAcik(true)}><Plus />Kişi ekle</Button>}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
