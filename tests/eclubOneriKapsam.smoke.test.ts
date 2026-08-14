import test from "node:test";
import assert from "node:assert/strict";

import { eclubYayinKapsamindaMi } from "@/lib/eclub/oneriKapsam";

test("mutlu: UTT kendi takımının ve firma-geneli E-Club yayınını kullanabilir", () => {
  const utt = { firma_id: "firma-a", takim_id: "takim-a" };

  assert.equal(eclubYayinKapsamindaMi(utt, { firma_id: "firma-a", takim_id: "takim-a" }), true);
  assert.equal(eclubYayinKapsamindaMi(utt, { firma_id: "firma-a", takim_id: null }), true);
});

test("sınır: başka firma veya takımın E-Club yayını kapsam dışıdır", () => {
  const utt = { firma_id: "firma-a", takim_id: "takim-a" };

  assert.equal(eclubYayinKapsamindaMi(utt, { firma_id: "firma-b", takim_id: "takim-a" }), false);
  assert.equal(eclubYayinKapsamindaMi(utt, { firma_id: "firma-a", takim_id: "takim-b" }), false);
  assert.equal(eclubYayinKapsamindaMi(utt, { firma_id: null, takim_id: null }), false);
});
