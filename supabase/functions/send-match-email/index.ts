// ══════════════════════════════════════════════════════════════
// ACPF – Envío de aviso por mail al cargar un partido
//
// Corre en el servidor (Supabase Edge Function), no en el navegador.
// Usa la Service Role Key para leer los datos del partido sin
// restricciones de RLS, y envía el mail autenticándose directo
// contra Gmail (así el correo sale realmente de esa cuenta).
//
// Variables de entorno necesarias (Supabase → Edge Functions → Secrets):
//   GMAIL_USER            la cuenta de Gmail que envía (ej. acpf@gmail.com)
//   GMAIL_APP_PASSWORD    contraseña de aplicación de esa cuenta (16 caracteres)
//   TEST_EMAIL_TO         mientras se prueba: A QUIÉN llega en vez de a los
//                         delegados reales. Sacar/vaciar esta variable el día
//                         que se quiera enviar a los delegados de verdad.
//   APP_URL (opcional)    URL del botón "Ingresar a la app" al pie del mail.
//                         Si no se carga, usa la de GitHub Pages actual.
// (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase solo,
//  no hace falta cargarlos a mano.)
// ══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// URL de acceso a la app, para el botón al pie del mail. Se puede
// sobreescribir con el secret APP_URL (por ejemplo, el día que se
// transfiera el repo a la cuenta de la ACPF) sin tocar este código.
const APP_URL = Deno.env.get("APP_URL") || "https://acpf26.github.io/Planillas2026/";

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

