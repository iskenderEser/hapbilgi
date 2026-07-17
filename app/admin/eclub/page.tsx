// app/admin/eclub/page.tsx
//
// M2-b — E-Club yönetimi ana panele taşındı (/admin → E-Club sekmesi).
// Bu eski URL kalıcı olarak ana panele yönlendirir; içerik bileşenleri
// _components/ altında yaşamaya devam eder (ana panel gömer).

import { redirect } from "next/navigation";

export default function AdminEclubPage() {
  redirect("/admin");
}
