# #25 Backend Supabase (cuentas/sync/respaldo) — CONTRATO DE ACTIVACIÓN

> Estado de este entregable: **SCAFFOLD, apagado.** `window.PEQUE_FLAGS.backendSync`
> ya existe en `ship/app.js` (línea ~921) con default `false`. Ninguno de los archivos
> de este directorio abre red en runtime bajo ese default, ni bajo `file://`. El
> diseño de datos completo (tablas, RLS, edge function, principios COPPA/GDPR-K) ya
> vive en `ship/docs/backend-supabase.md`; este directorio añade el **código
> activable** (cliente `sync.js`, SQL, edge function) que consumiría ese diseño el
> día que se decida encenderlo — hoy no se enciende.

## Qué SÍ se entrega aquí (ya escrito, ya revisable, ya "activable")

| Archivo | Qué es | Se ejecuta hoy? |
|---|---|---|
| `sync.js` | Cliente JS (`window.PequeSync`): config en memoria, cola local, alias seudónimo, `flush()` gateado | Se puede cargar; **no hace red** salvo que se cumplan 4 condiciones a la vez (ver abajo), y aun así `flush()` devuelve `not_implemented_pending_auth` (ver §2) |
| `sql/001_schema.sql` | Tablas `profiles`/`events` (mismo diseño que `docs/backend-supabase.md` §2) | No aplicado a ningún proyecto |
| `sql/002_rls.sql` | Políticas RLS por `owner = auth.uid()` | No aplicado |
| `sql/003_retention.sql` | Purga a 365 días + borrado total ("olvídame") | No aplicado |
| `edge/ingest.ts` | Edge function de ingest, idempotente por `client_uid` | No desplegada |

## Por qué `sync.js` NUNCA hace red en este estado, aunque alguien active el flag

`isReady()` en `sync.js` exige **las cuatro** condiciones a la vez:

1. `window.PEQUE_FLAGS.backendSync === true`
2. Transporte seguro (`https:`, o `localhost`/`127.0.0.1` para desarrollo)
3. `configure({url, anonKey})` llamado con credenciales válidas de un proyecto real
4. `DB.settings.sync = {on:true, consentAt, policyVersion}` — consentimiento del
   adulto ya registrado localmente

Si falta cualquiera, `flush()` devuelve una promesa **rechazada** sin tocar la red
(`{ok:false, reason:'flag_off'|'insecure_transport'|'not_configured'|'no_consent'}`).
Y aunque las cuatro se cumplan, `flush()` todavía devuelve
`{ok:false, reason:'not_implemented_pending_auth'}` — el `fetch` real al edge
function está deliberadamente **sin implementar** en este scaffold (ver §2, punto 1)
para que no exista ningún camino de código, ni siquiera detrás del flag, que abra
una conexión de red sin que antes exista autenticación real del adulto.

## Qué falta para encender (candado real: producto + legal + infra, no permisos)

Nada de esto puede completarse dentro de este entorno de trabajo — requiere una
cuenta real de Supabase, dominio con HTTPS, y una decisión de producto/legal sobre
consentimiento y jurisdicción de datos:

1. **Proyecto Supabase real.** Crear proyecto (región UE si el público objetivo es
   GDPR-K), aplicar `sql/001_schema.sql` → `sql/002_rls.sql` → `sql/003_retention.sql`
   (en ese orden), desplegar `edge/ingest.ts` como función `ingest`, y programar la
   purga de `003_retention.sql` como cron de Supabase.
2. **Implementar el `fetch` real en `sync.js::flush()`.** Sustituir el
   `Promise.reject({reason:'not_implemented_pending_auth'})` actual por un
   `POST ${CFG.url}/functions/v1/ingest` con `Authorization: Bearer <jwt>`, una vez
   exista el paso 3.
3. **Autenticación del adulto.** Decidir e implementar el flujo (magic-link/OAuth)
   que produce el JWT que `sync.js` necesitaría para llamar a `flush()`. Vive fuera
   del alcance de un módulo cliente-only: requiere un proveedor de auth real.
4. **UI de consentimiento verificable.** Pantalla dentro del parent gate ya
   existente que explique qué se sincroniza (alias + métricas, nunca nombre real),
   registre versión de política + fecha, y llame a `PequeSync.setConsent(version)`.
   Sin esta UI, `hasConsent()` siempre es `false` y `isReady()` nunca se cumple.
5. **Hosting HTTPS.** El deploy actual sirve `index.html` como archivo/estático
   simple; `transportOk()` exige `https:` (o `localhost` en desarrollo), así que
   cualquier despliegue final debe servirse por HTTPS antes de que la sync tenga
   sentido (ya es el caso típico en Vercel, pero se deja explícito aquí).
6. **Decisión de producto/legal**: versión de política de privacidad, jurisdicción
   de datos, y quién es el "controlador de datos" responsable ante COPPA/GDPR-K.
   Ninguna de estas decisiones es técnica ni removible por permisos de este agente.

Mientras 1–6 no existan, `window.PEQUE_FLAGS.backendSync` debe permanecer `false` y
este directorio no debe referenciarse desde `index.html`/`app.js`.

## Cómo se integraría el día que se decida activar (fuera de este entregable)

1. Completar §"Qué falta" 1–6.
2. Añadir `<script src="fase4/25-backend-supabase/sync.js" defer></script>` al final
   de `index.html`, después de `app.js` (aditivo, no reemplaza nada).
3. La UI de consentimiento (paso 4) llama a `PequeSync.configure(...)` y
   `PequeSync.setConsent(...)`.
4. Un punto de disparo explícito (p. ej. un botón "Sincronizar ahora" en el panel de
   adultos, o un intervalo largo gestionado por esa misma UI futura — nunca dentro
   de `sync.js` en este scaffold) llama a `PequeSync.enqueueAll()` y
   `PequeSync.flush()`.

## Checklist de cumplimiento heredado (ver `ship/docs/backend-supabase.md` §6)

- [ ] Consentimiento verificable del adulto registrado antes de cualquier envío.
- [ ] Solo alias seudónimo + métricas; cero PII directa (nombre real, voz, foto).
- [ ] RLS activado y probado (un adulto no puede leer datos de otro).
- [ ] `service_role` nunca en el cliente.
- [ ] Export + borrado total accesibles desde el área de adultos.
- [ ] Retención con purga automática (TTL configurable).
- [ ] Región de datos acorde a jurisdicción (UE para GDPR-K).
- [ ] Sin SDKs de analítica/publicidad de terceros.
