import assert from "node:assert/strict";
import test from "node:test";
import {
  ECLUB_TUKETICI_ROLLERI,
  eclubKisiHedefRolu,
  eclubKisiRolEtiketi,
} from "@/lib/utils/roller";
import { guvenliCikisYap, supabaseAuthCookieOnEki } from "@/lib/auth/guvenliCikis";

test("E-Club eczacı unvanları eczacı hedef kitlesine bağlanır", () => {
  for (const rol of ["eczaci", "ikinci_eczaci", "yardimci_eczaci"]) {
    assert.equal(ECLUB_TUKETICI_ROLLERI.includes(rol), true);
    assert.equal(eclubKisiHedefRolu(rol), "eczaci");
  }
  assert.equal(eclubKisiHedefRolu("eczane_teknisyeni"), "eczane_teknisyeni");
});

test("E-Club unvan etiketleri kullanıcıya açık adları döndürür", () => {
  assert.equal(eclubKisiRolEtiketi("ikinci_eczaci"), "İkinci Eczacı");
  assert.equal(eclubKisiRolEtiketi("yardimci_eczaci"), "Yardımcı Eczacı");
});

test("Supabase oturum çerezi proje adresinden güvenli biçimde türetilir", () => {
  assert.equal(supabaseAuthCookieOnEki("https://abc123.supabase.co"), "sb-abc123-auth-token");
  assert.equal(supabaseAuthCookieOnEki("gecersiz"), null);
});

test("Supabase çıkış isteği ağ hatasında yakalanmamış hata üretmez", async () => {
  let otomatikYenilemeDurdu = false;
  const istemci = {
    auth: {
      signOut: async () => { throw new TypeError("Failed to fetch"); },
      stopAutoRefresh: () => { otomatikYenilemeDurdu = true; },
    },
  };

  await assert.doesNotReject(() => guvenliCikisYap(istemci as never));
  assert.equal(otomatikYenilemeDurdu, true);
});
