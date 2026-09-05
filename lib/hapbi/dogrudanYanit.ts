import type { HapbiDogrudanPlan } from "@/lib/hapbi/soruPlani";
import type { HapbiAracSonucu, HapbiYanit } from "@/lib/hapbi/sozlesme";

type DogrudanSonuc = HapbiYanit & { araclar: string[]; tokenSayisi: number; yol: "dogrudan" };
type Kisi = { ad_soyad: string; puan: number | null; sira: number | null; firma_sirasi: number | null; takim_sirasi: number | null; bolge_sirasi: number | null; benim: boolean };
type KanonikLig = { veri_durumu: string; sira_turu: string; kisiler?: Kisi[]; liderler: Kisi[]; ilk_iki: Kisi[]; ilk_iki_puan_farki: number | null; kendi: Kisi | null };

function nesne(deger: unknown): Record<string, unknown> {
  return deger && typeof deger === "object" && !Array.isArray(deger) ? deger as Record<string, unknown> : {};
}

function taban(cevap: string, plan: HapbiDogrudanPlan, sonuc?: HapbiAracSonucu): DogrudanSonuc {
  return {
    cevap, kaynaklar: sonuc?.kaynak ? [sonuc.kaynak] : [], model: "deterministik",
    ...(sonuc?.egitimler?.length ? { egitimler: sonuc.egitimler } : {}),
    araclar: plan.arac ? [plan.arac] : [], tokenSayisi: 0, yol: "dogrudan",
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

export function hapbiDogrudanYanitUret(plan: HapbiDogrudanPlan, soru: string, sonuc?: HapbiAracSonucu): DogrudanSonuc {
  if (plan.niyet === "netlestir") return taban("Hangi dönemi esas alayım: hafta, ay, çeyrek veya yıl?", plan);
  if (plan.niyet === "yetki_reddi") return taban("Yetkinizi değiştiremem ve başka firmaların verilerine erişemem. Yalnız doğrulanmış rolünüz ve kendi kapsamınızdaki bilgileri gösterebilirim.", plan);
  if (plan.niyet === "desteklenmiyor") return taban("Bu rolde kişisel C-Club puanının okunması desteklenmiyor. Firma C-Club ligi ayrı bir kapsamdır.", plan);
  if (!sonuc || !["ok", "bos"].includes(sonuc.durum)) {
    return taban(sonuc?.durum === "yetkisiz" ? "Bu bilgiye mevcut rol ve kapsamınızla erişilemiyor." : "İstenen veri şu anda doğrulanamadı.", plan, sonuc);
  }
  const donem = donemEtiketi(plan.parametre);

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
  const kisi = k.kendi;
  if (!kisi) return taban(`${donem[0].toLocaleUpperCase("tr-TR")}${donem.slice(1)} kişisel lig kaydınız bulunamadı.`, plan, sonuc);
  const sira = k.sira_turu === "firma" ? kisi.firma_sirasi : k.sira_turu === "takim" ? kisi.takim_sirasi : k.sira_turu === "bolge" ? kisi.bolge_sirasi : kisi.sira;
  const siraMetni = sira === null ? "sıranız hesaplanamadı" : `${k.sira_turu === "firma" ? "firma" : k.sira_turu === "takim" ? "takım" : k.sira_turu === "bolge" ? "bölge" : "lig"} sıranız ${sira}`;
  return taban(`${donem[0].toLocaleUpperCase("tr-TR")}${donem.slice(1)} net puanınız ${puan(kisi.puan)} ve ${siraMetni}.`, plan, sonuc);
}
