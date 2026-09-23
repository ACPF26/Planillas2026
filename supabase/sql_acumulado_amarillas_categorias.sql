-- ══════════════════════════════════════════════════════════════
-- ACPF — acumulado_amarillas: agregar +45/+35 y Femenino
--
-- Esta tabla tiene una columna fija por categoría (no una columna
-- "categoria" genérica), y la mantiene la función cargar_partido.
-- Como consecuencia, cuando se agregó Femenino nunca se le sumó su
-- columna acá (por eso la pestaña Amarillas de Femenino puede
-- aparecer vacía aunque haya amarillas cargadas), y ahora hace falta
-- lo mismo para separar Veteranos en +45 y +35.
--
-- Correr DESPUÉS de sql_veteranos_split.sql (necesita que el enum ya
-- tenga 'Veteranos +45' y 'Veteranos +35'). Todo esto va junto, sin
-- restricción de orden entre sí.
-- ══════════════════════════════════════════════════════════════

-- 1) Renombro la columna vieja "veteranos" a "veteranos_45" (los datos
--    ya acumulados ahí son de partidos +45, así que quedan tal cual)
--    y agrego las columnas que faltan.
alter table acumulado_amarillas rename column veteranos to veteranos_45;
alter table acumulado_amarillas add column if not exists veteranos_35 int not null default 0;
alter table acumulado_amarillas add column if not exists femenino int not null default 0;

