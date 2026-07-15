// #27 Pipeline de analítica agregada anonimizada — supabase/functions/agg-ingest/index.ts
// Estado: DISEÑO. No desplegado. No se ejecuta hoy; sirve para fijar el contrato de
// forma/validación que agg.js (cliente) y rollups_raw (servidor) deben cumplir cuando
// exista un proyecto Supabase real (ver 27-pipeline-analitica.md "Contrato de activación").
//
// A diferencia de supabase/functions/ingest (#25, docs/backend-supabase.md), esta
// función NO requiere Authorization/JWT de adulto: el ingest es anónimo por diseño
// (no hay cuenta que identifique al remitente). La superficie de confianza se
// compensa con: (a) validación estricta de forma/rangos, (b) límite de tamaño de
// lote, y (c) rate limiting por IP en el borde (a configurar en el proveedor,
// fuera del código de esta función — Supabase/Cloudflare, ver checklist en el .md).

import { createClient } from "jsr:@supabase/supabase-js@2";

const MAX_BATCH = 100;
const GAMES = new Set(["math", "reading", "science"]);
const AGE_BANDS = new Set(["3-4", "4-5", "3-5"]);

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Cliente con la clave pública del proyecto (NO service_role). Los inserts pasan
  // por la policy rollups_raw_insert_anon (ver sql/022_rls_rollups.sql); no hay
  // sesión de usuario que establecer.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false } },
  );

  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const anonDeviceId = (body as any)?.anon_device_id;
  const rows = (body as any)?.rollups;
  if (typeof anonDeviceId !== "string" || !isUuid(anonDeviceId)) return json({ error: "bad_anon_device_id" }, 400);
  if (!Array.isArray(rows) || rows.length === 0) return json({ error: "bad_shape" }, 400);
  if (rows.length > MAX_BATCH) return json({ error: "batch_too_large" }, 413);

  const clean = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") return json({ error: "bad_row" }, 400);
    const game = String(r.game ?? "");
    const item = String(r.item ?? "").slice(0, 64);
    const day  = String(r.day ?? "");
    const ageBand = AGE_BANDS.has(r.age_band) ? r.age_band : "3-5";
    if (!GAMES.has(game)) return json({ error: "bad_game" }, 400);
    if (!item) return json({ error: "bad_item" }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return json({ error: "bad_day" }, 400);

    const nEvents = clampInt(r.n_events, 1, 500);
    clean.push({
      anon_device_id: anonDeviceId,
      bucket_day: day,
      game, item, age_band: ageBand,
      n_events: nEvents,
      n_first_try: clampInt(r.n_first_try, 0, nEvents),
      n_assisted: clampInt(r.n_assisted, 0, nEvents),
      sum_ms: Math.max(0, r.sum_ms | 0),
      sum_attempts: Math.max(0, r.sum_attempts | 0),
      app_version: typeof r.app_version === "string" ? r.app_version.slice(0, 32) : null,
    });
  }

  // Nótese: SIN PII en ninguna columna. No se guarda IP/user-agent en esta tabla;
  // si el proveedor los expone en logs de acceso, deben excluirse/purgarse aparte
  // (checklist de infraestructura, no de este código).
  const { error } = await supabase.from("rollups_raw").insert(clean);
  if (error) return json({ error: "insert_failed" }, 400);

  return json({ ok: true, ingested: clean.length });
});

function clampInt(n: unknown, lo: number, hi: number): number {
  const v = typeof n === "number" ? Math.trunc(n) : 0;
  return Math.max(lo, Math.min(hi, v));
}
function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
