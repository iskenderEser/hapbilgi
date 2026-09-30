import test from "node:test";
import assert from "node:assert/strict";
import { yayinGonderimListeleri, yayinAlicisiBekliyor, yayinAlicisiUygun } from "@/lib/eclub/yayinGonderimFiltreleri";
import type { OneriKisi, OneriYayin } from "@/app/(panel)/eclub/oneriler/_types";

const yayin = (id: string, hedef: OneriYayin["hedef_roller"] = ["eczaci"]) => ({ yayin_id: id, arac_id: `arac-${id}`, hedef_roller: hedef, gonderim_incelemesi_tamamlandi: true } as OneriYayin);
const kisi = (id: string, rol: OneriKisi["rol"] = "eczaci"): OneriKisi => ({ kisi_id: id, rol, aktif_mi: true, auth_user_id: `auth-${id}`, ad: "Ad", soyad: "Soyad", eczane_adi: "Eczane" });
const ids = (items: OneriYayin[]) => items.map((x) => x.yayin_id);

test("0/y, kısmi ve y/y gönderimde liste üyeliği", () => {
  const rows = [yayin("hic"), yayin("kismi"), yayin("tamam")];
  const people = [kisi("a"), kisi("b")];
  const result = yayinGonderimListeleri(rows, people, { kismi: ["a"], tamam: ["a", "b"] });
  assert.deepEqual(ids(result.tumu), ["hic", "kismi", "tamam"]);
  assert.deepEqual(ids(result.gonderilebilir), ["hic", "kismi"]);
  assert.deepEqual(ids(result.gonderilen), ["kismi", "tamam"]);
});

test("gönderilmiş alıcı yeniden bekleyen sayılmaz; diğer hedef role yayın gönderilebilir", () => {
  const ortak = yayin("ortak", ["eczaci", "eczane_teknisyeni"]);
  const eczaci = kisi("e");
  const teknisyen = kisi("t", "eczane_teknisyeni");
  const gonderilen = { ortak: ["e"] };
  assert.equal(yayinAlicisiBekliyor(eczaci, ortak, gonderilen), false);
  assert.equal(yayinAlicisiBekliyor(teknisyen, ortak, gonderilen), true);
  assert.deepEqual(ids(yayinGonderimListeleri([ortak], [eczaci, teknisyen], gonderilen).gonderilebilir), ["ortak"]);
});

test("yalnız hedef roldeki aktif ve giriş hesabı olan kişiler bekleyen alıcıdır", () => {
  const rows = [yayin("eczaci"), yayin("teknisyen", ["eczane_teknisyeni"])];
  const people = [kisi("t", "eczane_teknisyeni"), { ...kisi("p"), aktif_mi: false }, { ...kisi("auth"), auth_user_id: null }];
  const result = yayinGonderimListeleri(rows, people, {});
  assert.deepEqual(ids(result.gonderilebilir), ["teknisyen"]);
  assert.equal(result.gonderilen.length, 0);
  assert.equal(yayinGonderimListeleri(rows, [], {}).gonderilebilir.length, 0);
  assert.equal(yayinAlicisiUygun(kisi("ikinci", "ikinci_eczaci"), yayin("e")), true);
  assert.equal(yayinAlicisiUygun(kisi("yardimci", "yardimci_eczaci"), yayin("e")), true);
});

test("geçmiş gönderim alıcının aktifliği değişse de Gönderilenler'de kalır", () => {
  const rows = [yayin("1")];
  const result = yayinGonderimListeleri(rows, [], { "1": ["eski-kisi"] });
  assert.deepEqual(ids(result.gonderilebilir), []);
  assert.deepEqual(ids(result.gonderilen), ["1"]);
});

test("UTT incelemesi tamamlanmayan ve alıcısı bekleyen yayın Gönderime Hazır'da görünür", () => {
  const rows = [{ ...yayin("1"), gonderim_incelemesi_tamamlandi: false }];
  const result = yayinGonderimListeleri(rows, [kisi("a")], {});
  assert.deepEqual(ids(result.tumu), ["1"]);
  assert.deepEqual(ids(result.gonderilebilir), ["1"]);
});
