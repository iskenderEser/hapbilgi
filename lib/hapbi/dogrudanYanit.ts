import type { HapbiDogrudanPlan } from "@/lib/hapbi/soruPlani";
import type { HapbiAracSonucu, HapbiYanit } from "@/lib/hapbi/sozlesme";

type DogrudanSonuc = HapbiYanit & { araclar: string[]; tokenSayisi: number; yol: "dogrudan" };
type Kisi = { ad_soyad: string; puan: number | null; sira: number | null; firma_sirasi: number | null; takim_sirasi: number | null; bolge_sirasi: number | null; benim: boolean };
type BolgeKanonik = { bolge_id: string; ad: string; puan: number | null; sira: number | null; toplam_bolge: number };
type TakimKanonik = { takim_id: string; ad: string; puan: number | null; sira: number | null; toplam_takim: number };
type BolgeDetayKanonik = {
  bolge_id: string;
  ad: string;
  sira: number;
  net_puan: number;
  kazanilan_toplam: number;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puani: number;
  kaybedilen_toplam: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_utt: number;
  en_cok_kaybeden_uttler: {
    kullanici_id: string;
    ad_soyad: string;
    toplam_kayip: number;
    ileri_sarma_kaybi: number;
    yanlis_cevap_kaybi: number;
    oneri_kaybi: number;
    net_puan: number;
  }[];
};
type KanonikLig = {
  veri_durumu: string;
  sira_turu: string;
  kisiler?: Kisi[];
  liderler: Kisi[];
  ilk_iki: Kisi[];
  ilk_iki_puan_farki: number | null;
  kendi: Kisi | null;
  bolge?: BolgeKanonik | null;
  takim?: TakimKanonik | null;
  bolgeler?: BolgeDetayKanonik[];
};

function nesne(deger: unknown): Record<string, unknown> {
  return deger && typeof deger === "object" && !Array.isArray(deger) ? deger as Record<string, unknown> : {};
}

function taban(cevap: string, plan: HapbiDogrudanPlan, sonuc?: HapbiAracSonucu, ekKaynaklar?: HapbiAracSonucu["kaynak"][]): DogrudanSonuc {
  const kaynaklar = [
    ...(sonuc?.kaynak ? [sonuc.kaynak] : []),
    ...(ekKaynaklar?.filter(Boolean) ?? []),
  ];
  return {
    cevap, kaynaklar: kaynaklar as any[], model: "deterministik",
    ...(sonuc?.egitimler?.length ? { egitimler: sonuc.egitimler } : {}),
    araclar: plan.araclar ? Array.from(new Set(plan.araclar.map(a => a.ad))) : plan.arac ? [plan.arac] : [], tokenSayisi: 0, yol: "dogrudan",
  };
}

function donemEtiketi(p: Record<string, string | number> = {}): string {
  if (p.periyot === "donem") return `${p.ceyrek}. çeyrekte`;
  if (p.periyot === "hafta") return "bu hafta";
  if (p.periyot === "ay") return "bu ay";
  if (p.periyot === "yil") return `${p.yil} yılında`;
  return "seçilen dönemde";
}

function ligKanonik(sonuc?: HapbiAracSonucu): KanonikLig | null {
  const k = nesne(nesne(sonuc?.veri).kanonik);
  if (!Array.isArray(k.liderler) || !Array.isArray(k.ilk_iki)) return null;
  return k as unknown as KanonikLig;
}

function puan(deger: number | null): string { return deger === null ? "hesaplanamadı" : `${deger} puan`; }

