export function tarihAraligi(zaman: string): { baslangic: string; bitis: string } {
  const simdi = new Date();
  const bitis = simdi.toISOString();

  if (zaman === 'bu_hafta') {
    const gun = simdi.getDay();
    const fark = gun === 0 ? 6 : gun - 1;
    const pazartesi = new Date(simdi);
    pazartesi.setDate(simdi.getDate() - fark);
    pazartesi.setHours(0, 0, 0, 0);
    return { baslangic: pazartesi.toISOString(), bitis };
  }

  if (zaman === 'bu_ay') {
    const baslangic = new Date(simdi.getFullYear(), simdi.getMonth(), 1);
    return { baslangic: baslangic.toISOString(), bitis };
  }

  if (zaman === 'bu_donem') {
    const ay = simdi.getMonth();
    const ceyrekBaslangicAy = Math.floor(ay / 3) * 3;
    const baslangic = new Date(simdi.getFullYear(), ceyrekBaslangicAy, 1);
    return { baslangic: baslangic.toISOString(), bitis };
  }

  if (zaman === 'bu_yil') {
    const baslangic = new Date(simdi.getFullYear(), 0, 1);
    return { baslangic: baslangic.toISOString(), bitis };
  }

  // bu_gun (default)
  const bugun = new Date(simdi);
  bugun.setHours(0, 0, 0, 0);
  return { baslangic: bugun.toISOString(), bitis };
}