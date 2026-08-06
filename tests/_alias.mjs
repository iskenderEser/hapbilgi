// tests/_alias.mjs — smoke test koşucusu için "@/" alias çözücüyü kaydeder.
//
// `node --import ./tests/_alias.mjs --test ...` ile devreye girer; resolve hook'unu
// (_alias-hooks.mjs) ayrı hook thread'ine kaydeder. Yalnız test ortamı — üretime
// gitmez, kullanıcı tarafında hiçbir kod çalıştırmaz.

import { register } from "node:module";

register("./_alias-hooks.mjs", import.meta.url);
