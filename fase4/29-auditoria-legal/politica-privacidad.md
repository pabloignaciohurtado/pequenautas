# Política de privacidad de Pequeñautas — BORRADOR

> ⚠️ **ESTE ES UN BORRADOR TÉCNICO, NO UN DOCUMENTO LEGAL VIGENTE.**
> Redactado por el agente de ingeniería a partir de la auditoría de código en
> `29-auditoria-legal.md`. Contiene **placeholders entre corchetes**
> (`[ASÍ]`) que deben completarse con datos reales, y **debe ser revisado,
> corregido y aprobado/firmado por un abogado con competencia en privacidad
> infantil (COPPA / GDPR-K y normativa local aplicable)** antes de
> publicarlo, enlazarlo desde la app, o presentarlo ante una tienda de apps,
> colegio/cliente B2B o regulador. Ver el candado de firma legal en
> `29-auditoria-legal.md` §7.
>
> Versión de borrador: `0.1-draft` · Fecha de redacción: **2026-07-13** ·
> Estado: **no publicada**.

---

## ES · Español

### 1. Quiénes somos

**[RAZÓN SOCIAL / NOMBRE DEL RESPONSABLE DEL TRATAMIENTO]** ("nosotros",
"Pequeñautas") somos responsables del desarrollo de la aplicación educativa
Pequeñautas ("la App"), dirigida a niños de 3 a 5 años, bilingüe
español/inglés.

