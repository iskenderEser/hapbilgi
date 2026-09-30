import { trGunu, trGunEkle } from "@/lib/zaman/kontrol";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import { NextRequest, NextResponse } from "next/server";
import { odulSiparisOturumu } from "@/lib/eclub/odulSiparisErisim";
import { eclubYonetimKapsaminiGetir } from "@/lib/eclub/yonetimKapsami";
import { depoKataloguGetir } from "@/lib/eclub/depoSunucu";
import { secilebilirKonumlar, uuidMu } from "@/lib/eclub/depo";
import { isKuraluHatasi, rolHatasi, sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";

export async function GET(request: NextRequest) {
  try {
    const o = await odulSiparisOturumu(); if (o.yanit) return o.yanit;
    const kapsam = await eclubYonetimKapsaminiGetir(o.db, o.kisi);
    const params = request.nextUrl.searchParams;
    const uttId = params.get("utt_id"); const eczaneId = params.get("eczane_id");
    const eczaneArama = params.get("eczane")?.trim() ?? "";
    const depoId = params.get("depo_sube_id");
    const okunma = params.get("okunma"); const offsetHam = params.get("offset") ?? "0";
    if ((uttId && !uuidMu(uttId)) || (eczaneId && !uuidMu(eczaneId)) || !/^\d+$/.test(offsetHam)
      || (okunma && !["okundu", "okunmadi"].includes(okunma)) || eczaneArama.length > 100 || (depoId && !uuidMu(depoId))) return validasyonHatasi("Geçersiz filtre.", ["filtre"]);
    const offset = Number(offsetHam);
    if (!Number.isSafeInteger(offset)) return validasyonHatasi("Geçersiz sayfa.", ["offset"]);
    const uttler = kapsam.uttler.map((u) => u.utt_id);
    if (uttId && !uttler.includes(uttId)) return rolHatasi("UTT yetkili kapsamınızda değil.");
    if (uttler.length === 0) return NextResponse.json({ siparisler: [], toplam: 0, kapsam });
    let q = o.db.from("eclub_store_cek_talepleri").select(`talep_id, eczane_id, yayin_id, talep_eden_kisi_id,
      utt_id, siparis_adet, siparis_mal_fazlasi, durum, created_at,
      depo_sube_id, depo_adi_snapshot, depo_sube_adi_snapshot, depo_il_snapshot, depo_ilce_snapshot,
      depo_adres_snapshot, siparis_okundu_at, siparis_okuyan_utt_id,
      eclub_eczaneler!inner ( eclub_eczane_master!inner ( eczane_adi ) )`, { count: "exact" })
      .eq("firma_id", o.kisi.firma_id).eq("siparis_verildi_mi", true).in("utt_id", uttId ? [uttId] : uttler);
    if (eczaneId) q = q.eq("eczane_id", eczaneId);
    if (eczaneArama) q = q.ilike("eclub_eczaneler.eclub_eczane_master.eczane_adi", `%${eczaneArama.replace(/[\\%_]/g, "")}%`);
    if (depoId) q = q.eq("depo_sube_id", depoId);
    if (okunma === "okundu") q = q.not("siparis_okundu_at", "is", null);
    if (okunma === "okunmadi") q = q.is("siparis_okundu_at", null).neq("durum", "iptal");
    for (const alan of ["baslangic", "bitis"]) {
      const deger = params.get(alan);
      if (!deger) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(deger) || Number.isNaN(Date.parse(deger)) || trGunu(new Date(`${deger}T12:00:00+03:00`)) !== deger) return validasyonHatasi("Geçersiz tarih.", [alan]);
      q = alan === "baslangic" ? q.gte("created_at", `${deger}T00:00:00+03:00`) : q.lt("created_at", `${trGunEkle(deger, 1)}T00:00:00+03:00`);
    }
    const { data: rows, error, count } = await q.order("created_at", { ascending: false }).order("talep_id").range(offset, offset + 29);
    if (error) throw new Error(error.message);
    if (!rows?.length) return NextResponse.json({ siparisler: [], toplam: count ?? 0, kapsam });
    const eczaneler = [...new Set(rows.map((r) => r.eczane_id))];
    const [tercihler, kimlikler, kisiler, yayinlar, okuyanlar, katalog, teslimatlar] = await Promise.all([
      o.db.from("eclub_eczane_depo_tercihleri").select("eczane_id, depo_sube_id").in("eczane_id", eczaneler),
      o.db.from("eclub_eczaneler").select("eczane_id, gln").in("eczane_id", eczaneler),
      o.db.from("eclub_kisiler").select("kisi_id, ad, soyad").in("kisi_id", [...new Set(rows.map((r) => r.talep_eden_kisi_id))]),
      o.db.from("v_yayin_kunye").select("yayin_id, urun_id").in("yayin_id", [...new Set(rows.map((r) => r.yayin_id))]),
      o.db.from("kullanicilar").select("kullanici_id, ad, soyad").in("kullanici_id", [...new Set(rows.flatMap((r) => r.siparis_okuyan_utt_id ? [r.siparis_okuyan_utt_id] : [])), o.kisi.kullanici_id]),
      depoKataloguGetir(o.db),
      o.db.from("eclub_odul_siparis_outbox").select("talep_id, kanal, durum, deneme_sayisi, max_deneme").in("talep_id", rows.map((r) => r.talep_id)),
    ]);
    for (const result of [tercihler, kimlikler, kisiler, yayinlar, okuyanlar, teslimatlar]) if (result.error) throw new Error(result.error.message);
    const glnler = (kimlikler.data ?? []).map((k) => k.gln);
    const urunIdler = [...new Set((yayinlar.data ?? []).flatMap((y) => y.urun_id ? [y.urun_id] : []))];
    const [masterlar, urunler] = await Promise.all([
      o.db.from("eclub_eczane_master").select("gln, eczane_adi").in("gln", glnler),
      urunIdler.length ? o.db.from("urunler").select("urun_id, urun_adi").in("urun_id", urunIdler) : Promise.resolve({ data: [], error: null }),
    ]);
    if (masterlar.error || urunler.error) throw new Error(masterlar.error?.message ?? urunler.error?.message);
    const siparisler = rows.map((r) => {
      const gln = kimlikler.data?.find((k) => k.eczane_id === r.eczane_id)?.gln;
      const kisi = kisiler.data?.find((k) => k.kisi_id === r.talep_eden_kisi_id);
      const urunId = yayinlar.data?.find((y) => y.yayin_id === r.yayin_id)?.urun_id;
      const okuyan = okuyanlar.data?.find((k) => k.kullanici_id === r.siparis_okuyan_utt_id);
      const hedefler = new Set((tercihler.data ?? []).filter((t) => t.eczane_id === r.eczane_id).map((t) => t.depo_sube_id));
      const kanal = (ad: string) => { const t = teslimatlar.data?.find((x) => x.talep_id === r.talep_id && x.kanal === ad); return t ? (t.durum === "basarisiz" && t.deneme_sayisi >= t.max_deneme ? "Kalıcı hata" : t.durum) : null; };
      return { ...r, eczane_adi: masterlar.data?.find((m) => m.gln === gln)?.eczane_adi ?? "Eczane",
        kisi_adi: kisi ? `${kisi.ad} ${kisi.soyad}` : "—",
        urun_adi: urunler.data?.find((u) => u.urun_id === urunId)?.urun_adi ?? "Ürün bilgisi eksik",
        utt_adi: kapsam.uttler.find((u) => u.utt_id === r.utt_id)?.utt_adi ?? "—",
        okuyan_adi: okuyan ? `${okuyan.ad} ${okuyan.soyad}` : null,
        tercihler: katalog.filter((k) => hedefler.has(k.depo_sube_id) && secilebilirKonumlar(katalog, k.depo_id).some((x) => x.depo_sube_id === k.depo_sube_id)),
        eposta_durumu: kanal("eposta"), push_durumu: kanal("push"),
      };
    });
    return NextResponse.json({ siparisler, toplam: count ?? 0, kapsam });
  } catch (error) { return sunucuHatasi(error, "Ödül sipariş takip listesi"); }
}

export async function POST(request: NextRequest) {
  try {
    const o = await odulSiparisOturumu(); if (o.yanit) return o.yanit;
    if (!TUKETICI_ROLLER.includes(o.kisi.rol ?? "")) return rolHatasi("Siparişi yalnız atanmış UTT Okundu yapabilir.");
    const body = await request.json();
    if (!uuidMu(body.talep_id) || !uuidMu(body.depo_sube_id)) return validasyonHatasi("Sipariş ve hedef depo/şube zorunludur.", ["talep_id", "depo_sube_id"]);
    const { error } = await o.db.rpc("eclub_odul_siparis_oku", { p_utt_id: o.kisi.kullanici_id, p_talep_id: body.talep_id, p_konum: body.depo_sube_id });
    if (error) return isKuraluHatasi(error.message);
    return NextResponse.json({ mesaj: "Sipariş Okundu olarak işaretlendi; eczacı bilgilendirmesi kuyruğa alındı." });
  } catch (error) { return sunucuHatasi(error, "Ödül sipariş Okundu işlemi"); }
}
