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
// (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase solo,
//  no hace falta cargarlos a mano.)
// ══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

function construirHtml(partido: any, localNombre: string, visNombre: string, incidenciasLocal: any[], incidenciasVisitante: any[]) {
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

    const html = construirHtml(partido, localNombre, visNombre, incLocal, incVis);

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
