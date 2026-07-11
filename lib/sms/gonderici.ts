// lib/sms/gonderici.ts
// Provider-agnostik SMS gönderimi (§2.7 deseni: SDK yok, env + HTTP).
//
// K-E1 (sağlayıcı seçimi) hâlâ açık — sona takılan parça. Sağlayıcı
// belli olduğunda YALNIZCA bu dosyaya adapter yazılır; çağıran taraflar
// (OTP, davet, ileride E-Club) imza değişmeden çalışmaya devam eder.
//
// K-E8: canlı olmayan ortamlarda SMS hiç gönderilmez — mesaj loglanır ve
// başarı döner (test tarafında açma/kapama adımı yoktur, kendiliğinden).

import { canliOrtamMi } from "@/lib/utils/ortam";

export interface SmsSonuc {
  ok: boolean;
  hata?: string;
}

export async function smsGonder(telefon: string, mesaj: string): Promise<SmsSonuc> {
  if (!canliOrtamMi()) {
    console.log(`[SMS TEST] ${telefon} → "${mesaj}" (canlı dışı ortam, gönderilmedi — K-E8)`);
    return { ok: true };
  }

  // Canlı ortam: gerçek sağlayıcı entegrasyonu K-E1 kararını bekliyor.
  // Sağlayıcı bağlanana kadar canlıda SMS isteği bilinçli olarak HATA döner —
  // sessizce "gönderilmiş" saymak, canlıda OTP'siz kalan kullanıcıyı gizlerdi.
  console.error(`[SMS] Sağlayıcı yapılandırılmamış (K-E1 açık); ${telefon} numarasına gönderim yapılamadı.`);
  return { ok: false, hata: "SMS sağlayıcısı henüz yapılandırılmadı." };
}
