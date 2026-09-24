-- ══════════════════════════════════════════════════════════════
-- ACPF — Alta de la categoría Femenino
-- Correr esto una sola vez en Supabase → SQL Editor, EN ORDEN.
--
-- OJO: el paso 0 hay que ejecutarlo SOLO (seleccionalo y correlo
-- aparte, o dale a "Run" con nada más que esa línea). Postgres no
-- deja usar un valor de enum recién agregado en la misma transacción
-- en la que se lo agrega, así que si lo corrés junto con el resto
-- del script en un solo "Run" vas a volver a ver el mismo error.
-- Una vez que el paso 0 corrió y confirmó "Success", recién ahí
-- corré el resto (pasos 1 a 3) todo junto.
-- ══════════════════════════════════════════════════════════════

-- 0) "categoria" es un enum (categoria_tipo), no texto libre — hay que
--    darle de alta el valor "Femenino" antes de poder insertar nada
--    con esa categoría. Correr ESTA LÍNEA SOLA primero.
alter type categoria_tipo add value if not exists 'Femenino';

-- 1) Columna nueva en perfiles: categorías que puede ver/recibe ese
--    delegado. NULL = las de varones de siempre (compatibilidad con
--    los delegados actuales). Un perfil con categorias = '{Femenino}'
--    solo ve/recibe Femenino, nada del resto del club.
alter table perfiles add column if not exists categorias text[];

-- 2) Los 2 clubes nuevos (Anahí y Camba Porá ya existen — su equipo
--    femenino se carga sobre el club_id que ya tienen).
insert into clubes (nombre)
select v.nombre from (values ('Las Reinas del Balón'), ('Soñadoras')) as v(nombre)
where not exists (select 1 from clubes c where c.nombre = v.nombre);

