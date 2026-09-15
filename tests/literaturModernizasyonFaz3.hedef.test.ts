import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { pdfMetadatasiniBaytlardanCikar } from "../lib/ogrenmeAraci/pdfMetadata.ts";

function tekSayfaliPdf(): Uint8Array {
  const nesneler = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    "<< /Length 40 >>\nstream\nBT /F1 12 Tf 40 250 Td (Merhaba) Tj ET\nendstream",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let metin = "%PDF-1.4\n";
  const konumlar = [0];
  nesneler.forEach((nesne, i) => {
    konumlar.push(new TextEncoder().encode(metin).length);
    metin += `${i + 1} 0 obj\n${nesne}\nendobj\n`;
  });
  const xref = new TextEncoder().encode(metin).length;
  metin += `xref\n0 ${nesneler.length + 1}\n0000000000 65535 f \n`;
  for (const konum of konumlar.slice(1)) metin += `${String(konum).padStart(10, "0")} 00000 n \n`;
  metin += `trailer\n<< /Size ${nesneler.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(metin);
}

test("PDF sayfa sayısı ve arama metni sunucudaki baytlardan çıkarılır", async () => {
  const sonuc = await pdfMetadatasiniBaytlardanCikar(tekSayfaliPdf());
  assert.equal(sonuc.sayfaSayisi, 1);
  assert.match(sonuc.aramaMetni, /Merhaba/);
  assert.equal(sonuc.aramaMetniDurumu, "tam");
});

test("bozuk PDF sunucu doğrulamasında reddedilir", async () => {
  await assert.rejects(pdfMetadatasiniBaytlardanCikar(new TextEncoder().encode("PDF değil")), /PDF bozuk/);
});

test("Literatür route'u istemci metadata'sına güvenmez ve tek RPC çağırır", () => {
  const route = readFileSync(new URL("../app/api/ogrenme-araclari/[arac_id]/flip-pdf-dogrula/route.ts", import.meta.url), "utf8");
  assert.match(route, /bunnyStorageNesneIndir\(arac\.dosya_yolu, 75 \* 1024 \* 1024\)/);
  assert.match(route, /pdfMetadatasiniBaytlardanCikar\(pdfBaytlari\)/);
  assert.match(route, /p_sayfa_sayisi: pdfMetadata\.sayfaSayisi/);
  assert.match(route, /p_arama_metni: pdfMetadata\.aramaMetni/);
  assert.doesNotMatch(route, /p_sayfa_sayisi: body\.sayfa_sayisi/);
  assert.doesNotMatch(route, /from\("ogrenme_araclari"\)\.update\(\{ metadata \}\)/);
});

test("SQL PDF, kapak, görev ve metadata kapılarını atomik uygular", () => {
  const sql = readFileSync(new URL("../scripts/sql/ogrenme_araclari_modernizasyon_faz3_literatur_teslim.sql", import.meta.url), "utf8");
  assert.match(sql, /depolama_dogrulamasi,checksum,edge_makbuzu_dogrulandi/);
  assert.match(sql, /kapak_destek_dogrulamasi,kapak,checksum,edge_makbuzu_dogrulandi/);
  assert.match(sql, /v_gorev\.arac_id IS NOT NULL AND v_gorev\.arac_id <> p_arac_id/);
  assert.match(sql, /'arama_metni', btrim\(p_arama_metni\)/);
  assert.match(sql, /durum = 'inceleme_bekliyor'/);
  assert.match(sql, /ogrenme_araci_depolama_temizleme_kuyrugu/);
  assert.match(sql, /DROP FUNCTION IF EXISTS public\.uretim_flip_pdf_dogrula\(uuid,uuid,uuid,integer,uuid\)/);
});
