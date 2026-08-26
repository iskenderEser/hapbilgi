import test from "node:test";
import assert from "node:assert/strict";
import { mobilKarsilamaYonlendiricisiOlustur } from "@/lib/auth/mobilKarsilama";

function hesapOlustur(id: string, metadata: Record<string, unknown> = {}) {
  const kullanici = { id, user_metadata: { ...metadata } };
  let okumaSayisi = 0;
  let yazmaSayisi = 0;
  return {
    kullanici,
    sayaclar: () => ({ okumaSayisi, yazmaSayisi }),
    auth: {
      async getUser() {
        okumaSayisi += 1;
        return { data: { user: kullanici }, error: null };
      },
      async updateUser(attributes: { data: Record<string, boolean> }) {
        yazmaSayisi += 1;
        Object.assign(kullanici.user_metadata, attributes.data);
        return { error: null };
      },
    },
  };
}

test("ilk mobil giriş tanıtımı, sonraki giriş başka tarayıcıda da Ana Sayfa'yı açar", async () => {
  const hesap = hesapOlustur("kullanici-a", { ad: "Örnek" });
  assert.equal(await mobilKarsilamaYonlendiricisiOlustur()(hesap.auth, "kullanici-a", true, "/ana-sayfa"), "/hapbilgi-nedir");
  assert.equal(await mobilKarsilamaYonlendiricisiOlustur()(hesap.auth, "kullanici-a", true, "/ana-sayfa"), "/ana-sayfa");
  assert.equal(hesap.kullanici.user_metadata.ad, "Örnek");
  assert.deepEqual(hesap.sayaclar(), { okumaSayisi: 2, yazmaSayisi: 1 });
});

test("masaüstü ve admin yönleri korunur; ilk mobil karşılama hakkı tüketilmez", async () => {
  const hesap = hesapOlustur("kullanici-a");
  const yonlendir = mobilKarsilamaYonlendiricisiOlustur();
  assert.equal(await yonlendir(hesap.auth, "kullanici-a", false, "/ana-sayfa"), "/ana-sayfa");
  assert.equal(await yonlendir(hesap.auth, "kullanici-a", true, "/admin"), "/admin");
  assert.deepEqual(hesap.sayaclar(), { okumaSayisi: 0, yazmaSayisi: 0 });
  assert.equal(await yonlendir(hesap.auth, "kullanici-a", true, "/ana-sayfa"), "/hapbilgi-nedir");
});

test("yinelenen giriş etkileri aynı kararı paylaşır; farklı hesaplar birbirini etkilemez", async () => {
  const a = hesapOlustur("kullanici-a");
  const b = hesapOlustur("kullanici-b");
  const yonlendir = mobilKarsilamaYonlendiricisiOlustur();
  assert.deepEqual(await Promise.all([
    yonlendir(a.auth, "kullanici-a", true, "/ana-sayfa"),
    yonlendir(a.auth, "kullanici-a", true, "/ana-sayfa"),
    yonlendir(b.auth, "kullanici-b", true, "/ana-sayfa"),
  ]), ["/hapbilgi-nedir", "/hapbilgi-nedir", "/hapbilgi-nedir"]);
  assert.deepEqual(a.sayaclar(), { okumaSayisi: 1, yazmaSayisi: 1 });
  assert.deepEqual(b.sayaclar(), { okumaSayisi: 1, yazmaSayisi: 1 });
});

test("kimlik değişikliği ve oturum okuma hatası başka hesaba kayıt yazmaz", async () => {
  const hesap = hesapOlustur("baska-kullanici");
  assert.equal(await mobilKarsilamaYonlendiricisiOlustur()(hesap.auth, "kullanici-a", true, "/ana-sayfa"), "/ana-sayfa");
  const hataliAuth = {
    ...hesap.auth,
    getUser: async () => ({ data: { user: null }, error: new Error("Oturum okunamadı") }),
  };
  assert.equal(await mobilKarsilamaYonlendiricisiOlustur()(hataliAuth, "kullanici-a", true, "/ana-sayfa"), "/ana-sayfa");
  assert.equal(hesap.sayaclar().yazmaSayisi, 0);
});

test("kayıt veya bağlantı hatası girişi engellemez; sonraki giriş yeniden deneyebilir", async () => {
  const hesap = hesapOlustur("kullanici-a");
  for (const updateUser of [
    async () => ({ error: new Error("Kayıt başarısız") }),
    async () => { throw new Error("Bağlantı kesildi"); },
  ]) {
    const auth = { ...hesap.auth, updateUser };
    assert.equal(await mobilKarsilamaYonlendiricisiOlustur()(auth, "kullanici-a", true, "/ana-sayfa"), "/ana-sayfa");
  }
  assert.equal(await mobilKarsilamaYonlendiricisiOlustur()(hesap.auth, "kullanici-a", true, "/ana-sayfa"), "/hapbilgi-nedir");
});