-- 3) Planteles Femenino (del excel). Uso subquery por nombre de club
--    para no depender de saber los id de memoria.
insert into jugadores (nombre, club_id, categoria, activo) values
  ('OJEDA CELESTE',      (select id from clubes where nombre = 'Anahí'), 'Femenino', true),
  ('RAMIREZ EMILIA',     (select id from clubes where nombre = 'Anahí'), 'Femenino', true),
  ('RAMIREZ ROSANA',     (select id from clubes where nombre = 'Anahí'), 'Femenino', true),
  ('BENITEZ LUCRECIA',   (select id from clubes where nombre = 'Anahí'), 'Femenino', true),
  ('AZAMOR DAIANA',      (select id from clubes where nombre = 'Anahí'), 'Femenino', true),
  ('FERNANDEZ CRISTINA', (select id from clubes where nombre = 'Anahí'), 'Femenino', true),
  ('CACERES AIXA',       (select id from clubes where nombre = 'Anahí'), 'Femenino', true),
  ('ROMERO ROXANA',      (select id from clubes where nombre = 'Anahí'), 'Femenino', true),
  ('RAMIREZ PAOLA',      (select id from clubes where nombre = 'Anahí'), 'Femenino', true),
  ('LOPEZ CATALINA',     (select id from clubes where nombre = 'Anahí'), 'Femenino', true),
  ('ALMADA MACARENA',    (select id from clubes where nombre = 'Anahí'), 'Femenino', true),
  ('AZAMOR CAMILA',      (select id from clubes where nombre = 'Anahí'), 'Femenino', true),
  ('TOKUNAGA JUANA',     (select id from clubes where nombre = 'Anahí'), 'Femenino', true),
  ('AZAMOR ALICIA',      (select id from clubes where nombre = 'Anahí'), 'Femenino', true),
  ('GILES JOSEFINA',     (select id from clubes where nombre = 'Anahí'), 'Femenino', true),

  ('GAUNA GISELA',      (select id from clubes where nombre = 'Las Reinas del Balón'), 'Femenino', true),
  ('MOSQUEDA MILAGROS', (select id from clubes where nombre = 'Las Reinas del Balón'), 'Femenino', true),
  ('GUANA ANTONIA',     (select id from clubes where nombre = 'Las Reinas del Balón'), 'Femenino', true),
  ('RIOS CECILIA',      (select id from clubes where nombre = 'Las Reinas del Balón'), 'Femenino', true),
  ('CABALLERO LUCILA',  (select id from clubes where nombre = 'Las Reinas del Balón'), 'Femenino', true),
  ('CABALLERO ROCIO',   (select id from clubes where nombre = 'Las Reinas del Balón'), 'Femenino', true),
  ('CABALLERO MILAGROS',(select id from clubes where nombre = 'Las Reinas del Balón'), 'Femenino', true),
  ('MOSQUEDA MARIA',    (select id from clubes where nombre = 'Las Reinas del Balón'), 'Femenino', true),
  ('GAUNA MARIA',       (select id from clubes where nombre = 'Las Reinas del Balón'), 'Femenino', true),
  ('ACUÑA FLAVIA',      (select id from clubes where nombre = 'Las Reinas del Balón'), 'Femenino', true),
  ('SANCHEZ MIRIAN',    (select id from clubes where nombre = 'Las Reinas del Balón'), 'Femenino', true),
  ('FERNANDEZ LORENA',  (select id from clubes where nombre = 'Las Reinas del Balón'), 'Femenino', true),
  ('ENCINA SOLANGE',    (select id from clubes where nombre = 'Las Reinas del Balón'), 'Femenino', true),
  ('AYALA JULIANA',     (select id from clubes where nombre = 'Las Reinas del Balón'), 'Femenino', true),
  ('FERNANDEZ GRACIELA',(select id from clubes where nombre = 'Las Reinas del Balón'), 'Femenino', true),
  ('AYALA AYELEN',      (select id from clubes where nombre = 'Las Reinas del Balón'), 'Femenino', true),

  ('QUINTANA YESICA',    (select id from clubes where nombre = 'Camba Porá'), 'Femenino', true),
  ('GARCIA YOHANA',      (select id from clubes where nombre = 'Camba Porá'), 'Femenino', true),
  ('MONZON SANDRA',      (select id from clubes where nombre = 'Camba Porá'), 'Femenino', true),
  ('PEREZ MARIELA',      (select id from clubes where nombre = 'Camba Porá'), 'Femenino', true),
  ('ROLON ADRIANA',      (select id from clubes where nombre = 'Camba Porá'), 'Femenino', true),
  ('GONZALEZ MICAELA',   (select id from clubes where nombre = 'Camba Porá'), 'Femenino', true),
  ('ROJAS MICAELA',      (select id from clubes where nombre = 'Camba Porá'), 'Femenino', true),
  ('RIOS ESTEFANIA',     (select id from clubes where nombre = 'Camba Porá'), 'Femenino', true),
  ('ALMEIDA SASHA',      (select id from clubes where nombre = 'Camba Porá'), 'Femenino', true),
  ('ROMERO MARIA ELENA', (select id from clubes where nombre = 'Camba Porá'), 'Femenino', true),
  ('GAUNA NATALIA',      (select id from clubes where nombre = 'Camba Porá'), 'Femenino', true),
  ('PEREZ ROMINA',       (select id from clubes where nombre = 'Camba Porá'), 'Femenino', true),
  ('GUANA JORGELINA',    (select id from clubes where nombre = 'Camba Porá'), 'Femenino', true),
  ('MENDEZ VALENTINA',   (select id from clubes where nombre = 'Camba Porá'), 'Femenino', true),
  ('ROMERO MARIANA',     (select id from clubes where nombre = 'Camba Porá'), 'Femenino', true),
  ('SOSA AQUINO GINA',   (select id from clubes where nombre = 'Camba Porá'), 'Femenino', true),
  ('AYALA MACARENA',     (select id from clubes where nombre = 'Camba Porá'), 'Femenino', true),

  ('ALMIRON GRISELDA',    (select id from clubes where nombre = 'Soñadoras'), 'Femenino', true),
  ('ARMUA MILAGROS',      (select id from clubes where nombre = 'Soñadoras'), 'Femenino', true),
  ('ARANDA MARIA LUZ',    (select id from clubes where nombre = 'Soñadoras'), 'Femenino', true),
  ('ARRIOLA MICAELA',     (select id from clubes where nombre = 'Soñadoras'), 'Femenino', true),
  ('CABALLERO JESICA',    (select id from clubes where nombre = 'Soñadoras'), 'Femenino', true),
  ('ESCALANTE MARIEL',    (select id from clubes where nombre = 'Soñadoras'), 'Femenino', true),
  ('ESQUIVEL ROXANA',     (select id from clubes where nombre = 'Soñadoras'), 'Femenino', true),
  ('IRALA ROXANA BELEN',  (select id from clubes where nombre = 'Soñadoras'), 'Femenino', true),
  ('LUGO VANESA',         (select id from clubes where nombre = 'Soñadoras'), 'Femenino', true),
  ('MARTINEZ LORENA',     (select id from clubes where nombre = 'Soñadoras'), 'Femenino', true),
  ('OVANDO CINTHIA',      (select id from clubes where nombre = 'Soñadoras'), 'Femenino', true),
  ('PORTILLE GISELA',     (select id from clubes where nombre = 'Soñadoras'), 'Femenino', true);

-- 4) Cuando tengas los emails y crees los usuarios en Authentication →
--    Users, completá el perfil de cada encargada con esto (reemplazá
--    el uuid por el "User UID" que te muestra Supabase al crear el
--    usuario, y el club_id/nombre según corresponda):
--
-- insert into perfiles (id, rol, club_id, nombre, categorias) values
--   ('<uuid-del-usuario-en-auth>', 'delegado',
--    (select id from clubes where nombre = 'Anahí'),
--    'Encargada Femenino - Anahí', array['Femenino']);
--
-- Repetir para Camba Porá, Las Reinas del Balón y Soñadoras.