function construirHtml(
  partido: any,
  localNombre: string,
  visNombre: string,
  incidenciasLocal: any[],
  incidenciasVisitante: any[],
  suspensiones: any[],
  avisos4Amarillas: any[]
) {
  const tablaIncidencias = (nombreClub: string, filas: any[]) => {
    const conDatos = filas.filter((j) => j.goles > 0 || j.amarillas > 0 || j.roja);
    if (!conDatos.length) return "";
    return `
      <h3 style="color:#1a3fcc;margin:20px 0 10px;font-family:Arial,sans-serif;">${esc(nombreClub)}</h3>
      <table style="border-collapse:collapse;font-size:13px;width:100%;font-family:Arial,sans-serif;">
        <tr style="background:#1a3fcc;color:white;">
          <th style="padding:6px 10px;text-align:left;">Jugador</th>
          <th style="padding:6px 10px;">⚽</th><th style="padding:6px 10px;">🟨</th><th style="padding:6px 10px;">🟥</th>
        </tr>
        ${conDatos
          .map(
            (j, i) => `
        <tr style="background:${i % 2 === 0 ? "#f8f9ff" : "white"}">
          <td style="padding:6px 10px;">${esc(j.jugadores?.nombre || "")}</td>
          <td style="padding:6px 10px;text-align:center;">${j.goles || "–"}</td>
          <td style="padding:6px 10px;text-align:center;">${j.amarillas || "–"}</td>
          <td style="padding:6px 10px;text-align:center;">${j.roja ? "Sí" : "–"}</td>
        </tr>`
          )
          .join("")}
      </table>`;
  };

  return `
  <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
    <div style="background:linear-gradient(135deg,#1a3fcc,#0d1730);padding:20px 24px;border-radius:10px 10px 0 0;">
      <h1 style="color:white;font-size:20px;margin:0 0 4px;">⚽ ACPF — Planilla de Partido</h1>
      <p style="color:rgba(255,255,255,0.7);font-size:11px;margin:0;text-transform:uppercase;letter-spacing:1px;">Asociación Civil Paceña de Fútbol</p>
    </div>
    <div style="padding:24px;background:white;">
      <table style="border-collapse:collapse;font-size:14px;margin-bottom:20px;">
        <tr><td style="padding:4px 10px 4px 0;font-weight:bold;color:#555;width:150px;">Fecha Campeonato</td><td>Fecha ${esc(partido.fecha_nro)}</td></tr>
        <tr><td style="padding:4px 10px 4px 0;font-weight:bold;color:#555;">Categoría</td><td>${esc(partido.categoria)}</td></tr>
        <tr><td style="padding:4px 10px 4px 0;font-weight:bold;color:#555;">Árbitro</td><td>${esc(partido.arbitro) || "–"}</td></tr>
        <tr><td style="padding:4px 10px 4px 0;font-weight:bold;color:#555;">Resultado</td>
            <td style="font-size:17px;font-weight:bold;color:#1a1f3a;">${esc(localNombre)} ${partido.goles_local} – ${partido.goles_visitante} ${esc(visNombre)}</td></tr>
      </table>
      ${tablaIncidencias(localNombre, incidenciasLocal)}
      ${tablaIncidencias(visNombre, incidenciasVisitante)}
      ${partido.observacion ? `<p style="margin-top:20px;font-size:13px;"><strong>Observación:</strong> ${esc(partido.observacion)}</p>` : ""}
      ${
        suspensiones.length
          ? `
      <div style="background:#fff0f0;border:1px solid #ffd0d0;border-radius:8px;padding:14px 16px;margin-top:20px;">
        <h3 style="color:#e03030;margin:0 0 10px;font-family:Arial,sans-serif;font-size:15px;">⚠️ Nuevas suspensiones</h3>
        ${suspensiones
          .map(
            (s) => `
        <div style="font-size:13px;padding:5px 0;border-bottom:1px solid #ffe0e0;">
          <strong>${esc(s.jugador)}</strong> (${esc(s.club)}) — le corresponden <strong>${s.fechas_a_cumplir} fecha${s.fechas_a_cumplir > 1 ? "s" : ""}</strong> de suspensión
          ${s.tipo === "Roja" ? "según informe arbitral" : "por acumulación de 5 amarillas"},
          desde la Fecha ${s.fecha_inicio}.
        </div>`
          )
          .join("")}
      </div>`
          : ""
      }
      ${
        avisos4Amarillas.length
          ? `
      <div style="background:#fffbea;border:1px solid #f5c518;border-radius:8px;padding:14px 16px;margin-top:14px;">
        <h3 style="color:#946200;margin:0 0 10px;font-family:Arial,sans-serif;font-size:15px;">🟨 A un paso de la suspensión</h3>
        ${avisos4Amarillas
          .map(
            (a) => `
        <div style="font-size:13px;padding:5px 0;border-bottom:1px solid #fbeec2;">
          <strong>${esc(a.nombre)}</strong> (${esc(a.club)}) llegó a <strong>4 amarillas acumuladas</strong> — una más y queda suspendido.
        </div>`
          )
          .join("")}
      </div>`
          : ""
      }
      <div style="text-align:center;margin-top:26px;">
        <a href="${APP_URL}" style="display:inline-block;background:#1a3fcc;color:white;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 28px;border-radius:8px;">👉 Ingresar a la app</a>
        <p style="font-size:11px;color:#999;margin-top:10px;">Ingresá con tu correo y la contraseña que te dio la ACPF.</p>
      </div>
    </div>
    <div style="padding:14px 24px;border-top:1px solid #eee;font-size:11px;color:#999;background:white;border-radius:0 0 10px 10px;">
      Sistema ACPF — este correo se generó automáticamente al cargar la planilla.
    </div>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { partido_id } = await req.json();
    if (!partido_id) throw new Error("Falta partido_id");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: partido, error: errPartido } = await supabase
      .from("partidos")
      .select("*, local:club_local_id(nombre), visitante:club_visitante_id(nombre)")
      .eq("id", partido_id)
      .single();
    if (errPartido || !partido) throw new Error("Partido no encontrado: " + (errPartido?.message || ""));

    const { data: incidencias, error: errInc } = await supabase
      .from("incidencias")
      .select("club_id,goles,amarillas,roja,jugadores(nombre)")
      .eq("partido_id", partido_id);
    if (errInc) throw new Error("Error leyendo incidencias: " + errInc.message);

    const localNombre = (partido as any).local?.nombre || "Local";
    const visNombre = (partido as any).visitante?.nombre || "Visitante";
    const incLocal = (incidencias || []).filter((i: any) => i.club_id === partido.club_local_id);
    const incVis = (incidencias || []).filter((i: any) => i.club_id === partido.club_visitante_id);

    // Suspensiones nuevas + aviso de "4 amarillas". Todo esto es contenido
    // extra del mail: si algo falla acá, no debe voltear el envío del mail
    // en sí — se loguea el error y se manda igual, solo sin esos recuadros.
    let suspensiones: any[] = [];
    let avisos4Amarillas: any[] = [];
    try {
      // Suspensiones nuevas generadas por este partido puntual (roja directa,
      // doble amarilla, o quinta amarilla acumulada). Se identifican por
      // fecha_inicio = fecha del partido + 1, misma categoría y alguno de los
      // dos clubes — es exacto porque cargar_partido siempre las crea así.
      const { data: sancionesRaw } = await supabase
        .from("sanciones")
        .select("tipo,fecha_inicio,fechas_a_cumplir,club_id,jugadores(nombre)")
        .eq("fecha_inicio", partido.fecha_nro + 1)
        .eq("categoria", partido.categoria)
        .in("club_id", [partido.club_local_id, partido.club_visitante_id])
        .eq("estado", "Vigente");

      suspensiones = (sancionesRaw || []).map((s: any) => ({
        jugador: s.jugadores?.nombre || "",
        club: s.club_id === partido.club_local_id ? localNombre : visNombre,
        tipo: s.tipo,
        fecha_inicio: s.fecha_inicio,
        fechas_a_cumplir: s.fechas_a_cumplir,
      }));

      // Aviso de "4 amarillas" — solo para quienes sumaron una amarilla en
      // ESTE partido y quedaron justo en 4 (todavía no suspendidos).
      // Una sola consulta para los dos clubes (antes era una por jugador,
      // lo que con varios amonestados hacía que la función tardara de más
      // y la conexión se cortara antes de responder).
      const conAmarilla = (incidencias || []).filter((i: any) => i.amarillas > 0);
      if (conAmarilla.length) {
        const { data: acumAll } = await supabase
          .from("acumulado_amarillas")
          .select("nombre,club_id,total,en_suspension")
          .in("club_id", [partido.club_local_id, partido.club_visitante_id]);

        for (const inc of conAmarilla) {
          const nombre = (inc as any).jugadores?.nombre;
          if (!nombre) continue;
          const acumRow = (acumAll || []).find((a: any) => a.nombre === nombre && a.club_id === inc.club_id);
          if (acumRow && acumRow.total === 4 && !acumRow.en_suspension) {
            avisos4Amarillas.push({
              nombre,
              club: inc.club_id === partido.club_local_id ? localNombre : visNombre,
            });
          }
        }
      }
    } catch (err) {
      console.error("No se pudieron armar suspensiones/avisos, se manda el mail sin esa parte:", err);
    }

    // denomailer tiene un bug conocido: al codificar en quoted-printable,
    // cualquier espacio justo antes de un salto de línea queda mal
    // codificado y aparece como texto literal "=20" en el mail recibido.
    // Sacando los saltos de línea del HTML antes de mandarlo, ese patrón
    // nunca aparece (el resultado visual no cambia — los navegadores/
    // clientes de mail ya colapsan espacios en blanco al renderizar HTML).
    const html = construirHtml(partido, localNombre, visNombre, incLocal, incVis, suspensiones, avisos4Amarillas)
      .replace(/\s+/g, " ")
      .trim();

    const testTo = Deno.env.get("TEST_EMAIL_TO");
    const destinatario = testTo || Deno.env.get("GMAIL_USER")!; // nunca se manda a delegados sin querer

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: Deno.env.get("GMAIL_USER")!,
          password: Deno.env.get("GMAIL_APP_PASSWORD")!,
        },
      },
    });

    const asunto = `${testTo ? "[PRUEBA] " : ""}ACPF | Fecha ${partido.fecha_nro} – ${localNombre} ${partido.goles_local}-${partido.goles_visitante} ${visNombre}`;

    await client.send({
      from: Deno.env.get("GMAIL_USER")!,
      to: destinatario,
      subject: asunto,
      content: "auto",
      html,
    });
    await client.close();

    return new Response(JSON.stringify({ ok: true, enviado_a: destinatario, modo_prueba: !!testTo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
