// app/(panel)/eczanem/eczane/page.tsx
// Eczacı/teknisyen Eczanem kökü — sekmesiz bare yol. Sidebar sekmeleri alt
// rotalardadır (musterilerim / dagitim / siparisler / dokum); bu kök ilk
// sekmeye yönlendirir. AuthProvider ve push bildirimi bu bare yolu işaret
// ettiğinden korunur (kırılmaz).
import { redirect } from "next/navigation";

export default function EczanemEczaneKok() {
  redirect("/eczanem/eczane/musterilerim");
}