Contacto para asuntos de privacidad: **[EMAIL DE CONTACTO LEGAL/PRIVACIDAD]**
Dirección postal (si aplica): **[DIRECCIÓN]**
Representante/DPO (si aplica bajo RGPD): **[NOMBRE Y CONTACTO DEL DPO O "no
aplica"]**

### 2. A quién está dirigida esta política

Pequeñautas está diseñada para que la use un **niño de 3 a 5 años bajo la
supervisión de un padre, madre o tutor legal (el "Adulto responsable")**. La
App **no permite que el niño cree una cuenta, inicie sesión ni introduzca
datos de contacto**. Esta política está dirigida al Adulto responsable, no al
niño.

### 3. Qué información recolectamos

Pequeñautas es **offline-first**: toda la información se guarda **únicamente
en el dispositivo** donde se usa la App (mediante `localStorage` del
navegador), salvo que el Adulto responsable active expresamente una
sincronización opcional (ver §7 — hoy esta función está **desactivada por
diseño** y no se recolecta nada fuera del dispositivo).

La información que se guarda localmente es:

- **Perfil del niño**: un nombre o alias (el que el Adulto responsable elija
  escribir — recomendamos usar un apodo, no el nombre completo), un avatar
  (elegido de una lista fija de emojis) y estrellas/nivel de progreso.
- **Datos de aprendizaje**: por cada ronda de juego, se registra la materia,
  el ítem practicado, si acertó al primer intento, el número de intentos, la
  duración en milisegundos y si recibió ayuda. **Este dato no identifica al
  niño por sí solo** y solo se usa para mostrar el panel de progreso al
  Adulto responsable.
- **Preferencias**: idioma, si el sonido/animaciones están activados, límite
  de sesión, y ajustes similares.

**No recolectamos**: apellidos, fecha de nacimiento exacta, dirección de
correo electrónico o postal, número de teléfono, fotografías o videos, voz
grabada, geolocalización, ni identificadores publicitarios.

### 4. Cómo usamos la información

Únicamente para:
- Mostrar el progreso del niño al Adulto responsable (panel de progreso y
  panel educador).
- Adaptar la dificultad del juego al nivel del niño.
- Recordar sus preferencias (idioma, sonido, etc.) entre sesiones.

**No usamos la información para publicidad, no la vendemos, no la
compartimos con terceros con fines comerciales, y no construimos perfiles
publicitarios.**

### 5. Dónde vive la información

Toda la información vive en el dispositivo del Adulto responsable
(`localStorage` del navegador). **No la enviamos a nuestros servidores**
salvo que el Adulto responsable active expresamente una función de
sincronización opcional, hoy desactivada (ver §7).

### 6. Terceros y fuentes tipográficas

Al cargar la App desde internet (no cuando se usa como archivo local o app
instalada sin conexión), el navegador solicita la tipografía "Fredoka" a los
servidores de Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`).
Esta solicitud transmite la dirección IP del dispositivo a Google, conforme
a la [política de privacidad de Google Fonts](https://policies.google.com/privacy).
**[PENDIENTE DE DECISIÓN DE PRODUCTO: si se auto-hospeda la tipografía antes
de publicar esta política, este párrafo debe eliminarse.]**

Cuando la App lee texto en voz alta, usa la función de síntesis de voz de tu
propio navegador o sistema operativo (Web Speech API). En algunos
navegadores/sistemas, ciertas voces se procesan en un servidor del
fabricante del navegador/SO (no de Pequeñautas); el texto enviado es siempre
contenido fijo de la App (preguntas, frases del juego), **nunca información
personal introducida por el niño**.

No usamos ningún servicio de analítica, publicidad ni rastreo de terceros
(no hay Google Analytics, píxeles de redes sociales, ni SDKs similares en la
App).

### 7. Sincronización opcional (actualmente desactivada)

Estamos diseñando una función opcional que permitiría al Adulto responsable
respaldar el progreso en la nube y verlo desde varios dispositivos. **Hoy
esta función está completamente desactivada** y no recolecta ni transmite
ningún dato. Si en el futuro se activa:

- Solo se activará tras el **consentimiento explícito** del Adulto
  responsable, verificado mediante un mecanismo dedicado ("acceso solo para
  adultos").
- Se sincronizará un **alias/seudónimo elegido por el Adulto responsable**,
  nunca el nombre real tal cual se haya escrito localmente.
- Los datos se protegerán mediante controles de acceso que garantizan que
  solo el Adulto responsable que los creó puede leerlos.
- Se conservarán por un plazo limitado (actualmente diseñado en 365 días) y
  se eliminarán automáticamente después.
- El Adulto responsable podrá solicitar la exportación o el borrado total de
  los datos en cualquier momento.

**[PENDIENTE: esta sección debe actualizarse con detalle real —incluyendo
base legal, plazos exactos, y procedimiento de contacto— antes de activar la
función, y debe volver a pasar por revisión legal en ese momento; ver
`29-auditoria-legal.md` §7.]**

### 8. Derechos del Adulto responsable

Como toda la información vive en el dispositivo, el Adulto responsable ya
tiene control directo y total sobre ella:

- **Acceder**: el panel de progreso y el panel educador (dentro del área
  protegida para adultos) muestran toda la información guardada del niño.
- **Exportar**: el panel educador permite exportar los datos de progreso a
  un archivo CSV.
- **Corregir**: el nombre/avatar del perfil pueden editarse creando un nuevo
  perfil o (si se implementa) editando el existente.
- **Eliminar**: puede eliminarse un perfil, o el conjunto de datos completo,
  borrando los datos del sitio/app desde la configuración del navegador o
  del sistema operativo del dispositivo.

**[PENDIENTE: si se implementa un botón de "borrar todos mis datos" dentro
de la propia App, describirlo aquí con el paso a paso exacto.]**

### 9. Seguridad

Tomamos medidas razonables para proteger la información: el texto ingresado
por el usuario se sanea antes de mostrarse en pantalla (protección contra
scripts maliciosos) y los archivos exportados en CSV incluyen una protección
contra fórmulas maliciosas al abrirlos en hojas de cálculo. Como los datos no
salen del dispositivo (mientras la sincronización esté desactivada), el
principal control de seguridad es el que tú, como Adulto responsable, ya
aplicas al dispositivo (bloqueo de pantalla, cuenta de usuario, etc.).

### 10. Cambios a esta política

**[PENDIENTE: describir el proceso de notificación de cambios materiales —
por ejemplo, aviso dentro de la App con fecha de vigencia y versión— antes
de publicar.]**

### 11. Contacto

Para preguntas, solicitudes de acceso/borrado, o cualquier asunto relativo a
esta política: **[EMAIL DE CONTACTO]**.

### 12. Jurisdicción y normativa aplicable

**[PENDIENTE DE DECISIÓN LEGAL: esta política se ha redactado teniendo en
cuenta la Children's Online Privacy Protection Act (COPPA, EE. UU.) y el
artículo 8 del Reglamento General de Protección de Datos (RGPD/GDPR-K, UE).
Debe completarse con la normativa local específica de cada jurisdicción de
distribución real de la App antes de publicarse.]**

---

## EN · English

### 1. Who we are

**[LEGAL NAME / DATA CONTROLLER NAME]** ("we", "Pequeñautas") is responsible
for developing the Pequeñautas educational app ("the App"), designed for
children ages 3 to 5, bilingual Spanish/English.

Privacy contact: **[PRIVACY/LEGAL CONTACT EMAIL]**
Postal address (if applicable): **[ADDRESS]**
Representative/DPO (if applicable under GDPR): **[DPO NAME AND CONTACT, or
"not applicable"]**

### 2. Who this policy is for

Pequeñautas is designed to be used by a **child aged 3 to 5 under the
supervision of a parent or legal guardian (the "Responsible Adult")**. The
App **does not allow the child to create an account, sign in, or enter
contact information**. This policy is addressed to the Responsible Adult,
not the child.

### 3. What information we collect

Pequeñautas is **offline-first**: all information is stored **only on the
device** where the App is used (via the browser's `localStorage`), unless
the Responsible Adult explicitly enables an optional sync feature (see §7 —
this feature is **disabled by design today**, and nothing is collected off
the device).

Information stored locally includes:

- **Child profile**: a name or nickname (whatever the Responsible Adult
  chooses to type — we recommend a nickname, not the full legal name), an
  avatar (chosen from a fixed list of emoji), and stars/progress level.
- **Learning data**: for each game round, we record the subject, the item
  practiced, whether it was answered correctly on the first try, number of
  attempts, duration in milliseconds, and whether a hint was used. **This
  data does not identify the child on its own** and is only used to show the
  progress panel to the Responsible Adult.
- **Preferences**: language, whether sound/animations are enabled, session
  limit, and similar settings.

**We do not collect**: last name, exact date of birth, email or postal
address, phone number, photos or videos, recorded voice, geolocation, or
advertising identifiers.

### 4. How we use information

Only to:
- Show the child's progress to the Responsible Adult (progress panel and
  educator panel).
- Adapt game difficulty to the child's level.
- Remember preferences (language, sound, etc.) between sessions.

**We do not use information for advertising, we do not sell it, we do not
share it with third parties for commercial purposes, and we do not build
advertising profiles.**

### 5. Where information lives

All information lives on the Responsible Adult's device
(browser `localStorage`). **We do not send it to our servers** unless the
Responsible Adult explicitly enables an optional sync feature, currently
disabled (see §7).

### 6. Third parties and web fonts

When the App is loaded from the internet (not when used as a local file or
an installed offline app), the browser requests the "Fredoka" typeface from
Google Fonts servers (`fonts.googleapis.com`, `fonts.gstatic.com`). This
request transmits the device's IP address to Google, per
[Google Fonts' privacy policy](https://policies.google.com/privacy).
**[PENDING PRODUCT DECISION: if the font is self-hosted before this policy
is published, remove this paragraph.]**

When the App reads text aloud, it uses your own browser's or operating
system's speech-synthesis feature (Web Speech API). On some browsers/OSes,
certain voices are processed on a server operated by the browser/OS vendor
(not Pequeñautas); the text sent is always fixed App content (game
prompts/phrases), **never personal information entered by the child**.

We do not use any third-party analytics, advertising, or tracking service
(no Google Analytics, social media pixels, or similar SDKs are present in
the App).

### 7. Optional sync (currently disabled)

We are designing an optional feature that would let the Responsible Adult
back up progress to the cloud and view it across devices. **This feature is
fully disabled today** and collects or transmits nothing. If enabled in the
future:

- It will only be enabled after the Responsible Adult's **explicit
  consent**, verified through a dedicated mechanism ("adults-only access").
- We will sync an **alias/nickname chosen by the Responsible Adult**, never
  the real name as typed locally.
- Data will be protected with access controls ensuring only the Responsible
  Adult who created it can read it.
- Data will be retained for a limited period (currently designed as 365
  days) and automatically deleted afterward.
- The Responsible Adult may request export or full deletion of the data at
  any time.

**[PENDING: this section must be updated with real detail — including legal
basis, exact timeframes, and contact procedure — before the feature is
enabled, and must go through legal review again at that time; see
`29-auditoria-legal.md` §7.]**

### 8. Responsible Adult's rights

Since all information lives on the device, the Responsible Adult already has
direct, full control over it:

- **Access**: the progress panel and educator panel (inside the
  adults-only area) show all stored information about the child.
- **Export**: the educator panel allows exporting progress data to a CSV
  file.
- **Correct**: the profile name/avatar can be corrected by creating a new
  profile or (if implemented) editing the existing one.
- **Delete**: a profile, or the entire dataset, can be deleted by clearing
  the site/app data from the device's browser or OS settings.

**[PENDING: if an in-app "delete all my data" button is implemented,
describe the exact steps here.]**

### 9. Security

We take reasonable measures to protect information: user-entered text is
sanitized before being displayed (protection against malicious scripts),
and CSV exports include protection against malicious spreadsheet formulas
when opened in spreadsheet software. Since data does not leave the device
(while sync remains disabled), the primary security control is the one you,
as the Responsible Adult, already apply to the device itself (screen lock,
user account, etc.).

### 10. Changes to this policy

**[PENDING: describe the process for notifying material changes — e.g.,
an in-app notice with effective date and version — before publishing.]**

### 11. Contact

For questions, access/deletion requests, or anything related to this
policy: **[CONTACT EMAIL]**.

### 12. Jurisdiction and applicable law

**[PENDING LEGAL DECISION: this policy has been drafted with the Children's
Online Privacy Protection Act (COPPA, US) and Article 8 of the General Data
Protection Regulation (GDPR/GDPR-K, EU) in mind. It must be completed with
the specific local regulations of each actual distribution jurisdiction of
the App before publication.]**
