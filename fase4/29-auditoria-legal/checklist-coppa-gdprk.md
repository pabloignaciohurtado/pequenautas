# Checklist de cumplimiento — COPPA / GDPR-K

> Complementa `29-auditoria-legal.md`. Estado a la fecha de esta auditoría
> (basado en `ship/` v0.4 + scaffolds de fase 4 no activos). Leyenda de
> estado: ✅ Cumple hoy · ⚠️ Cumple parcialmente / requiere acción menor ·
> 🔒 No aplica hoy, pero **queda bloqueado por firma legal** antes de activar
> · ➖ No aplica a esta app.

## A. COPPA (16 CFR Part 312)

| # | Requisito | Estado | Evidencia / comentario |
|---|---|---|---|
| A1 | Aviso claro y accesible de qué información se recolecta, cómo se usa y a quién se divulga (§312.3, §312.4(a)) | ⚠️ | No hay política publicada hoy. Resuelto como **borrador** en `politica-privacidad.md`; falta publicarla (requiere firma legal, §7 del documento principal). |
| A2 | Consentimiento verificable de un padre/tutor antes de recolectar información personal de un niño menor de 13 años (§312.5) | ➖ hoy / 🔒 futuro | No aplica hoy: no se recolecta información personal **fuera del dispositivo** del propio adulto. Se vuelve obligatorio en cuanto se active cualquier sync (`backendSync`, `analyticsAgg`). El mecanismo de consentimiento ya está diseñado (`DB.settings.sync={on,consentAt,policyVersion}` en `docs/backend-supabase.md`) pero no implementado. |
| A3 | Excepción de "collection for support of internal operations" solo si no hay divulgación externa ni uso para otros fines | ➖ | No aplica: no hay recolección fuera del dispositivo hoy. |
| A4 | Derecho de los padres a revisar la información personal recolectada del niño (§312.6(a)(1)) | ✅ | El dato vive en `localStorage` del propio dispositivo/adulto; el panel de progreso (`renderProgress2()`) y el panel educador (`renderEducator()`/CSV) ya lo exponen íntegro. |
| A5 | Derecho de los padres a solicitar la eliminación de la información del niño (§312.6(a)(3)) | ⚠️ | Técnicamente posible hoy (borrar `localStorage`/desinstalar), pero **no hay un botón dedicado de "borrar todos mis datos"** en el panel de adultos. Recomendación no bloqueante para una futura mejora de tipo `code` (fuera de alcance de este punto #29, que es `docs`). |
| A6 | Prohibición de condicionar la participación del niño a la entrega de más información de la razonablemente necesaria (§312.7) | ✅ | El juego funciona íntegramente sin nombre real (el adulto puede usar cualquier alias) y sin ningún dato opcional adicional. |
| A7 | Retención limitada a lo razonablemente necesario y eliminación segura cuando ya no se necesite (§312.8) | ✅ hoy / 🔒 futuro | Hoy: sin servidor, sin retención más allá de lo que el propio dispositivo conserve. Backend futuro: TTL de 365 días + purga ya diseñados en `docs/backend-supabase.md` §6, pendientes de implementación y de revisión legal antes de activar. |
| A8 | Medidas de seguridad razonables para proteger la confidencialidad/integridad de los datos del niño (§312.8) | ✅ | XSS: `eduEsc()` sobre nombre/avatar en cada render. CSV injection: guarda anti-fórmula en `eduExportCSV()`. Sin transmisión de red de datos del niño. |
| A9 | Prohibición de retener datos por más tiempo del necesario tras cesar la relación con el usuario | ✅ | No hay "relación" con un servidor: los datos se quedan en el dispositivo hasta que el usuario los borra. |
| A10 | La app es inequívocamente *child-directed* → aplica COPPA en su forma estricta, sin excepción de "audiencia mixta" con edad-gating neutral | ✅ (informativo) | Confirmado por diseño (personajes, mecánica 3–5 años); no se necesita ni se debe implementar un age-gate neutral tipo "¿cuántos años tienes?" — sería contraproducente y no exime de COPPA de todas formas. |
| A11 | Requisitos específicos de tienda (Google Play Families / Apple Kids Category) revisados antes de publicar en cada tienda | 🔒 | Fuera del alcance de COPPA/GDPR-K propiamente, pero relacionado; queda como parte del mismo candado de §7 (revisión legal/producto antes de publicar en tienda). |

## B. GDPR-K (art. 8 RGPD + guías EDPB)

| # | Requisito | Estado | Evidencia / comentario |
|---|---|---|---|
| B1 | Base legal para el tratamiento (consentimiento del titular de la patria potestad cuando el servicio se ofrece directamente a un menor, art. 8.1) | ➖ hoy / 🔒 futuro | No hay tratamiento fuera del dispositivo del adulto hoy (a confirmar con el abogado revisor si el modelo "todo en el dispositivo" cae fuera del ámbito de aplicación del RGPD como tal, o si simplemente no hay transferencia que requiera base legal adicional). Se vuelve obligatorio con cualquier sync futura. |
| B2 | Minimización de datos (art. 5.1.c) | ✅ | `ev[]={g,k,ft,at,ms,as}` es el mínimo necesario para el panel de progreso; sin campos superfluos. |
| B3 | Limitación de la finalidad (art. 5.1.b) | ✅ | Los eventos solo alimentan el panel de progreso/educador local; no hay perfilado publicitario ni reutilización para otro fin. |
| B4 | Transparencia (art. 5.1.a, art. 12–14) | ⚠️ | Resuelto como **borrador** pendiente de firma (`politica-privacidad.md`). |
| B5 | Transferencias a terceros identificadas y con base legal/salvaguardas (art. 44 y ss., y en general cualquier tercero que reciba datos) | ⚠️ | **Hallazgo H1**: Google Fonts transmite la IP del visitante a Google sin mecanismo de consentimiento ni mención previa en una política. Documentado; remediación técnica sugerida (auto-hospedar fuentes) queda fuera de alcance de este punto `docs`. Voces de síntesis potencialmente remotas: **hallazgo H2**, mismo tratamiento. |
| B6 | Minimización adicional específica para menores (edad exacta, geolocalización, biometría evitados) | ✅ | No se recolecta fecha de nacimiento exacta (no se pregunta edad en absoluto), ni geolocalización, ni datos biométricos/voz grabada del niño. |
| B7 | Derechos del interesado: acceso, rectificación, supresión, portabilidad, oposición | ✅ hoy (trivial) / 🔒 a rediseñar en backend futuro | Hoy: el adulto tiene acceso y control total y directo sobre el único almacén de datos (su propio dispositivo). El diseño de backend futuro ya prevé export + borrado total (`docs/backend-supabase.md` §1.5, §6). |
| B8 | Privacy by Design / by Default (art. 25) | ✅ | El flag `backendSync` nace en `false`; el alias sustituye al nombre real *por diseño* antes de cualquier sync; RLS por dueño diseñado desde el inicio, no añadido después. |
| B9 | Evaluación de Impacto en Protección de Datos (DPIA/EIPD) cuando el tratamiento a gran escala de datos de menores lo requiera (art. 35) | 🔒 | No aplica hoy (no hay tratamiento fuera del dispositivo). Recomendado **antes** de activar cualquier backend a escala — parte del candado de §7. |
| B10 | Responsable del tratamiento (controller) claramente identificado en la política | ⚠️ | Placeholder en el borrador (`politica-privacidad.md`); requiere que el negocio/abogado complete la razón social real antes de publicar. |
| B11 | Región de almacenamiento de datos acorde a la jurisdicción del usuario (relevante para GDPR-K si hay usuarios UE) | 🔒 | Ya contemplado como requisito de diseño en `docs/backend-supabase.md` §1.7 (región UE del proyecto Supabase); pendiente de decisión real al momento de aprovisionar el backend, parte del candado de §7. |

## C. Resumen de acciones pendientes por responsable

| Acción | Responsable | Bloqueante para |
|---|---|---|
| Revisar, corregir y firmar `politica-privacidad.md` | Abogado/firma legal | Publicar la política; declarar cumplimiento ante tienda/regulador/cliente B2B |
| Decidir si se auto-hospeda Google Fonts antes de publicar (H1) | Producto + Ingeniería | Cerrar el hallazgo H1 sin excepción documentada |
| Confirmar jurisdicción(es) de distribución objetivo | Producto + Legal | Determinar qué anexos de la política aplican (EE. UU./UE/otras) |
| Aprobar formalmente (registro de quién/cuándo/versión) | Responsable de producto/negocio | Activar `PEQUE_FLAGS.backendSync`/`analyticsAgg` o cualquier flag de red futuro sobre datos de menores |
| (No bloqueante) Añadir botón "borrar todos mis datos" en el panel de adultos | Ingeniería (futura mejora `code`) | Mejora de A5, no requerida para cumplir hoy |