-- 2) Reemplazo cargar_partido para que sume a las columnas correctas
--    según la categoría del partido (antes solo contemplaba Cadetes,
--    Sub-20, Reserva, Primera y "Veteranos" sin separar).
CREATE OR REPLACE FUNCTION public.cargar_partido(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  v_partido_id   uuid;
  v_categoria    categoria_tipo := (payload->>'categoria')::categoria_tipo;
  v_fecha_nro    int := (payload->>'fecha_nro')::int;
  v_club_local   uuid := (payload->>'club_local_id')::uuid;
  v_club_visit   uuid := (payload->>'club_visitante_id')::uuid;
  v_jugador      jsonb;
  v_cambio       jsonb;
  v_lado         text;
  v_club_id      uuid;
  v_goles        int; v_amarillas int; v_roja boolean; v_jugo boolean;
  v_doble        boolean;
  v_total        int;
  v_fechas_susp  int;
  v_nuevas_susp  jsonb := '[]'::jsonb;
begin
  insert into partidos (fecha_nro, fecha_cal, categoria, club_local_id, club_visitante_id,
                         goles_local, goles_visitante, arbitro, juez_linea_1, juez_linea_2,
                         cuarto_arbitro, observacion, creado_por)
  values (v_fecha_nro, payload->>'fecha_cal', v_categoria, v_club_local, v_club_visit,
          (payload->>'goles_local')::int, (payload->>'goles_visitante')::int,
          payload->>'arbitro', payload->>'juez_linea_1', payload->>'juez_linea_2',
          payload->>'cuarto_arbitro',
          payload->>'observacion', auth.uid())
  returning id into v_partido_id;

  for v_lado in select unnest(array['jugadores_local', 'jugadores_visitante'])
  loop
    v_club_id := case when v_lado = 'jugadores_local' then v_club_local else v_club_visit end;

    for v_jugador in select jsonb_array_elements(coalesce(payload->v_lado, '[]'::jsonb))
    loop
      v_goles     := coalesce((v_jugador->>'goles')::int, 0);
      v_amarillas := coalesce((v_jugador->>'amarillas')::int, 0);
      v_roja      := coalesce((v_jugador->>'roja')::boolean, false);
      v_jugo      := coalesce((v_jugador->>'jugo')::boolean, false);
      v_doble     := false;

      if v_amarillas >= 2 then
        v_doble := true;
        v_roja := true;
        v_amarillas := 0;
      end if;

      insert into incidencias (partido_id, jugador_id, club_id, goles, amarillas, roja, doble_amarilla, jugo)
      values (v_partido_id, (v_jugador->>'jugador_id')::uuid, v_club_id,
              v_goles, v_amarillas, v_roja, v_doble, v_jugo);

      if v_amarillas > 0 then
        insert into acumulado_amarillas (nombre, club_id, cadetes, sub_20, reserva, primera, veteranos_45, veteranos_35, femenino, total, en_suspension)
        values (
          v_jugador->>'nombre', v_club_id,
          case when v_categoria = 'Cadetes'       then v_amarillas else 0 end,
          case when v_categoria = 'Sub-20'        then v_amarillas else 0 end,
          case when v_categoria = 'Reserva'       then v_amarillas else 0 end,
          case when v_categoria = 'Primera'       then v_amarillas else 0 end,
          case when v_categoria = 'Veteranos +45' then v_amarillas else 0 end,
          case when v_categoria = 'Veteranos +35' then v_amarillas else 0 end,
          case when v_categoria = 'Femenino'      then v_amarillas else 0 end,
          v_amarillas, false
        )
        on conflict (nombre, club_id) do update set
          cadetes      = acumulado_amarillas.cadetes      + excluded.cadetes,
          sub_20       = acumulado_amarillas.sub_20       + excluded.sub_20,
          reserva      = acumulado_amarillas.reserva      + excluded.reserva,
          primera      = acumulado_amarillas.primera      + excluded.primera,
          veteranos_45 = acumulado_amarillas.veteranos_45 + excluded.veteranos_45,
          veteranos_35 = acumulado_amarillas.veteranos_35 + excluded.veteranos_35,
          femenino     = acumulado_amarillas.femenino     + excluded.femenino,
          total        = acumulado_amarillas.total + excluded.total
        returning total, en_suspension into v_total, v_doble;

        if v_total >= 5 and not v_doble then
          insert into sanciones (jugador_id, club_id, categoria, tipo, motivo,
                                  fecha_inicio, fechas_a_cumplir, estado)
          values ((v_jugador->>'jugador_id')::uuid, v_club_id, v_categoria, 'Amarillas',
                  v_total || ' amarillas acumuladas', v_fecha_nro + 1, 1, 'Vigente');

          update acumulado_amarillas
          set total = 0, cadetes = 0, sub_20 = 0, reserva = 0, primera = 0,
              veteranos_45 = 0, veteranos_35 = 0, femenino = 0, en_suspension = true
          where nombre = v_jugador->>'nombre' and club_id = v_club_id;

          v_nuevas_susp := v_nuevas_susp || jsonb_build_object(
            'jugador', v_jugador->>'nombre', 'club_id', v_club_id, 'tipo', 'Amarillas');
        end if;
      end if;

      if v_roja then
        v_fechas_susp := coalesce((v_jugador->>'fechas_susp')::int, 1);

        insert into sanciones (jugador_id, club_id, categoria, tipo, motivo,
                                fecha_inicio, fechas_a_cumplir, estado, observacion_arbitro)
        values ((v_jugador->>'jugador_id')::uuid, v_club_id, v_categoria,
                'Roja',
                case when v_doble then 'Doble amarilla fecha ' || v_fecha_nro
                     else 'Expulsión fecha ' || v_fecha_nro end,
                v_fecha_nro + 1, v_fechas_susp, 'Vigente',
                payload->>'observacion');

        v_nuevas_susp := v_nuevas_susp || jsonb_build_object(
          'jugador', v_jugador->>'nombre', 'club_id', v_club_id, 'tipo', 'Roja',
          'fechas_a_cumplir', v_fechas_susp);
      end if;
    end loop;
  end loop;

  -- Cambios (sustituciones) de cada equipo — sin minuto
  for v_lado in select unnest(array['cambios_local', 'cambios_visitante'])
  loop
    v_club_id := case when v_lado = 'cambios_local' then v_club_local else v_club_visit end;

    for v_cambio in select jsonb_array_elements(coalesce(payload->v_lado, '[]'::jsonb))
    loop
      insert into cambios (partido_id, club_id, jugador_sale_id, jugador_entra_id)
      values (v_partido_id, v_club_id,
              (v_cambio->>'sale')::uuid, (v_cambio->>'entra')::uuid);
    end loop;
  end loop;

  update fixture set
    goles_local = case when club_local_id = v_club_local
                        then (payload->>'goles_local')::int
                        else (payload->>'goles_visitante')::int end,
    goles_visitante = case when club_local_id = v_club_local
                            then (payload->>'goles_visitante')::int
                            else (payload->>'goles_local')::int end,
    estado = 'Jugado'
  where fecha_nro = v_fecha_nro and categoria = v_categoria
    and ((club_local_id = v_club_local and club_visitante_id = v_club_visit)
      or (club_local_id = v_club_visit and club_visitante_id = v_club_local));

  return jsonb_build_object('ok', true, 'partido_id', v_partido_id, 'nuevas_suspensiones', v_nuevas_susp);
end;
$function$
;
