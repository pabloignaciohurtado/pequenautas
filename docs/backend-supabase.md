# Pequeñautas — Diseño de sincronización backend (Supabase)

> Estado: **DISEÑO. Feature-flagged OFF.** No hay wiring de red en runtime.
> El flag `window.PEQUE_FLAGS.backendSync` es `false` por defecto y ningún
> código de la app abre sockets, hace `fetch`/`XHR` ni carga el SDK de Supabase.
> La app sigue siendo offline-first y funciona abriendo `index.html` en `file://`.
> Este documento describe **cómo se activaría** la sincronización opcional en el
> futuro, sin comprometer la privacidad infantil.

---

## 1. Principios (privacidad infantil: COPPA / GDPR-K)

Pequeñautas está dirigida a niños de 3 a 5 años. Cualquier backend debe cumplir
COPPA (EE. UU.) y el "GDPR-K" (art. 8 RGPD + guías EDPB para menores). Reglas de
diseño no negociables:

1. **Sin cuentas de niño.** El titular de la cuenta es **siempre un adulto**
   (padre/madre/tutor o educador). El niño nunca autentica ni provee datos.
2. **Minimización de datos.** Solo se sincronizan **eventos de aprendizaje
   anonimizados** (materia, ítem, acierto a la 1ª, intentos, ms, asistido) y un
   **alias de perfil** elegido por el adulto. **Prohibido**: nombre real,
   apellidos, foto, voz, fecha de nacimiento exacta, geolocalización, IDs de
   publicidad, contactos.
   - El `name` del perfil local puede ser un nombre de pila; **al sincronizar se
     sustituye por un alias/seudónimo** (p. ej. "Peque 1") o el hash del adulto.
     No se sube el `name` tal cual.
3. **Consentimiento verificable previo.** La sync solo se habilita tras
   consentimiento explícito del adulto detrás del *parent gate*, con registro de
   fecha/versión de política (audit trail). Sin consentimiento → flag OFF.
4. **Propósito limitado.** Los datos solo alimentan el panel del educador/tutor.
   **Sin perfilado publicitario, sin venta, sin terceros de tracking.**
5. **Derechos ARCO/RGPD.** Export y **borrado total** ("olvídame") desde el área
   de adultos; el borrado se propaga en cascada a `events`.
6. **Retención mínima.** Eventos con TTL configurable (por defecto 365 días) y
   purga automática. Sin backups indefinidos de datos de menores.
7. **Región de datos.** Proyecto Supabase en región acorde a la jurisdicción del
   adulto (UE para GDPR-K). Cifrado en tránsito (TLS) y en reposo (Postgres).

---

## 2. Modelo de datos

Dos tablas. Un **adulto** (auth.users) posee **perfiles** (los niños), y cada
perfil tiene **eventos** de aprendizaje. RLS aísla estrictamente por `owner`.

### 2.1 Tabla `profiles`

```sql
create table public.profiles (
  id           uuid primary key default gen_random_uuid(),
  owner        uuid not null references auth.users(id) on delete cascade,
  -- Alias seudónimo del niño (NO el nombre real). Máx 24 chars.
  alias        text not null check (char_length(alias) between 1 and 24),
  avatar       text not null default '🦊',
  -- Sólo grupo de edad, nunca fecha exacta (minimización).
  age_band     text not null default '3-5' check (age_band in ('3-4','4-5','3-5')),
  -- ID del perfil local (para de-dup/upsert desde el dispositivo).
  local_id     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (owner, local_id)
);

create index profiles_owner_idx on public.profiles(owner);
```

### 2.2 Tabla `events`

Refleja `p.ev` local: `{g,k,ft,at,ms,as}`. Sin PII.

```sql
create table public.events (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  owner       uuid not null references auth.users(id) on delete cascade,
  game        text not null check (game in ('math','reading','science')),
  item        text not null,                    -- clave de contenido, p.ej. 'math-3'
  first_try   boolean not null,
  attempts    smallint not null check (attempts between 1 and 20),
  ms          integer not null check (ms >= 0),
  assisted    boolean not null default false,
  -- Anti-duplicado idempotente (mismo evento reenviado no se duplica).
  client_uid  text not null,
  occurred_at timestamptz not null default now(),
  unique (owner, client_uid)
);

create index events_profile_idx on public.events(profile_id);
create index events_owner_time_idx on public.events(owner, occurred_at);
```

