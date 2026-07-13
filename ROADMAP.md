# Roadmap — Pequeñautas

## ✅ Entregado (en `main`)
- Investigación basada en evidencia · Prototipo v0.1 (bilingüe, audio) · Repo + CI (proceso rama→PR→CI verde→merge).
- **Sprint 1:** perfiles + persistencia · analítica + panel · pistas progresivas.
- **Sprint 2:** matemáticas ampliadas (subitización + comparar) · ciencias por dieta · límite de sesión (AAP) · onboarding sin texto · PWA offline.
- **Sprint 3:** infra de voces (AudioBank + fallback TTS) · estrategia bilingüe (inmersión/alternado/espejo) · panel educador local (+ diseño backend Supabase OFF) · modo guiado padre-hijo · benchmark UX · hardening de seguridad (XSS/CSV).

## ⏳ Diferido (con motivo)
- **Gestos de trazar/arrastrar** — el agente no entregó `jsCode`/anclaje integrable; se reabre en el próximo ciclo con implementación completa.

## 🌅 Horizonte — 30 mejoras (Fase 4+)

### Aprendizaje y evidencia
1. Evaluación pre/post por materia (ganancia real). 2. A/B testing de mecánicas. 3. Repaso espaciado (curva de olvido). 4. Índice de dominio + curva de aprendizaje por niño. 5. Detección automática de frustración con alerta al adulto.

### Personalización / motor adaptativo
6. Motor de dificultad adaptativa. 7. Secuenciación inteligente (priorizar "a reforzar"). 8. ZDP dinámica. 9. Recomendador de "qué jugar hoy".

### Contenido y currículo
10. Alinear a estándares preescolares. 11. Materias nuevas (socioemocional, formas/colores, rutinas). 12. Mates: sumas/restas, patrones, medición. 13. Lectura: sílabas, palabras, comprensión de mini-cuentos. 14. Ciencias: cuerpo, clima/estaciones, reciclaje. 15. CMS/JSON de contenido para escalar sin tocar código.

### Experiencia, UX y accesibilidad
16. Voces humanas ES/EN + mascota-guía. 17. Accesibilidad (lectores de pantalla, contraste, daltonismo, switch-access). 18. Modo dislexia-friendly. 19. Álbum de logros saludable. 20. Animaciones de personaje variadas.

### Familia, educador y engagement saludable
21. Reporte semanal a padres por correo. 22. Metas semanales suaves. 23. Modo aula (docente + asignaciones). 24. Biblioteca ampliada de tarjetas de co-juego.

### Backend, datos y plataforma
25. Backend Supabase (cuentas, sync, respaldo). 26. Panel educador en la nube con cohortes. 27. Pipeline de analítica agregada anonimizada. 28. PWA → tiendas (TWA Android + wrapper iOS).

### Seguridad, cumplimiento y negocio
29. Auditoría formal COPPA/GDPR-K + política de privacidad. 30. Controles parentales reales (tiempo diario, materias, PIN) + i18n a más idiomas.

> Candados del mundo real (no removibles por permisos): #16 requiere locución humana, #28 cuentas/certificados de tienda + revisión, #29 firma legal de un abogado. Para esas se entrega scaffolding + docs listos para activar.
