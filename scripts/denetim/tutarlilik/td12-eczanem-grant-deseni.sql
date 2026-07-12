-- T-D12 — Eczanem GRANT deseni (U1 migration dersi): eczanem_* tablolarında
-- beklenen desen "service_role tam DML, anon/authenticated DML'siz".
-- (a) anon/authenticated'da DML varsa ihlal; (b) service_role'de DML eksikse ihlal.
-- Boş dönüş = temiz.
SELECT 'kacak_dml' AS tip, table_name, grantee || ':' || privilege_type AS detay
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name LIKE 'eczanem_%'
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE');

SELECT 'eksik_service_role_dml' AS tip, t.table_name, p.priv AS detay
FROM information_schema.tables t
CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
WHERE t.table_schema = 'public'
  AND t.table_name LIKE 'eczanem_%'
  AND t.table_type = 'BASE TABLE'
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants g
    WHERE g.table_schema = 'public'
      AND g.table_name = t.table_name
      AND g.grantee = 'service_role'
      AND g.privilege_type = p.priv
  );
