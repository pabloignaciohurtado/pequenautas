# Estrategia bilingüe deliberada · Pequeñautas

Pequeñautas es bilingüe ES/EN por diseño. Pero "bilingüe" no significa "las dos
lenguas mezcladas todo el rato": para niños de 3 a 5 años eso **aumenta la carga
cognitiva** y diluye el aprendizaje. Esta función añade un **Modo de idioma por
perfil** (Ajustes → *Modo de idioma*) con tres estrategias basadas en evidencia,
para que cada familia elija cómo se combinan el español y el inglés.

## Los tres modos

| Modo | Qué hace | Para qué sirve |
|------|----------|----------------|
| **Inmersión** (por defecto) | Una sola lengua por sesión. La app **no** conmuta de idioma sola. | Sumersión en un solo código. Máxima claridad, mínima carga. Ideal para empezar o para reforzar la lengua más débil. |
| **Alternado** | Alterna ES/EN **por ronda** (ronda 0 en la lengua base, ronda 1 en la otra, etc.). Nunca dos lenguas dentro de una misma ronda. | Transferencia translingüística: el mismo concepto (contar, letras, hábitats) se reencuentra en las dos lenguas, pero **de una en una**. |
| **Espejo** | Al **acertar**, refleja la palabra-clave del concepto en ambas lenguas (ES→EN): *"cinco… five"*, *"agua… water"*. | Etiquetado bilingüe anclado al momento de éxito, cuando el concepto ya se ha entendido. Emparejamiento de vocabulario con baja carga. |

## Base pedagógica

- **Transferencia translingüística (Cummins).** Lo que un niño aprende en una
  lengua (el concepto de cantidad, de categoría animal) se transfiere a la otra:
  no se aprende dos veces, se re-etiqueta. Los modos *Alternado* y *Espejo*
  explotan esto presentando el **mismo concepto** con dos etiquetas lingüísticas.
- **Translanguaging (García & Wei).** Usar las dos lenguas como un solo
  repertorio comunicativo, no como compartimentos estancos. *Espejo* es
  translanguaging en dosis mínimas: un par de palabras en el instante de premio.
- **Carga cognitiva (Sweller) y evitar sobrecarga.** La evidencia con
  preescolares desaconseja alternar lenguas **dentro** de una misma consigna:
  confunde y reduce la comprensión. Por eso *Alternado* cambia de lengua **entre**
  rondas (nunca dentro), e *Inmersión* no cambia en absoluto.
- **Ventaja bilingüe / control ejecutivo (Bialystok).** La exposición
  estructurada a dos lenguas se asocia a mejor control atencional. La clave es
  que sea *estructurada* y predecible, no caótica.
- **Co-juego con un adulto (AAP / NAEYC).** Igual que el resto de la app, estos
  modos rinden más si un adulto acompaña y nombra en voz alta.

## Cómo elegir

- **Empieza en Inmersión.** Es lo más simple y lo menos exigente.
- Cuando el niño esté cómodo, prueba **Espejo**: añade la segunda lengua sólo
  como recompensa-etiqueta, sin cambiar la dinámica del juego.
- **Alternado** es el paso más avanzado: exige que el niño reconozca la consigna
  en dos lenguas. Recomendado cuando ya hay soltura en ambas.

## Detalle técnico (para el equipo)

- Se persiste en `profile.langMode` dentro de `DB` (`'immersion' | 'alternate' |
  'mirror'`). Perfiles antiguos sin el campo se tratan como `'immersion'`.
- La lógica es **aditiva**: envuelve `afterCorrect()` (para *Espejo*) y
  `nextRound()` (para *Alternado*) reasignando la propiedad global, el mismo
  mecanismo que usa el AudioBank con `speak`/`speakSeq`. No se redefinen helpers.
- *Alternado* fija la lengua base de la sesión en la ronda 0 (`S.bilBase`),
  alterna por paridad de ronda y **restaura la lengua base al terminar la
  sesión** para no dejar la interfaz en el idioma "equivocado".
- *Espejo* deriva el par bilingüe de la clave de log de la ronda (número, letra,
  hábitat o dieta) y sustituye la narración celebratoria por el par corto ES→EN,
  que cabe antes de la siguiente ronda; el sonido de acierto y el confeti se
  conservan.
- Todo el texto visible y hablado es bilingüe. Bajo `file://` no hay accesos de
  red y los smoke tests permanecen verdes (el modo por defecto no altera el flujo
  original).