export function hapbiDogrudanYanitUret(
  plan: HapbiDogrudanPlan,
  soru: string,
  sonuc?: HapbiAracSonucu,
  ekSonuclar?: HapbiAracSonucu[],
): DogrudanSonuc {
  if (plan.niyet === "netlestir") {
    const soruMetni = plan.netlestirme?.soru ?? "Hangi dönemi esas alayım: hafta, ay, çeyrek veya yıl?";
    return taban(soruMetni, plan);
  }
  if (plan.niyet === "yetki_reddi") return taban("Yetkinizi değiştiremem ve başka firmaların verilerine erişemem. Yalnız doğrulanmış rolünüz ve kendi kapsamınızdaki bilgileri gösterebilirim.", plan);
  if (plan.niyet === "eclub_yetkisiz") return taban("HapBi kurumsal analiz asistanı şirket içi roller içindir; E-Club eczane üyelerine kapalıdır. Eğitim ve puan durumunuzu E-Club panelinizden takip edebilirsiniz.", plan);
  if (plan.niyet === "desteklenmiyor") return taban("Bu rolde kişisel C-Club puanının okunması desteklenmiyor. Firma C-Club ligi ayrı bir kapsamdır.", plan);
  if (plan.niyet === "begeni_favori_bilgisi") return taban("Beğeni ve favoriler video arayüz etkileşimidir ve ana sayfadaki ilgili raflarda listelenir; T-Club ligi başarı sıralamasına ve puanlamaya dahil değildir. Dilerseniz en yüksek net puan, en çok izlenen veya en yüksek doğru yanıta sahip ürün ve eğitimleri sorgulayabilirsiniz.", plan);

  if (plan.niyet === "bm_cift_sapka") {
    const ccSonuc = ekSonuclar?.[0] ?? (plan.araclar?.[0]?.parametre?.lig === "cc" ? sonuc : undefined);
    const hbSonuc = ekSonuclar?.[1];
    const donem = donemEtiketi(plan.parametre ?? plan.araclar?.[0]?.parametre);
    const donemBaslik = donem === "seçilen dönemde" ? "Dönem durumunuz" : `${donem[0].toLocaleUpperCase("tr-TR")}${donem.slice(1)} durumunuz`;

    const ccK = ligKanonik(ccSonuc);
    const ccKisi = ccK?.kendi;
    const ccSira = ccKisi ? (ccKisi.firma_sirasi ?? ccKisi.sira) : null;
    const ccMetni = ccKisi && ccKisi.puan !== null
      ? `${ccKisi.puan} net puan (${ccSira ? `${ccSira}. sıradasınız` : "sıranız hesaplanamadı"})`
      : "C-Club lig kaydınız bulunamadı";

    const hbK = hbSonuc ? nesne(nesne(hbSonuc.veri).kanonik) : null;
    const bolge = hbK && typeof hbK.bolge === "object" && hbK.bolge !== null
      ? hbK.bolge as BolgeKanonik
      : null;
    const hbMetni = bolge && bolge.puan !== null && bolge.puan !== undefined
      ? `${bolge.puan} net puan (${bolge.sira ? `Bölgeniz takımında ${bolge.sira}. sırada` : "bölge sırası hesaplanamadı"})`
      : "Bölgenizin T-Club saha kaydı bulunamadı";

    const cevap = `${donemBaslik}:\n• 🎯 **Kişisel C-Club Liginiz:** ${ccMetni}\n• 🏢 **Bölgenizin T-Club Saha Toplamı:** ${hbMetni}`;
    const ekKaynaklar = hbSonuc?.kaynak ? [hbSonuc.kaynak] : [];
    return taban(cevap, plan, ccSonuc, ekKaynaklar);
  }

  if (!sonuc || !["ok", "bos"].includes(sonuc.durum)) {
    return taban(sonuc?.aciklama ?? (sonuc?.durum === "yetkisiz" ? "Bu bilgiye mevcut rol ve kapsamınızla erişilemiyor." : "İstenen veri şu anda doğrulanamadı."), plan, sonuc);
  }

  if (plan.niyet === "platform_bilgisi") {
    const veri = nesne(sonuc.veri);
    const bilgiler = Array.isArray(veri.bilgiler) ? (veri.bilgiler as { baslik?: string; metin?: string }[]) : [];
    if (bilgiler.length === 1 && bilgiler[0].metin) {
      return taban(bilgiler[0].metin, plan, sonuc);
    }
    if (bilgiler.length > 1) {
      const birlestirilmis = bilgiler.map((b) => b.metin).filter(Boolean).join("\n\n");
      return taban(birlestirilmis, plan, sonuc);
    }
    if (typeof veri.aciklama === "string" && veri.aciklama) {
      return taban(veri.aciklama, plan, sonuc);
    }
    return taban("Platform bilgisi bulunamadı.", plan, sonuc);
  }

  const donem = donemEtiketi(plan.parametre ?? plan.araclar?.[0]?.parametre);

  if (plan.niyet === "uretim_ozeti") {
    const k = nesne(nesne(sonuc.veri).kanonik);
    return taban(`${donem[0].toLocaleUpperCase("tr-TR")}${donem.slice(1)} ${Number(k.donemde_yayina_alinan ?? 0)} yayın yayına alındı; ${Number(k.su_an_yayinda ?? 0)} yayın şu anda yayında.`, plan, sonuc);
  }
  if (plan.niyet === "egitim_listesi") {
    const k = nesne(nesne(sonuc.veri).kanonik);
    const egitimler = Array.isArray(k.egitimler) ? k.egitimler as { ad?: string }[] : [];
    if (!egitimler.length) return taban("Bu turda başlamadığınız bir eğitim görünmüyor.", plan, sonuc);
    const adlar = egitimler.slice(0, 6).map(egitim => egitim.ad).filter(Boolean).join(", ");
    const ek = Number(k.toplam_eslesen ?? egitimler.length) > 6 ? " İlk 6 sonuç gösteriliyor." : "";
    return { ...taban(`Bu turda başlamadığınız eğitimler arasında ${adlar} bulunuyor.${ek}`, plan, sonuc), egitimler: sonuc.egitimler?.slice(0, 6) };
  }

  const k = ligKanonik(sonuc);
  if (!k || !k.liderler.length) return taban(`${donem[0].toLocaleUpperCase("tr-TR")}${donem.slice(1)} lig verisi bulunamadı.`, plan, sonuc);
  if (plan.niyet === "lig_lideri") {
    if (k.veri_durumu === "sifir_esitlik" || k.liderler.length > 1) {
      return taban(`${donem[0].toLocaleUpperCase("tr-TR")}${donem.slice(1)} herkes ${puan(k.liderler[0].puan)} ile eşit; bu nedenle tek bir lider yok.`, plan, sonuc);
    }
    const lider = k.liderler[0];
    const sorulan = (k.kisiler ?? [...k.ilk_iki, ...k.liderler]).find(kisi => kisi.ad_soyad !== lider.ad_soyad && soru.toLocaleLowerCase("tr-TR").includes(kisi.ad_soyad.split(" ")[0].toLocaleLowerCase("tr-TR")));
    const duzeltme = sorulan ? ` ${sorulan.ad_soyad} ${puan(sorulan.puan)} ile lider değil.` : "";
    return taban(`${donem[0].toLocaleUpperCase("tr-TR")}${donem.slice(1)} lider ${lider.ad_soyad}; net puanı ${puan(lider.puan)}.${duzeltme}`, plan, sonuc);
  }
  if (plan.niyet === "lig_ilk_iki_fark") {
    if (k.ilk_iki.length < 2 || k.ilk_iki_puan_farki === null) return taban(`${donem[0].toLocaleUpperCase("tr-TR")}${donem.slice(1)} ilk iki kişi ve puan farkı hesaplanamadı.`, plan, sonuc);
    return taban(`${donem[0].toLocaleUpperCase("tr-TR")}${donem.slice(1)} ilk iki kişi ${k.ilk_iki[0].ad_soyad} (${puan(k.ilk_iki[0].puan)}) ve ${k.ilk_iki[1].ad_soyad} (${puan(k.ilk_iki[1].puan)}); aralarındaki puan farkı ${k.ilk_iki_puan_farki}.`, plan, sonuc);
  }

  if (plan.niyet === "tm_bolge_siralamasi") {
    const bolgeler = k.bolgeler ?? [];
    if (!bolgeler.length) return taban(`${donem[0].toLocaleUpperCase("tr-TR")}${donem.slice(1)} takımınıza ait bölge verisi bulunamadı.`, plan, sonuc);
    const listeMetni = bolgeler.map(b => `• ${b.sira}. **${b.ad}**: ${puan(b.net_puan)}`).join("\n");
    const cevap = `${donem[0].toLocaleUpperCase("tr-TR")}${donem.slice(1)} takımınızdaki bölgelerin net puan sıralaması:\n${listeMetni}\n\n💡 *Bölgeleri farklı bir puana göre sıralamamı ister misiniz? (Toplam kazanılan puan, İzleme puanı, Doğru cevap puanı, Ekstra izleme puanı)*`;
    return taban(cevap, plan, sonuc);
  }

  if (plan.niyet === "tm_bolge_kaybi") {
    const bolgeler = k.bolgeler ?? [];
    if (!bolgeler.length) return taban(`${donem[0].toLocaleUpperCase("tr-TR")}${donem.slice(1)} bölge kayıp verisi bulunamadı.`, plan, sonuc);
    const secilen = bolgeler.find(b => soru.toLocaleLowerCase("tr-TR").includes(b.ad.toLocaleLowerCase("tr-TR")))
      ?? bolgeler[0];
    const cevap = `${donem[0].toLocaleUpperCase("tr-TR")}${donem.slice(1)} **${secilen.ad}** toplam **${secilen.kaybedilen_toplam} puan** kaybetmiştir:\n• ⏩ **İleri Sarma Kaybı:** ${secilen.ileri_sarma_kaybi} puan\n• ❌ **Yanlış Cevap Kaybı:** ${secilen.yanlis_cevap_kaybi} puan\n• ⏱️ **T-Club Öneri Kaybı:** ${secilen.oneri_kaybi} puan`;
    return taban(cevap, plan, sonuc);
  }

  if (plan.niyet === "tm_mumessil_kaybi") {
    const bolgeler = k.bolgeler ?? [];
    if (!bolgeler.length) return taban(`${donem[0].toLocaleUpperCase("tr-TR")}${donem.slice(1)} mümessil kayıp verisi bulunamadı.`, plan, sonuc);
    const secilen = bolgeler.find(b => soru.toLocaleLowerCase("tr-TR").includes(b.ad.toLocaleLowerCase("tr-TR")))
      ?? bolgeler[0];
    const uttler = (secilen.en_cok_kaybeden_uttler ?? []).slice(0, 5);
    if (!uttler.length) return taban(`${donem[0].toLocaleUpperCase("tr-TR")}${donem.slice(1)} ${secilen.ad} için kayıtlı mümessil bulunamadı.`, plan, sonuc);
    const listeMetni = uttler.map((u, i) =>
      `• ${i + 1}. **${u.ad_soyad}**: Toplam **${u.toplam_kayip} puan** kayıp (${u.ileri_sarma_kaybi} ileri sarma, ${u.yanlis_cevap_kaybi} yanlış cevap, ${u.oneri_kaybi} öneri)`
    ).join("\n");
    const cevap = `${donem[0].toLocaleUpperCase("tr-TR")}${donem.slice(1)} **${secilen.ad}** en çok puan kaybeden mümessiller:\n${listeMetni}\n\n👉 *Detaylı analize ve koçluk verilerine [${secilen.ad} T-Club Ligi Sayfasından](/hbligi) ulaşabilirsiniz.*`;
    return taban(cevap, plan, sonuc);
  }

  const kisi = k.kendi;
  if (!kisi) {
    if (k.takim) {
      const t = k.takim;
      const siraMetni = t.sira === null ? "takım sıranız hesaplanamadı" : `şirket takımları arasında ${t.sira}. sıradadır`;
      return taban(`${donem[0].toLocaleUpperCase("tr-TR")}${donem.slice(1)} takımınızın (${t.ad}) net puanı ${puan(t.puan)} ve ${siraMetni}.`, plan, sonuc);
    }
    if (k.bolge) {
      const b = k.bolge;
      const siraMetni = b.sira === null ? "bölge sıranız hesaplanamadı" : `takım sıranız ${b.sira}`;
      return taban(`${donem[0].toLocaleUpperCase("tr-TR")}${donem.slice(1)} bölgenizin net puanı ${puan(b.puan)} ve ${siraMetni}.`, plan, sonuc);
    }
    return taban(`${donem[0].toLocaleUpperCase("tr-TR")}${donem.slice(1)} kişisel lig kaydınız bulunamadı.`, plan, sonuc);
  }
  const sira = k.sira_turu === "firma" ? kisi.firma_sirasi : k.sira_turu === "takim" ? kisi.takim_sirasi : k.sira_turu === "bolge" ? kisi.bolge_sirasi : kisi.sira;
  const siraMetni = sira === null ? "sıranız hesaplanamadı" : `${k.sira_turu === "firma" ? "firma" : k.sira_turu === "takim" ? "takım" : k.sira_turu === "bolge" ? "bölge" : "lig"} sıranız ${sira}`;
  return taban(`${donem[0].toLocaleUpperCase("tr-TR")}${donem.slice(1)} net puanınız ${puan(kisi.puan)} ve ${siraMetni}.`, plan, sonuc);
}
