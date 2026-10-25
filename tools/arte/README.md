# tools/arte

`cortar_grid.py` recorta una hoja de Grok (N sujetos en rejilla sobre fondo
magenta) en piezas WebP embebidas como data-URI en CSS (`:root{--<prefijo>-<id>:url(...)}`).

- Agrupa por componentes conexas de toda la hoja (no por celda fija: los
  sujetos de Grok se salen de su celda) y ordena fila a fila.
- `ESTRICTO=1` usa un recorte de magenta más estricto (necesario cuando hay
  rosados en los dibujos: flor de cerezo, cerdo, mejillas).
- Con el argumento final `pares`, cada par (madre, cría) se rellena al mismo
  lienzo para conservar el tamaño relativo.

Uso: `python3 cortar_grid.py HOJA.png FILAS COLS id1,id2,... PREFIJO SALIDA LADO MAXBYTES [pares]`

Las hojas de #64 (arte de contenido) y sus sha256 están en el workflow que
las generó (historial de git) y en `claude/auditoria-coherencia-juegos-oct2026.md`
del proyecto.
