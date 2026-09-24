-- ══════════════════════════════════════════════════════════════
-- ACPF — Split de Veteranos en +45 y +35
-- Correr en Supabase → SQL Editor, EN ORDEN.
--
-- OJO: el paso 0 hay que correrlo SOLO (nada más que esas 2 líneas),
-- igual que pasó con Femenino — Postgres no deja usar un valor de
-- enum nuevo en la misma transacción en la que se lo agrega.
-- ══════════════════════════════════════════════════════════════

-- 0) Alta de los 2 valores nuevos del enum. Correr ESTO SOLO primero.
alter type categoria_tipo add value if not exists 'Veteranos +45';
alter type categoria_tipo add value if not exists 'Veteranos +35';

-- 1) Una vez confirmado el paso 0 ("Success"), correr el resto junto:
--    todo lo que hoy dice "Veteranos" pasa a "Veteranos +45" (el
--    partido que ya cargaste, el resto queda vacío en +35 hasta que
--    te pasen esos datos).
update jugadores set categoria = 'Veteranos +45' where categoria = 'Veteranos';
update partidos  set categoria = 'Veteranos +45' where categoria = 'Veteranos';
update fixture   set categoria = 'Veteranos +45' where categoria = 'Veteranos';
update sanciones set categoria = 'Veteranos +45' where categoria = 'Veteranos';

-- Nota: el viejo valor 'Veteranos' del enum queda sin usarse (Postgres
-- no permite borrar valores de un enum), pero no molesta en nada — la
-- app ya no lo ofrece en ningún lado.
