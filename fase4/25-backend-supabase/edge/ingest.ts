// #25 Backend Supabase — edge function de ingest (SCAFFOLD, NO desplegada).
// Corre en el servidor de Supabase (Deno), nunca en el navegador del niño.
// Recibe un lote de eventos del dispositivo (enviado por sync.js::flush() una vez
// activado), valida forma/tamaño y hace upsert idempotente (por client_uid). No
// confía en `owner` del payload: lo deriva del JWT del adulto autenticado.
// Reproduce ship/docs/backend-supabase.md §4. Desplegar solo tras cumplir el
// checklist de activación (ver ../25-backend-supabase.md de este directorio).
import { createClient } from "jsr:@supabase/supabase-js@2";

const MAX_BATCH = 200;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  // Cliente ligado al JWT del adulto -> RLS aplica a cada escritura (nunca service_role aquí).
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false } },
  );

  const { data: { user }, error: uErr } = await supabase.auth.getUser();
  if (uErr || !user) return json({ error: "unauthorized" }, 401);

  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const profile = (body as any)?.profile;   // { local_id, alias, avatar, age_band }
  const events  = (body as any)?.events;    // [{ client_uid, game, item, first_try, attempts, ms, assisted }]
  if (!profile?.local_id || !Array.isArray(events)) return json({ error: "bad_shape" }, 400);
  if (events.length > MAX_BATCH) return json({ error: "batch_too_large" }, 413);

  // Upsert del perfil (alias seudónimo, nunca nombre real).
  const { data: prof, error: pErr } = await supabase
    .from("profiles")
    .upsert({
      owner: user.id,
      local_id: String(profile.local_id),
      alias: String(profile.alias ?? "Peque").slice(0, 24),
      avatar: String(profile.avatar ?? "🦊"),
      age_band: ["3-4", "4-5", "3-5"].includes(profile.age_band) ? profile.age_band : "3-5",
      updated_at: new Date().toISOString(),
    }, { onConflict: "owner,local_id" })
    .select("id").single();
  if (pErr || !prof) return json({ error: "profile_upsert_failed" }, 400);

  const rows = events.slice(0, MAX_BATCH).map((e: any) => ({
    owner: user.id,
    profile_id: prof.id,
    client_uid: String(e.client_uid),
    game: e.game, item: String(e.item).slice(0, 64),
    first_try: !!e.first_try,
    attempts: Math.max(1, Math.min(20, e.attempts | 0)),
    ms: Math.max(0, e.ms | 0),
    assisted: !!e.assisted,
    occurred_at: e.occurred_at ?? new Date().toISOString(),
  }));

  // Idempotente: choques por (owner, client_uid) se ignoran.
  const { error: eErr } = await supabase
    .from("events")
    .upsert(rows, { onConflict: "owner,client_uid", ignoreDuplicates: true });
  if (eErr) return json({ error: "events_upsert_failed" }, 400);

  return json({ ok: true, profile_id: prof.id, ingested: rows.length });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
