# #26 Panel nube · cohortes — CONTRATO DE ACTIVACIÓN

> Estado de este entregable: **SCAFFOLD, la mitad nube apagada.** Depende directamente
> de `window.PEQUE_FLAGS.backendSync` (ya `false` en `ship/app.js`, ver
> `../25-backend-supabase/25-backend-supabase.md`). La mitad **local** de este módulo
> (agrupar perfiles del dispositivo en cohortes y ver sus stats agregadas) funciona hoy
> mismo sin red y sin backend, porque solo organiza datos que ya viven en `DB.profiles`.

## Qué es una "cohorte"

Un grupo de perfiles (niños) que un mismo adulto organiza — típicamente una clase o
salón — para ver un resumen agregado en vez de perfil por perfil. Construye directamente
sobre el modelo de `#25` (`public.profiles` / `public.events`): una cohorte no es más que
`cohorts` + una tabla puente `cohort_members` (ver `sql/004_cohorts_schema.sql`).

## Qué SÍ se entrega aquí (ya escrito, ya revisable)

| Archivo | Qué es | Se ejecuta hoy? |
|---|---|---|
| `cohorts.js` §A (local) | `window.PequeCohorts`: crear/renombrar/borrar cohortes, añadir/quitar perfiles, `localStats()` agregando `profile.ev[]` de los miembros vía `window.aggregate()` | **Sí**, 100% offline, funciona bajo `file://`, no toca red en ningún punto |
| `cohorts.js` §B (nube) | Mismo cliente, gate de 4 condiciones idéntico a `PequeSync.isReady()`, `pullCohortOverview()` | Se puede llamar; siempre no-op/promesa rechazada, nunca hace `fetch` (ver §"Por qué nunca hace red" abajo) |
| `sql/004_cohorts_schema.sql` | Tablas `cohorts` / `cohort_members`, dependen de `profiles`/`auth.users` de #25 | No aplicado a ningún proyecto |
| `sql/005_cohorts_rls.sql` | RLS por `owner = auth.uid()`, valida que cohorte y perfil sean del mismo dueño | No aplicado |
| `sql/006_cohorts_views.sql` | 4 vistas de agregación (`v_cohort_overview`, `v_cohort_by_game`, `v_cohort_child_stats`, `v_cohort_top_fails`), espejo en SQL de `aggregate()`/`renderEducator()` de `app.js` | No aplicado; ninguna vista se consulta desde ningún cliente |
| `design-preview.html` | Maqueta estática de una 4ª pestaña "☁️ Cohortes" en el área de adultos, reutilizando las clases CSS del panel educador local (#24: `eduHead`, `statgrid`, `stat`, `bar`, `failitem`, `eduChild`, `spark`) | Archivo standalone, datos de ejemplo hardcodeados, sin red, no wireado a `index.html` |

## Por qué la mitad §B de `cohorts.js` NUNCA hace red

`PequeCohorts.isReady()` exige las mismas cuatro condiciones que `PequeSync.isReady()`
en `#25` (reutilizándolo cuando está cargado, para no duplicar credenciales):

1. `window.PEQUE_FLAGS.backendSync === true`
2. Transporte seguro (`https:`, o `localhost`/`127.0.0.1` en desarrollo)
3. `window.PequeSync.isConfigured()` — credenciales de un proyecto Supabase real
4. Consentimiento del adulto ya registrado (`DB.settings.sync`, misma clave que #25)

Si falta cualquiera, `pullCohortOverview()` devuelve una promesa **rechazada** sin tocar
la red. Y aunque las cuatro se cumplan, sigue devolviendo
`{ok:false, reason:'not_implemented_pending_auth'}` — el `fetch` real contra
`v_cohort_overview` (vía PostgREST/Supabase JS) está deliberadamente **sin implementar**,
igual que `sync.js::flush()` en #25, para que no exista ningún camino de código que abra
una conexión de red sin autenticación real del adulto.

## Diseño del panel (lo que muestra `design-preview.html`)

Cuarta pestaña "☁️ Cohortes" dentro del mismo `<div class="sheet">`/`<div class="panel">`
del área de adultos que ya existe (`gateView`/`adultView`/`eduView` en `ship/index.html`),
detrás del mismo parent-gate (`holdBtn`). Estructura, de arriba a abajo:

1. **Selector de cohorte** — chips horizontales (una por cohorte local +
   "+ Nueva"), mismo lenguaje visual que `.choices.bilMode` ya existente.
2. **Resumen de la cohorte** — `statgrid` con niños/rondas/% aciertos a la 1ª/tiempo
   medio (misma vista que `.eduGlobal` del panel local, acotada a la cohorte).
3. **Barras por materia** — igual a `renderEducator()`, una `.bar` por math/reading/
   science con el color de cada materia (`--math`/`--read`/`--sci`).
4. **"A reforzar" de la cohorte** — hasta 3 `.failitem`, igual formato que
   `eduFaceOf()`/`aggregate().topFails` pero agregado sobre todos los niños del grupo.
5. **Por niño** — lista `.eduChild` con avatar, **alias** (nunca nombre real, coherente
   con la minimización de datos de #25) y `spark` de tendencia — mismo componente que
   ya usa el panel local de #24, reutilizado tal cual.

Toda la sección "nube" se distingue con la `.cloudBadge` ("☁️ Última sincronización: hace
X") para que el adulto entienda que estos datos vienen de otros dispositivos y no son
instantáneos, a diferencia de la pestaña "Educador" local que sí es en tiempo real.

## Qué falta para encender la mitad nube (candado real: producto + legal + infra)

Hereda íntegro el checklist de `#25` (`../25-backend-supabase/25-backend-supabase.md`,
puntos 1–6: proyecto Supabase real, `fetch` real en `flush()`, auth del adulto, UI de
consentimiento, hosting HTTPS, decisión legal/producto) — ninguno de esos puntos es
alcanzable dentro de este entorno de trabajo. Además, específico de cohortes:

7. **`fetch` real en `pullCohortOverview()`.** Sustituir el
   `Promise.reject({reason:'not_implemented_pending_auth'})` actual por consultas
   `GET` a las vistas de `sql/006_cohorts_views.sql` (vía Supabase JS
   `.from('v_cohort_overview').select()`, que respeta RLS automáticamente gracias a
   `security_invoker = on`), una vez exista el JWT del punto 3 de #25.
8. **UI real de gestión de cohortes.** `design-preview.html` es una maqueta estática;
   falta wireado real: nuevo botón/pestaña `tabEdu`-like en `adultView`, nuevos ids DOM
   (p. ej. `eduCohortSelect`, `eduCohortBody` — **no** creados aún en `ship/index.html`),
   y JS que llame a `PequeCohorts.listCohorts()`/`localStats()` para pintar. Al pintar
   nombres de cohorte (entrada de texto del adulto) usar siempre `eduEsc()` — ya existe
   en `app.js` — nunca interpolar sin escapar.
   Concepto de rol "educador con varias cohortes" vs "padre con 1-2 hijos" — decidir si
   ambos comparten la misma UI o si se bifurca (fuera del alcance técnico de este
   entregable, es una decisión de producto).
9. **Multi-adulto por cohorte (opcional).** El diseño actual (`owner = auth.uid()`)
   asume un único adulto dueño de la cohorte. Si se quiere que dos maestros compartan la
   misma "Sala Azul", hace falta una tabla adicional de co-titularidad + políticas RLS
   nuevas — explícitamente fuera de alcance de `sql/004..006` de este entregable.

Mientras 1–9 no existan, `window.PEQUE_FLAGS.backendSync` debe permanecer `false`, y ni
`cohorts.js` ni `design-preview.html` deben referenciarse desde `index.html`/`app.js`.
La mitad local (§A) puede activarse de forma independiente, sin esperar a lo anterior,
si en el futuro se decide ofrecer agrupación de perfiles solo-local (ver siguiente
sección).

## Cómo se integraría el día que se decida activar (fuera de este entregable)

**Mitad local (§A), independiente del backend:**
1. Añadir `<script src="fase4/26-panel-nube-cohortes/cohorts.js" defer></script>` al
   final de `index.html`, después de `app.js` (aditivo).
2. Construir la UI real siguiendo `design-preview.html` (nuevos ids DOM, ver punto 8
   arriba), llamando solo a las funciones de la sección A (`listCohorts`,
   `createCohort`, `localStats`, etc.) — cero dependencia de red.

**Mitad nube (§B), solo tras cumplir 1–9:**
3. Aplicar `sql/004_cohorts_schema.sql` → `sql/005_cohorts_rls.sql` →
   `sql/006_cohorts_views.sql` sobre el mismo proyecto Supabase de #25 (en ese orden,
   después de los `sql/00x` de #25).
4. Implementar el `fetch` real de `pullCohortOverview()` (punto 7).
5. Añadir el `.cloudBadge` con timestamp real de última sincronización, alimentado por
   la respuesta de `pullCohortOverview()`.

## Checklist de cumplimiento heredado (ver `ship/docs/backend-supabase.md` §6 + #25)

- [ ] Todo lo de `#25` (consentimiento, minimización, RLS probado, sin `service_role`
      en cliente, export/borrado, retención, sin SDKs de terceros).
- [ ] Vistas de cohortes con `security_invoker = on` verificado en el proyecto real
      (no asumir el default de Postgres sin comprobarlo tras el despliegue).
- [ ] Los alias de niño (nunca nombre real) son también lo único visible a nivel de
      cohorte — ninguna vista de `sql/006_cohorts_views.sql` expone más PII que las
      tablas base de #25.
- [ ] UI de cohortes escapa todo texto de usuario (nombre de cohorte) con `eduEsc()`.
