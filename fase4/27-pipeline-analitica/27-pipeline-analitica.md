# Pequeñautas — #27 Pipeline de analítica agregada anonimizada (k-anonimato)

> Estado: **DISEÑO. Scaffold gated OFF.** `window.PEQUE_FLAGS.analyticsAgg` es
> `false` por defecto. Ningún archivo de este directorio se referencia desde
> `ship/index.html` ni `ship/app.js`. `agg.js` no abre red bajo ningún estado
> actual (flag off, `file://`, sin configurar, sin consentimiento). Las
> funciones de agregación (`rollupLocal`, `kAnonFilter`) son puras y se pueden
> usar/probar offline hoy mismo; `flush()` está deliberadamente sin
> implementar el `fetch` real — ver §6.

---

## 1. Qué problema resuelve y en qué se diferencia de #25

`ship/docs/backend-supabase.md` (#25) diseña un backend de **respaldo/sync
por niño**: un adulto se autentica, sus perfiles se pseudonimizan (alias, no
nombre real) y sus eventos crudos suben para alimentar **su propio** panel de
educador en la nube. Sigue siendo "sus datos, su panel"; requiere cuenta.

Este documento (#27) diseña algo distinto: un pipeline de **analítica de
producto agregada entre todos los dispositivos que opten por participar**,
para responder preguntas de contenido/currículo — *"¿qué letra falla más a
nivel global?"*, *"¿cuánto tarda de media un niño de 4-5 años en la ronda de
comparar?"* — **sin que ningún dato individual (ni siquiera pseudonimizado)
llegue nunca al servidor.**

Diferencias clave de diseño frente a #25:

| | #25 backend-supabase (sync) | #27 pipeline-analitica (este doc) |
|---|---|---|
| Identidad | Cuenta de adulto (auth.users) | Ninguna cuenta |
| Granularidad enviada | Evento individual pseudonimizado | Conteo agregado por dispositivo/día/ítem |
| Identificador en la fila | `owner` (adulto) + `profile_id` (alias) | `anon_device_id` (UUID rotable, no ligado a ningún niño) |
| Quién lo lee | El propio adulto (RLS por `owner`) | Nadie individualmente: solo vistas agregadas con k-anonimato |
| Propósito | Backup / panel remoto del propio educador | Insights de producto/currículo a nivel población |
| Consentimiento | `DB.settings.sync` | `DB.settings.analyticsConsent` (independiente) |
| Flag | `PEQUE_FLAGS.backendSync` | `PEQUE_FLAGS.analyticsAgg` (independiente) |

Ambos pipelines son opcionales, independientes entre sí, y ambos están OFF
por defecto. Un mismo proyecto Supabase podría alojar los dos esquemas sin
que se toquen (tablas distintas, sin FKs cruzadas).

---

## 2. Por qué k-anonimato (y no solo "quitar el nombre")

Quitar el nombre no basta. Si un reporte muestra *"el niño de la franja 3-4
del dispositivo X tardó 40s en el ítem 'read-Q' el 3 de marzo"*, ese registro
puede seguir siendo re-identificable si muy pocos dispositivos generaron ese
ítem/día/franja (p. ej. una letra poco común, en una franja de edad poco
usada, en un día concreto). Un dataset "sin nombre" pero con celdas pequeñas
sigue filtrando información sobre individuos concretos.

**k-anonimato**: cada fila publicada debe agregar datos de **al menos k
dispositivos distintos** (`k=5` por defecto, ver §4). Si un bucket
(semana × juego × ítem × franja de edad) tiene menos de `k` dispositivos
participantes, la fila entera se **omite** — no se aproxima, no se
redondea, no se sustituye por un rango: desaparece del resultado.

Esto es intencionalmente conservador: preferimos perder visibilidad sobre
combinaciones raras (letra poco frecuente + franja de edad poco común +
semana concreta) antes que arriesgar exponer el patrón de un solo niño.

---

## 3. Qué datos viajan (y qué NUNCA viaja)

Viaja (por dispositivo, agregado, sin niño identificado):

```
anon_device_id   UUID aleatorio, rotable, generado en el cliente
bucket_day       fecha (día)
game             'math' | 'reading' | 'science'
item             clave de contenido, p.ej. 'math-5', 'read-A', 'sci-water'
age_band         '3-4' | '4-5' | '3-5'  (banda, nunca edad exacta)
n_events         cuántas rondas de ese ítem se jugaron ese día en ese dispositivo
n_first_try      cuántas de esas rondas se acertaron al primer intento
n_assisted       cuántas requirieron la pista revelada
sum_ms           suma de milisegundos (para calcular medias agregadas)
sum_attempts     suma de intentos
app_version      versión de la app (para poder descartar builds con bugs)
```

Nunca viaja, en ningún punto de la cadena (cliente, edge function, tabla,
vista): nombre del niño, avatar, alias, `profile.id`, `DB.currentId`,
identificador publicitario, IP (fuera del alcance del código de este
directorio — debe excluirse también de logs de acceso del proveedor, ver
checklist §7), user-agent completo, geolocalización, ni ningún dato de
`localStorage` distinto del propio `anon_device_id`.

`item` reutiliza exactamente las claves de contenido que ya usa
`logRound()`/`aggregate()` en `ship/app.js` (`'math-'+count`,
`'math-sub-'+count`, `'math-cmp'`, `'read-'+L`, `'sci-'+hab`,
`'sci-diet-'+diet`): son identificadores de **contenido pedagógico**, no de
personas.

---

## 4. Dónde se aplica cada capa de agregación

1. **Cliente (`agg.js`, `rollupLocal()`)** — primer nivel de agregación:
   colapsa `DB.profiles[].ev[]` de **todos** los perfiles del dispositivo en
   conteos por (día, juego, ítem), sin ninguna referencia a qué perfil generó
   cada evento. Esto reduce volumen y ya elimina cualquier separación por
   niño *antes* de que el dato salga del dispositivo — pero por sí solo
   **no** es k-anonimato (un dispositivo con 1-2 perfiles no es "k
   dispositivos").
2. **Servidor (`sql/021_kanon_views.sql`, `insights_weekly`)** — segundo
   nivel: agrega `rollups_raw` entre **dispositivos** y aplica
   `HAVING count(distinct anon_device_id) >= 5`. Este es el nivel que
   realmente garantiza k-anonimato. `rollups_raw` (el detalle crudo por
   dispositivo/día) **no tiene policy de SELECT** para ningún rol de cliente
   (ver `sql/022_rls_rollups.sql`): solo se lee a través de la vista
   agregada, y solo por un rol interno de reporting, nunca por `anon`.

---

## 5. Limitación conocida del esquema actual: falta timestamp por evento

`ship/app.js` guarda cada ronda como `{g,k,ft,at,ms,as}` en `profile.ev[]`
— **sin marca de tiempo**. Es suficiente para el panel local (que solo
necesita agregados de "siempre"), pero insuficiente para construir
`bucket_day` con precisión histórica: si `rollupLocal()` recorre
`DB.profiles[].ev[]` en un momento dado, todos los eventos históricos caerían
en el mismo "día de hoy" salvo que se capturen de forma incremental.

**Recomendación de activación** (no implementada aquí, fuera de alcance de
un scaffold aditivo que no debe tocar `logRound`/`afterCorrect` en
`app.js`): capturar el rollup de forma **incremental**, en el momento, en
vez de en lote. El punto de extensión ya existe y sigue el mismo patrón que
usan AudioBank/bilingüe/coplay en `app.js` (envolver `window.afterCorrect`
por reasignación):

```js
// Ejemplo de wiring futuro (NO incluido en este scaffold; requiere activación real)
var _afterCorrect = window.afterCorrect;
window.afterCorrect = function(key){
  _afterCorrect(key);
  try{
    if(window.PequeAggPipeline && window.PequeAggPipeline.isFlagOn()){
      // capturar con Date.now() real en el momento del acierto, no en lote después
    }
  }catch(e){}
};
```

Este cambio de estrategia de captura (incremental vs. lote) debe decidirse
junto con el resto del contrato de activación (§6), no antes.

---

## 6. Contrato de activación — qué falta para encender esto

Ninguno de estos puntos es alcanzable dentro de este entorno de trabajo;
son decisiones de infraestructura/producto/legal reales:

1. **Proyecto Supabase real** (puede ser el mismo de #25 o uno separado) con
   las tablas de `sql/020_rollups_schema.sql`, la vista de
   `sql/021_kanon_views.sql`, las policies de `sql/022_rls_rollups.sql` y el
   cron de `sql/023_retention.sql` desplegados y probados.
2. **Decisión de producto sobre `k`.** `k=5` es un punto de partida
   razonable, no un número validado por el equipo. Debe revisarse junto con
   el volumen esperado de instalaciones activas: con muy pocos dispositivos
   en producción, casi todos los buckets quedarían suprimidos y el pipeline
   sería inútil en la práctica hasta alcanzar masa crítica.
3. **Estrategia de captura incremental con timestamp real** (§5), en vez de
   recorrer `DB.profiles[].ev[]` en lote — implica un pequeño cambio aditivo
   futuro en `app.js` (wrapping de `afterCorrect`, mismo patrón que otros
   módulos de fase4), fuera de alcance de este scaffold.
4. **UI de consentimiento** dentro del *parent gate* que llame a
   `PequeAggPipeline.setConsent(policyVersion)` — independiente del
   consentimiento de sync (#25); debe dejar claro al adulto que esto es
   *analítica de producto agregada y anónima*, no un respaldo de los datos
   de su hijo.
5. **Despliegue de `edge/agg-ingest.ts`** como Edge Function real, con rate
   limiting por IP configurado en el borde del proveedor (no es código de
   esta función; es configuración de infraestructura) para mitigar abuso de
   un endpoint sin autenticación de usuario.
6. **Revisión legal** de que el diseño (conteos agregados, sin PII, sujetos
   a k-anonimato server-side) efectivamente no constituye "información
   personal" bajo COPPA/GDPR-K en la interpretación del equipo legal — este
   documento describe el diseño técnico, no sustituye ese análisis.
7. **Auditoría de logs de acceso del proveedor** para confirmar que IP/
   user-agent de las peticiones a `agg-ingest` no se retienen más allá de lo
   estrictamente operativo (rotación de logs corta), ya que esos campos no
   están bajo control del código de este directorio.
8. **Decisión sobre `insights_weekly` a largo plazo**: si se quiere
   histórico de tendencias más allá de los 90 días de retención de
   `rollups_raw` (§ver `023_retention.sql`), habría que materializar
   snapshots de la vista agregada (que ya no contienen `anon_device_id`) en
   una tabla aparte — no diseñado en este scaffold.

Mientras `PEQUE_FLAGS.analyticsAgg === false` (el default), nada de lo
anterior se ejecuta: la app no depende de red por este módulo y los tests en
`file://` no se ven afectados.

---

## 7. Checklist de cumplimiento

- [ ] `k` (umbral de k-anonimato) revisado y aprobado por producto/legal.
- [ ] Cero columnas de identidad de niño/adulto/perfil en `rollups_raw` o en
      `insights_weekly` (auditado por revisión de esquema).
- [ ] `rollups_raw` sin policy de SELECT para roles de cliente; solo
      INSERT anónimo validado por la edge function.
- [ ] Consentimiento explícito y registrado (`analyticsConsent`) antes de
      cualquier `flush()`, independiente del consentimiento de sync (#25).
- [ ] Retención corta del detalle crudo (90 días) con purga automática.
- [ ] Rate limiting configurado en el borde para el endpoint anónimo de
      ingest.
- [ ] IP/user-agent no persistidos más allá de logs operativos de rotación
      corta del proveedor.
- [ ] Captura incremental con timestamp real implementada antes de fiarse de
      `bucket_day` para análisis histórico (§5).
- [ ] Sin SDKs de analítica/publicidad de terceros en ningún punto de esta
      cadena.
