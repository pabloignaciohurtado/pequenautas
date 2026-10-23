# Publicar en Google Play

La app se publica como **Trusted Web Activity (TWA)**: un APK/AAB mínimo que abre
`https://pequenautas-rfj5.vercel.app/` en Chrome a pantalla completa, sin barra
de direcciones. Cada despliegue de `main` en Vercel actualiza la app instalada sin
pasar por la tienda; solo hace falta subir una versión nueva a Play cuando cambia
algo del envoltorio (ícono, nombre, orientación, paquete, versión de Android).

## Lo que ya está en el repo

| Pieza | Dónde | Notas |
|---|---|---|
| ID de paquete | `com.pequenautas.bosque` | Permanente: no se puede cambiar después de publicar. |
| Configuración TWA | `tools/twa/twa-manifest.json` | Bubblewrap 1.27, target API 36, minSdk 24, horizontal fija, sin notificaciones ni atajo a ajustes de Chrome. |
| Arte de Grok | `assets/brand/` | Ícono de Rufo y gráfico destacado. Los trae `tools/twa/fetch_art.py` desde `tools/twa/arte-grok.json` verificando su sha256. |
| Íconos | `icons/` (192/512, any + maskable) | Generados por `tools/twa/make_icons.py` a partir del ícono de Grok. |
| Gráfico destacado | `store/feature-graphic.png` (1024×500) | Para la ficha de Play; lo genera `make_icons.py`. |
| Capturas de tienda | `screenshots/` (1920×1080) | Generadas por `tools/twa/screenshots.js`. |
| Fuentes | `fonts/` | Servidas desde el dominio: la app no llama a ningún tercero. |
| Verificación de dominio | `.well-known/assetlinks.json` | Hoy lleva la huella de la **clave de subida**. Falta la de la **clave de firma de Play** (paso 4). |
| Política de privacidad | `privacy.html` | ES/EN, enlazada desde Ajustes (área de adultos). URL para la ficha: `https://pequenautas-rfj5.vercel.app/privacy.html` |
| Regeneración | `.github/workflows/twa-assets.yml` | Al cambiar `tools/twa/**` o `tools/fonts/**` en una rama `feat/**`, vuelve a fabricar fuentes, arte, íconos y capturas. |

La **clave de subida** (`upload-key.jks` + contraseña) **no** está en el repo. La
tiene Ignacio. Si se pierde, Play permite pedir un reinicio de la clave de subida
desde la consola (la clave de firma la custodia Google).

## Compilar el AAB

```bash
npm i -g @bubblewrap/cli@1.27.0          # requiere JDK 17 y Android SDK (platform 36, build-tools 36)
mkdir build && cp tools/twa/twa-manifest.json build/ && cp /ruta/segura/upload-key.jks build/
cd build
export BUBBLEWRAP_KEYSTORE_PASSWORD=... BUBBLEWRAP_KEY_PASSWORD=...
bubblewrap update --skipVersionUpgrade   # genera el proyecto Android a partir del manifiesto
bubblewrap build --skipPwaValidation     # app-release-bundle.aab (Play) y app-release-signed.apk (instalar a mano)
```

Para cada versión nueva en Play: subir `appVersionCode` (y `appVersion`) en
`tools/twa/twa-manifest.json`.

## Cambiar el arte (ícono o gráfico destacado)

Todo el arte lo dibuja Grok (regla del proyecto). Para cambiarlo:

1. Generar la imagen nueva con Grok y elegir la toma.
2. En `tools/twa/arte-grok.json`, reemplazar `url` y `sha256` de la pieza
   (`sha256sum` del PNG original que entrega Grok) y borrar el `.webp`
   correspondiente de `assets/brand/` en la misma rama.
3. Al hacer push en una rama `feat/**`, el flujo `twa-assets.yml` descarga el
   original, verifica la huella, lo guarda en `assets/brand/` y regenera
   `icons/` y `store/feature-graphic.png`. Las URLs de Grok caducan en
   unas horas: este paso hay que hacerlo el mismo día en que se genera.
4. Recompilar el AAB (sección anterior) y subir una versión nueva si cambió el
   ícono del lanzador.

`make_icons.py` deja el ícono a sangre aunque Grok lo entregue como cuadrado
redondeado sobre blanco (lo hace casi siempre): rellena las esquinas y lo
recompone sobre un fondo liso para que el ícono adaptable no muestre un
cuadrado fantasma.

## Pasos en Play Console (los hace Ignacio)

1. **Cuenta de desarrollador** en play.google.com/console (pago único de 25 USD,
   verificación de identidad). Las cuentas personales nuevas deben hacer una
   **prueba cerrada con al menos 12 testers durante 14 días seguidos** antes de
   poder publicar en producción.
2. **Crear la app**: nombre "Aventuras en el Bosque", idioma por defecto español,
   tipo App, gratis.
3. **Subir el AAB** a la pista de prueba cerrada y aceptar **Play App Signing**.
4. En *Configuración → Integridad de la app → Firma de apps*, copiar la **huella
   SHA-256 del certificado de firma de apps** y agregarla a
   `.well-known/assetlinks.json` junto a la actual. Sin esto, la app descargada
   desde Play muestra la barra de direcciones de Chrome.
5. **Público objetivo y contenido**: rango de edad **"5 años o menos"** (y, si se
   quiere, 6–8). Eso activa la **Política para Familias**; la app la cumple porque
   no tiene anuncios, ni SDK de terceros, ni analítica, ni ubicación, ni ID de
   publicidad, y no pide permisos.
6. **Seguridad de los datos**: "La app no recopila ni comparte datos de usuario".
   El progreso vive solo en el dispositivo y no se transmite. Los registros
   técnicos que recibe el hosting al servir la web no se usan para identificar
   ni se asocian a nadie; si Play lo pregunta, declararlos como datos procesados
   de forma efímera, no recopilados.
7. **Anuncios**: No contiene anuncios.
8. **Clasificación de contenido** (cuestionario IARC): educativa, sin violencia,
   sin interacción entre usuarios, sin compras.
9. **Ficha de Play Store**: descripción corta y completa, ícono 512×512
   (`icons/icon-512.png`), **gráfico destacado 1024×500**
   (`store/feature-graphic.png`), y las capturas de `screenshots/`.
10. **Política de privacidad**: `https://pequenautas-rfj5.vercel.app/privacy.html`.

## Pendientes

- Revisión legal de `privacy.html` por un abogado con experiencia en privacidad
  infantil antes de pasar a producción.
- Dominio propio (opcional): si se cambia, hay que publicar `assetlinks.json` en
  el nuevo dominio y actualizar `host` en `twa-manifest.json`.