`owner` se desnormaliza en `events` para que RLS sea una comparación directa
(sin JOIN) y para purga/borrado eficientes.

---

## 3. Row Level Security (RLS)

RLS **activado** en ambas tablas. Un adulto solo ve/escribe lo suyo. Ningún
cliente puede leer datos de otros niños/otros adultos.

```sql
alter table public.profiles enable row level security;
alter table public.events   enable row level security;

-- profiles: dueño = usuario autenticado
create policy profiles_select on public.profiles
  for select using (owner = auth.uid());
create policy profiles_insert on public.profiles
  for insert with check (owner = auth.uid());
create policy profiles_update on public.profiles
  for update using (owner = auth.uid()) with check (owner = auth.uid());
create policy profiles_delete on public.profiles
  for delete using (owner = auth.uid());

-- events: dueño = usuario autenticado; el perfil debe pertenecer al mismo dueño
create policy events_select on public.events
  for select using (owner = auth.uid());
create policy events_insert on public.events
  for insert with check (
    owner = auth.uid()
    and exists (select 1 from public.profiles pr
                where pr.id = events.profile_id and pr.owner = auth.uid())
  );
create policy events_delete on public.events
  for delete using (owner = auth.uid());
-- events es append-only: sin policy de UPDATE (inmutables).
```

Notas de seguridad:
- La `service_role` (solo servidor) **nunca** se expone al cliente ni a la app.
- El cliente usaría únicamente la **anon/publishable key** + JWT del adulto.
- La edge function corre con contexto del usuario (JWT) para que RLS aplique.

---

## 4. Edge Function de ingest

`supabase/functions/ingest/index.ts`. Recibe un lote de eventos del dispositivo,
valida forma/tamaño y hace **upsert idempotente** (por `client_uid`). No confía
en `owner` del payload: lo deriva del JWT.

```ts
// supabase/functions/ingest/index.ts
import { createClient } from "jsr:@supabase/supabase-js@2";

const MAX_BATCH = 200;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  // Cliente ligado al JWT del adulto -> RLS aplica a cada escritura.
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
  const events  = (body as any)?.events;     // [{ client_uid, game, item, first_try, attempts, ms, assisted, occurred_at }]
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
      age_band: ["3-4","4-5","3-5"].includes(profile.age_band) ? profile.age_band : "3-5",
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
```

Purga por retención (cron programado en Supabase):

```sql
-- Borra eventos > 365 días (retención mínima).
delete from public.events where occurred_at < now() - interval '365 days';
```

Borrado total ("olvídame"): `delete from profiles where owner = auth.uid()` —
cascada borra `events`.

---

## 5. Activación (cuando exista consentimiento)

El flag ya existe en la app pero está **OFF** y sin efecto:

```js
window.PEQUE_FLAGS = { backendSync: false };  // por defecto
```

Contrato de activación futura (fuera del runtime actual):

1. Adulto entra por el *parent gate* → pantalla de consentimiento (política +
   versión + fecha) → si acepta: `PEQUE_FLAGS.backendSync = true` persistido en
   `DB.settings.sync = { on:true, consentAt, policyVersion }`.
2. Autenticación del adulto (email magic-link/OAuth) → obtiene JWT.
3. Un módulo **nuevo y separado** (`sync.js`, cargado sólo si el flag está ON y
   el protocolo es `https`) recorre `DB.profiles`, mapea `name → alias`, genera
   `client_uid` por evento (idempotencia) y hace `POST` a `/functions/v1/ingest`.
4. La sync es **una dirección** (dispositivo → nube, solo lectura en el panel del
   educador remoto). El panel local sigue siendo la fuente de verdad offline.

Mientras `backendSync === false`, **nada de lo anterior se ejecuta**; la app no
depende de red y los tests en `file://` no se ven afectados.

---

## 6. Checklist de cumplimiento

- [ ] Consentimiento verificable del adulto registrado antes de cualquier envío.
- [ ] Solo alias seudónimo + métricas; cero PII directa (nombre real, voz, foto).
- [ ] RLS activado y probado (un adulto no puede leer datos de otro).
- [ ] `service_role` nunca en el cliente.
- [ ] Export + borrado total accesibles desde el área de adultos.
- [ ] Retención con purga automática (TTL configurable).
- [ ] Región de datos acorde a jurisdicción (UE para GDPR-K).
- [ ] Sin SDKs de analítica/publicidad de terceros.
