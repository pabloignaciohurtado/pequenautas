/* ===== Fase 4 #62 · La voz de la narradora (reproductor) =====

   Rufo ya tenía voz propia (#61), pero solo para las dieciocho frases del
   guion del AudioBank. Todo lo demás —el enunciado de cada ronda, la
   pregunta, la pista, el "¡Muy bien!" de después— lo decía el sintetizador
   del sistema, que en Android suena distinto en cada teléfono y en algunos
   ni siquiera tiene voz en español instalada. Este módulo trae esas frases
   grabadas.

   Cómo encuentra el clip
   ----------------------
   El resto de la app no sabe que esto existe: sigue llamando a speak() con
   el texto tal cual. Así que la búsqueda es por TEXTO, normalizado (espacios
   colapsados y recortados) para que el prompt que se pinta con doble espacio
   y el que se pronuncia acaben en la misma entrada. El mapa texto -> clip lo
   genera la herramienta de horneado junto con los CSS; nadie lo escribe a
   mano.

   Dónde encaja en la cadena de voces
   ----------------------------------
   El orden en fase4.js es deliberado: #62 se carga DESPUÉS de #61 y ANTES de
   #16. Queda por fuera de #61, de modo que la primera decisión es nuestra;
   por eso, antes de tocar nada, comprobamos si la frase es una de las de
   Rufo y en ese caso dejamos pasar la llamada intacta para que la ponga él.
   Y queda por dentro de #16, que sigue siendo quien mueve la boca de la
   mascota y quien estampa opts.key.

   Prioridad al hablar:
     1. clip locutado real en audio/<idioma>/<clave>.mp3  (AudioBank)
     2. clip de Rufo, si la frase es de su guion          (#61)
     3. clip de la narradora                              (este módulo)
     4. voz del sistema                                   (lo de siempre)

   Ola 1 cubre el español. En inglés todavía no hay clips y la app se
   comporta exactamente como antes: cae al sintetizador. Eso es a propósito,
   no un olvido; el banco crece por olas y este módulo no necesita cambiar
   para aprovechar las siguientes.

   Aditivo: no toca app.js, ni index.html, ni STORE_KEY. */
(function () {
  "use strict";

  if (window.__pa62) return;
  window.__pa62 = true;

  var MAPA = {
    "es|1": "es-356a192b79",
    "es|2": "es-da4b9237ba",
    "es|3": "es-77de68daec",
    "es|4": "es-1b64538924",
    "es|5": "es-ac3478d69a",
    "es|6": "es-c1dfd96eea",
    "es|7": "es-902ba3cda1",
    "es|8": "es-fe5dbbcea5",
    "es|A dormir": "es-c6b370d92b",
    "es|Abro el agua": "es-bfb715996e",
    "es|Alegre": "es-0ff010fdfa",
    "es|Alguien tiró su torre de bloques.": "es-02aa94177f",
    "es|Asustado": "es-e392782525",
    "es|Basura": "es-7821f06111",
    "es|Baño": "es-5f19dd1a3b",
    "es|Bebo agua": "es-c7b4234da6",
    "es|CASA": "es-f1498e8fb6",
    "es|Como con la cuchara": "es-4f5a9645a4",
    "es|Cuenta cada grupo, toca el que tiene más.": "es-6777793dbf",
    "es|Cuenta los que quedan.": "es-0014917235",
    "es|Cuenta todos, uno por uno.": "es-ca8525cfee",
    "es|Cuéntalos otra vez, toca cada uno.": "es-ab42e828af",
    "es|Derecha": "es-13b8c9dde5",
    "es|El baño": "es-843e0df653",
    "es|El conejo come plantas.": "es-ce39668247",
    "es|El conejo vive en la tierra.": "es-877d2c2d28",
    "es|El cuento al estante": "es-6cb105db57",
    "es|El delfín come carne.": "es-800ad9a212",
    "es|El delfín vive en el agua.": "es-4331f9dc39",
    "es|El elefante come plantas.": "es-1d221aab15",
    "es|El elefante vive en la tierra.": "es-297f4a4929",
    "es|El león come carne.": "es-69d319b84a",
    "es|El león vive en la tierra.": "es-f4168ecd05",
    "es|El perro come carne.": "es-e3508635f9",
    "es|El perro vive en la tierra.": "es-20f962f1b0",
    "es|El pez come carne.": "es-a1bbd41a4f",
    "es|El pez vive en el agua.": "es-78c62ae299",
    "es|El pulpo come carne.": "es-d5c46dceee",
    "es|El pulpo vive en el agua.": "es-e6789db10b",
    "es|El pájaro come plantas.": "es-25f0f81abd",
    "es|El pájaro vive en el cielo.": "es-ebef06bade",
    "es|El águila come carne.": "es-81900e2e3d",
    "es|El águila vive en el cielo.": "es-2b0298c3e4",
    "es|Enojado": "es-630a944539",
    "es|Es su cumpleaños y le cantan.": "es-b9fbf290d7",
    "es|Escucha otra vez y busca esa parte del cuerpo.": "es-5dcfe78721",
    "es|Escucha y repite": "es-6563b1504b",
    "es|Escucha: aaa. ¿Cuál empieza así?": "es-e81f29fa02",
    "es|Escucha: ca. ¿Cuál empieza así?": "es-49e0de18aa",
    "es|Escucha: eee. ¿Cuál empieza así?": "es-84fa7dba80",
    "es|Escucha: lll. ¿Cuál empieza así?": "es-cdb56d995e",
    "es|Escucha: mmm. ¿Cuál empieza así?": "es-faeee06d89",
    "es|Escucha: ooo. ¿Cuál empieza así?": "es-4ce29d965c",
    "es|Escucha: ppp. ¿Cuál empieza así?": "es-70483857e2",
    "es|Escucha: sss. ¿Cuál empieza así?": "es-c1440f0495",
    "es|Está descansando en la hamaca.": "es-4d7c915fa3",
    "es|Está regando las plantas del huerto.": "es-0c19101000",
    "es|FLOR": "es-ed989c3ba5",
    "es|Fíjate bien: ¿hace calor, frío, llueve o caen las hojas?": "es-91f1ac4825",
    "es|GATO": "es-3b261d3ec3",
    "es|Guarda cada figura en su canasta": "es-f324c17ba6",
    "es|Hay cinco.": "es-fef0122300",
    "es|Hay cinco. Quitamos cuatro. ¿Cuántos quedan?": "es-4b41c6d161",
    "es|Hay cinco. Quitamos dos. ¿Cuántos quedan?": "es-6a1e4d91ee",
    "es|Hay cinco. Quitamos tres. ¿Cuántos quedan?": "es-481607b4ff",
    "es|Hay cinco. Quitamos uno. ¿Cuántos quedan?": "es-4bfb57daa3",
    "es|Hay cuatro.": "es-35dc494771",
    "es|Hay cuatro. Quitamos dos. ¿Cuántos quedan?": "es-d17fcbbc56",
    "es|Hay cuatro. Quitamos tres. ¿Cuántos quedan?": "es-331a746113",
    "es|Hay cuatro. Quitamos uno. ¿Cuántos quedan?": "es-45f73bba3d",
    "es|Hay dos.": "es-f62f7d5def",
    "es|Hay seis. Quitamos cinco. ¿Cuántos quedan?": "es-3361fe56a6",
    "es|Hay seis. Quitamos cuatro. ¿Cuántos quedan?": "es-84d4e4c3b4",
    "es|Hay seis. Quitamos dos. ¿Cuántos quedan?": "es-398328f281",
    "es|Hay seis. Quitamos tres. ¿Cuántos quedan?": "es-e4df3afb19",
    "es|Hay seis. Quitamos uno. ¿Cuántos quedan?": "es-723f7834fd",
    "es|Hay tres.": "es-2aa1219bca",
    "es|Hay tres. Quitamos dos. ¿Cuántos quedan?": "es-76362377bd",
    "es|Hay tres. Quitamos uno. ¿Cuántos quedan?": "es-c1bfea71b1",
    "es|Hay una tormenta muy fuerte.": "es-516d166461",
    "es|Izquierda": "es-666ac60aa3",
    "es|Juguetes": "es-9d12e21e92",
    "es|LUNA": "es-c0c7582331",
    "es|La abeja come plantas.": "es-b1b362b6bc",
    "es|La abeja vive en el cielo.": "es-913127484b",
    "es|La ballena come carne.": "es-7fb9ba168e",
    "es|La ballena vive en el agua.": "es-87bff7554c",
    "es|La letra A": "es-b97166ad75",
    "es|La letra C": "es-9031f05b0c",
    "es|La letra E": "es-66cccf9597",
    "es|La letra L": "es-928d29887d",
    "es|La letra M": "es-ac233d7caa",
    "es|La letra O": "es-99e00921b7",
    "es|La letra P": "es-302411d37b",
    "es|La letra S": "es-2426618afa",
    "es|La mariposa come plantas.": "es-76190c2029",
    "es|La mariposa vive en el cielo.": "es-699f7ef9c7",
    "es|La mochila": "es-1b1d9cd8a1",
    "es|La sílaba CA": "es-716f532602",
    "es|La sílaba GA": "es-382ff3fc94",
    "es|La sílaba LU": "es-066bbbf22c",
    "es|La sílaba MA": "es-1c611a0a09",
    "es|La sílaba PA": "es-f7561f279b",
    "es|La sílaba PE": "es-6a8ccda1e5",
    "es|La sílaba PI": "es-657c7c3fdb",
    "es|La sílaba SO": "es-44c4bbdff7",
    "es|Le están leyendo un cuento en la cama.": "es-25acd590b5",
    "es|Le llegó un regalo que no esperaba.": "es-d494e6589a",
    "es|Le quitaron el juguete de las manos.": "es-dddf63524d",
    "es|Lee despacio, letra por letra.": "es-8485f5a173",
    "es|Llevo mi plato": "es-45540446e1",
    "es|Los calcetines": "es-ec9683d8f6",
    "es|Los guardo en el baúl": "es-6f23ef6315",
    "es|Los zapatos": "es-c4ae586b86",
    "es|Mañana": "es-153d441017",
    "es|Me cepillo": "es-ea09f1b73a",
    "es|Me enjabono": "es-f5e8e487b7",
    "es|Me enjuago": "es-b26dc30f5e",
    "es|Me lavo las manos": "es-5097562079",
    "es|Me pongo el pijama": "es-62102a7068",
    "es|Me seco": "es-5b535a4e7d",
    "es|Me visto": "es-93e338637b",
    "es|Metió un gol con su equipo.": "es-3bc931269d",
    "es|Mira bien el color.": "es-e9e60855ba",
    "es|Mira bien los lados: ¿es redondo o tiene puntas?": "es-137ed30188",
    "es|Mira el patrón otra vez.": "es-2728263496",
    "es|Mira el patrón. ¿Qué sigue?": "es-b90b4ba0bd",
    "es|Mira la escena, ¿cómo se siente?": "es-4b0aa13ea5",
    "es|Mira otra vez, cuenta despacio.": "es-a6b7edee13",
    "es|Nadie le dejó sitio en la mesa.": "es-ec99c83b1a",
    "es|Noche": "es-a1b16ea2c3",
    "es|OSO": "es-156e9349d0",
    "es|Ordena: Guardar los juguetes": "es-f5f9871ce6",
    "es|Ordena: Ir a dormir": "es-30734cce9d",
    "es|Ordena: La hora de comer": "es-537a986453",
    "es|Ordena: Lavarse las manos": "es-e000a05853",
    "es|Ordena: Los dientes": "es-f8499ecce3",
    "es|Ordena: Salir de casa": "es-b95bc0211c",
    "es|PERRO": "es-278f7e6901",
    "es|PEZ": "es-82c8dd5245",
    "es|Para beber agua": "es-adc561fd56",
    "es|Para beber agua…": "es-77cd08f7db",
    "es|Para comer la sopa": "es-8eaab55c47",
    "es|Para comer la sopa…": "es-dc0ce80eea",
    "es|Para dormir": "es-5afd171b84",
    "es|Para dormir…": "es-fce8475f02",
    "es|Para lavarme las manos": "es-93d1ca1ff2",
    "es|Para lavarme las manos…": "es-f6e8d710c4",
    "es|Para lavarme los dientes": "es-9cd00aca76",
    "es|Para lavarme los dientes…": "es-2fca5e0387",
    "es|Para leer un cuento": "es-00db2a632f",
    "es|Para leer un cuento…": "es-55d02a2234",
    "es|Para llevar mis cosas": "es-d15610417d",
    "es|Para llevar mis cosas…": "es-4aa5965b7c",
    "es|Para peinarme": "es-3de717b33c",
    "es|Para peinarme…": "es-130ecd7dff",
    "es|Para salir a la calle": "es-53d5748ad1",
    "es|Para salir a la calle…": "es-071e4f77e5",
    "es|Para secarme las manos": "es-3fc8fc62e0",
    "es|Para secarme las manos…": "es-27e8e2b439",
    "es|Perdió el juego después de esforzarse.": "es-c5e4cea118",
    "es|Piensa: ¿es comida, papel o plástico?": "es-5ad7b12a52",
    "es|Piensa: ¿mañana, tarde o noche?": "es-71ee1de804",
    "es|Pon cada pieza en su sitio": "es-ed46de4b99",
    "es|Pongo la pasta": "es-4145daab89",
    "es|Recojo los juguetes": "es-cab259a711",
    "es|Ropa": "es-03cd5169e1",
    "es|SOL": "es-8afba26674",
    "es|Salió el arcoíris después de la lluvia.": "es-4d68293856",
    "es|Se apagó la luz y está todo oscuro.": "es-e7db5af143",
    "es|Se cayó de la bicicleta y le duele.": "es-d7d2559646",
    "es|Se le cayó el helado al suelo.": "es-6328e59b51",
    "es|Se le rompió su peluche favorito.": "es-d63c201972",
    "es|Sorprendido": "es-b77e2d49df",
    "es|Su amiga volvió de un viaje largo.": "es-5b350ce313",
    "es|Tarde": "es-54238f4cb5",
    "es|Toca del más grave al más agudo": "es-b18a2242ab",
    "es|Toca el más corto.": "es-9e7d82e095",
    "es|Toca el más largo.": "es-f6ef51eb6c",
    "es|Toca el que brilla.": "es-4c9220a71f",
    "es|Toca las huellas en orden, de la 1 a la 4": "es-2c3d55ba7f",
    "es|Toca las huellas en orden, de la 1 a la 5": "es-90785b0834",
    "es|Toca las huellas en orden, de la 1 a la 6": "es-1f5b93dac0",
    "es|Toca las huellas en orden, de la 1 a la 7": "es-7d6dd38a0a",
    "es|Toca las huellas en orden, de la 1 a la 8": "es-1d75ad775f",
    "es|Toca: el brazo": "es-94a8821e83",
    "es|Toca: el ojo": "es-2f2e8d90ea",
    "es|Toca: el pie": "es-0b098c28aa",
    "es|Toca: la boca": "es-15e3c8980d",
    "es|Toca: la mano": "es-7e83fb5617",
    "es|Toca: la nariz": "es-e76e32bfed",
    "es|Toca: la oreja": "es-b7d643b59e",
    "es|Toca: la pierna": "es-ca465afb14",
    "es|Tranquilo": "es-f4219f8b0a",
    "es|Triste": "es-d7d0c67216",
    "es|Un cuento": "es-c5a2c970de",
    "es|Un pato entró en el aula.": "es-d455e6f633",
    "es|Un perro muy grande le ladró.": "es-097c85b0cf",
    "es|Una mariposa se posó en su nariz.": "es-954d8c373c",
    "es|Une cada cosa con su sombra": "es-ad4dc8699a",
    "es|Une cada forma con su sombra": "es-fe4fae8e3a",
    "es|aaa... Árbol": "es-655d3175b0",
    "es|amarillo": "es-56815506e7",
    "es|azul": "es-1768d39c5b",
    "es|bellota": "es-1148af435d",
    "es|ca... Casa": "es-0f89116807",
    "es|cinco": "es-a097b33b77",
    "es|corazón": "es-dcbe4dd31e",
    "es|cuadrado": "es-80e7adc16a",
    "es|cuatro": "es-a37e3bea6f",
    "es|círculo": "es-b54490df29",
    "es|dos": "es-e67f16d28a",
    "es|eee... Elefante": "es-2d55f58c37",
    "es|estrella": "es-e0cab40783",
    "es|flor": "es-4cb270f3d7",
    "es|hoja": "es-d4235bc03b",
    "es|hongo": "es-dfa42ff70d",
    "es|lll... Luna": "es-b22b0dfbf5",
    "es|mariposa": "es-476999d007",
    "es|mmm... Manzana": "es-d5827c07c6",
    "es|ocho": "es-311047fbb0",
    "es|ooo... Oso": "es-dfd86a95a2",
    "es|ppp... Perro": "es-f040bb28b9",
    "es|rectángulo": "es-4a6fb5ddd1",
    "es|rojo": "es-af6c1a0ca2",
    "es|seis": "es-ba15793485",
    "es|siete": "es-c0bdfc8b52",
    "es|sss... Sol": "es-1200b5f70e",
    "es|tres": "es-0c95987338",
    "es|triángulo": "es-560148aebe",
    "es|uno": "es-81b6f50734",
    "es|verde": "es-2030abee0f",
    "es|¡Excelente!": "es-95e252d8f4",
    "es|¡Muy bien!": "es-2c0ab017ea",
    "es|¡Qué amable!": "es-f115c0a9c2",
    "es|¡Sí! Casa empieza con C.": "es-013a235899",
    "es|¡Sí! Casa empieza con CA.": "es-afb8beb164",
    "es|¡Sí! Elefante empieza con E.": "es-a455c1a112",
    "es|¡Sí! En total son cinco.": "es-c11a3dc83b",
    "es|¡Sí! En total son cuatro.": "es-78f7bc261b",
    "es|¡Sí! En total son dos.": "es-035484d353",
    "es|¡Sí! En total son ocho.": "es-433527b47d",
    "es|¡Sí! En total son seis.": "es-fea32fa277",
    "es|¡Sí! En total son siete.": "es-c5913e2b48",
    "es|¡Sí! En total son tres.": "es-6cf6bfb3d2",
    "es|¡Sí! Es CASA.": "es-68104186d0",
    "es|¡Sí! Es FLOR.": "es-0346c49e3c",
    "es|¡Sí! Es GATO.": "es-a1aa81e07f",
    "es|¡Sí! Es Invierno.": "es-d160180033",
    "es|¡Sí! Es LUNA.": "es-b3de279247",
    "es|¡Sí! Es OSO.": "es-c7fdf3b100",
    "es|¡Sí! Es Otoño.": "es-865999886c",
    "es|¡Sí! Es PERRO.": "es-e74e0e16bb",
    "es|¡Sí! Es PEZ.": "es-4dd85e1401",
    "es|¡Sí! Es Primavera.": "es-6c4bb66236",
    "es|¡Sí! Es SOL.": "es-66648b7df2",
    "es|¡Sí! Es Verano.": "es-f565913d94",
    "es|¡Sí! Es amarillo.": "es-72534c77ab",
    "es|¡Sí! Es azul.": "es-20b397c7eb",
    "es|¡Sí! Es el brazo.": "es-98affa7b86",
    "es|¡Sí! Es el ojo.": "es-a2b879a8b8",
    "es|¡Sí! Es el pie.": "es-cf3e64033b",
    "es|¡Sí! Es en la mañana.": "es-61fd14f80f",
    "es|¡Sí! Es en la noche.": "es-68543cf198",
    "es|¡Sí! Es en la tarde.": "es-f871ae23e0",
    "es|¡Sí! Es la boca.": "es-1eee8f20f9",
    "es|¡Sí! Es la mano.": "es-cebbbb7141",
    "es|¡Sí! Es la nariz.": "es-3d0d4e6e4d",
    "es|¡Sí! Es la oreja.": "es-e7da2bcc5f",
    "es|¡Sí! Es la pierna.": "es-5e2397679a",
    "es|¡Sí! Es morado.": "es-e765343cde",
    "es|¡Sí! Es naranja.": "es-6657595020",
    "es|¡Sí! Es rojo.": "es-077581e86a",
    "es|¡Sí! Es un cuadrado.": "es-595c1a4021",
    "es|¡Sí! Es un círculo.": "es-d065c57ef1",
    "es|¡Sí! Es un estrella.": "es-838b8ead05",
    "es|¡Sí! Es un triángulo.": "es-3f2a3b94f1",
    "es|¡Sí! Es verde.": "es-9b25f4cccd",
    "es|¡Sí! Este es más corto.": "es-d2f1438d37",
    "es|¡Sí! Este es más largo.": "es-5aa7e788e3",
    "es|¡Sí! Este grupo tiene más.": "es-e9bff360e3",
    "es|¡Sí! Gato empieza con GA.": "es-9df8b72790",
    "es|¡Sí! Había cinco.": "es-7659ad6bbf",
    "es|¡Sí! Había cuatro.": "es-8f5ad90aa9",
    "es|¡Sí! Había dos.": "es-a10662e93f",
    "es|¡Sí! Había tres.": "es-e0eb4c0512",
    "es|¡Sí! Hay cinco.": "es-2b7823364e",
    "es|¡Sí! Hay cuatro.": "es-4d6d80f2a2",
    "es|¡Sí! Hay dos.": "es-0c4adcdc79",
    "es|¡Sí! Hay seis.": "es-ef435e863d",
    "es|¡Sí! Hay siete.": "es-6dc3a6650b",
    "es|¡Sí! Hay tres.": "es-ea20f4db3e",
    "es|¡Sí! Hay uno.": "es-7dd7afc644",
    "es|¡Sí! Luna empieza con L.": "es-5a1d473259",
    "es|¡Sí! Luna empieza con LU.": "es-caa1bc769b",
    "es|¡Sí! Mamá empieza con MA.": "es-c9b148ccaa",
    "es|¡Sí! Manzana empieza con M.": "es-f52fa239b2",
    "es|¡Sí! Oso empieza con O.": "es-0dd8c894c7",
    "es|¡Sí! Papá empieza con PA.": "es-489be131ba",
    "es|¡Sí! Perro empieza con P.": "es-f025061142",
    "es|¡Sí! Perro empieza con PE.": "es-4e95dd2e84",
    "es|¡Sí! Piña empieza con PI.": "es-f7617cfb66",
    "es|¡Sí! Quedan cinco.": "es-08d5058d1e",
    "es|¡Sí! Quedan cuatro.": "es-2d95600980",
    "es|¡Sí! Quedan dos.": "es-4e8404aebb",
    "es|¡Sí! Quedan tres.": "es-56ecab569d",
    "es|¡Sí! Quedan uno.": "es-b4dbb0fa77",
    "es|¡Sí! Se siente asustado.": "es-b0828178a7",
    "es|¡Sí! Se siente enojado.": "es-b6ce9c45a6",
    "es|¡Sí! Se siente feliz.": "es-cfffda2c30",
    "es|¡Sí! Se siente tranquilo.": "es-e1727ea089",
    "es|¡Sí! Se siente triste.": "es-2d07f10f28",
    "es|¡Sí! Sigue": "es-1d82f6b941",
    "es|¡Sí! Sol empieza con S.": "es-e15e576346",
    "es|¡Sí! Sol empieza con SO.": "es-54d6630bdb",
    "es|¡Sí! Va al bote de Orgánico.": "es-9e03e1a27e",
    "es|¡Sí! Va al bote de Papel.": "es-621813787b",
    "es|¡Sí! Va al bote de Plástico.": "es-d4d1e23392",
    "es|¡Sí! Árbol empieza con A.": "es-ebe203b123",
    "es|¿A qué bote de reciclaje va esto?": "es-76e68e52ed",
    "es|¿A qué estación pertenece esto?": "es-5b8141b8a2",
    "es|¿Cuál es el corazón?": "es-36cfbb70e6",
    "es|¿Cuál es el cuadrado?": "es-70c418c305",
    "es|¿Cuál es el círculo?": "es-cd8f5dde22",
    "es|¿Cuál es el estrella?": "es-33c4fc0f5d",
    "es|¿Cuál es el hexágono?": "es-9f95d7a8a0",
    "es|¿Cuál es el rectángulo?": "es-caa0fab216",
    "es|¿Cuál es el rombo?": "es-59ecfe1600",
    "es|¿Cuál es el triángulo?": "es-93e64115d5",
    "es|¿Cuál es el óvalo?": "es-63c1e0190f",
    "es|¿Cuál grupo tiene más?": "es-ba22b07cab",
    "es|¿Cuándo haces esto: almorzar?": "es-b5c4ae2866",
    "es|¿Cuándo haces esto: bañarse?": "es-9e05444153",
    "es|¿Cuándo haces esto: cepillarse los dientes?": "es-8177a0f0cf",
    "es|¿Cuándo haces esto: desayunar?": "es-e9c15e5492",
    "es|¿Cuándo haces esto: despertar?": "es-adb149ccbc",
    "es|¿Cuándo haces esto: dormir?": "es-98601b159e",
    "es|¿Cuándo haces esto: ir a la escuela?": "es-826f9391f5",
    "es|¿Cuándo haces esto: jugar con juguetes?": "es-313819b081",
    "es|¿Cuándo haces esto: leer un cuento?": "es-232dfc0a87",
    "es|¿Cuándo? A dormir": "es-daf84ef331",
    "es|¿Cuándo? El almuerzo": "es-3642dcb58f",
    "es|¿Cuándo? El baño": "es-c30da01bcd",
    "es|¿Cuándo? El cuento": "es-2ecf9a7547",
    "es|¿Cuándo? El desayuno": "es-b3a35fa088",
    "es|¿Cuándo? Juego afuera": "es-3e56766175",
    "es|¿Cuándo? Me peino": "es-96a4dd3e36",
    "es|¿Cuándo? Me visto": "es-d4b8d77be8",
    "es|¿Cuándo? Voy a la escuela": "es-86d1adf673",
    "es|¿Cuántas bellotas faltan a la derecha?": "es-b9e4b2439d",
    "es|¿Cuánto es en total?": "es-283457f727",
    "es|¿Cuántos había?": "es-6bb35c5973",
    "es|¿Cuántos hay? Toca para contar.": "es-ac96b64ba4",
    "es|¿Cuántos hay? Tócalos para contar.": "es-dfcf338775",
    "es|¿Cómo se siente?": "es-23d11f6911",
    "es|¿Dónde va?": "es-2f11f99926",
    "es|¿Dónde vive el conejo?": "es-597b740cf2",
    "es|¿Dónde vive el delfín?": "es-506a007894",
    "es|¿Dónde vive el elefante?": "es-861685892e",
    "es|¿Dónde vive el león?": "es-3075b1f1a7",
    "es|¿Dónde vive el perro?": "es-37b6730609",
    "es|¿Dónde vive el pez?": "es-f0e32cd50b",
    "es|¿Dónde vive el pulpo?": "es-a4c0d3ca71",
    "es|¿Dónde vive el pájaro?": "es-eca9eb54e4",
    "es|¿Dónde vive el águila?": "es-d7b7e11d63",
    "es|¿Dónde vive la abeja?": "es-84e465777f",
    "es|¿Dónde vive la ballena?": "es-a2f5ffb25f",
    "es|¿Dónde vive la mariposa?": "es-b5165f0ec9",
    "es|¿Esta onda es aguda o grave?": "es-7d2e63a726",
    "es|¿La onda es grande o pequeña?": "es-53a08e9920",
    "es|¿Quién hace CHIS CHIS?": "es-add32a3cfa",
    "es|¿Quién hace PUM PUM?": "es-c60c9ab1d4",
    "es|¿Quién hace TILÍN TILÍN?": "es-73ce533ab0",
    "es|¿Quién hace TIN TIN TIN?": "es-ea48822a67",
    "es|¿Quién hace TU-TUUU?": "es-de1e2fa8fe",
    "es|¿Qué color es?": "es-b3048a1eae",
    "es|¿Qué come el conejo?": "es-228bedcd5b",
    "es|¿Qué come el delfín?": "es-8222de1d91",
    "es|¿Qué come el elefante?": "es-3ca1cceec3",
    "es|¿Qué come el león?": "es-0c2d7d3415",
    "es|¿Qué come el perro?": "es-7e50c09a0a",
    "es|¿Qué come el pez?": "es-33a5d8cae1",
    "es|¿Qué come el pulpo?": "es-991d939c52",
    "es|¿Qué come el pájaro?": "es-ea7cc68119",
    "es|¿Qué come el águila?": "es-277b8b014a",
    "es|¿Qué come la abeja?": "es-01bf837f73",
    "es|¿Qué come la ballena?": "es-8d5366d62c",
    "es|¿Qué come la mariposa?": "es-4d5f33f523",
    "es|¿Qué empieza con A?": "es-c22a5ea43c",
    "es|¿Qué empieza con C?": "es-bc2b417e91",
    "es|¿Qué empieza con CA?": "es-cf2520c64d",
    "es|¿Qué empieza con E?": "es-e662fbfd77",
    "es|¿Qué empieza con GA?": "es-c0573d49ea",
    "es|¿Qué empieza con L?": "es-8c16230716",
    "es|¿Qué empieza con LU?": "es-628b36c260",
    "es|¿Qué empieza con M?": "es-b432dd3e17",
    "es|¿Qué empieza con MA?": "es-74cbe589e2",
    "es|¿Qué empieza con O?": "es-84b2ff04dc",
    "es|¿Qué empieza con P?": "es-d1d218f80d",
    "es|¿Qué empieza con PA?": "es-dff8a6c2cc",
    "es|¿Qué empieza con PE?": "es-1254bffb2d",
    "es|¿Qué empieza con PI?": "es-daa7330115",
    "es|¿Qué empieza con S?": "es-6a4607f06d",
    "es|¿Qué empieza con SO?": "es-588ada2b5d",
    "es|¿Qué forma es?": "es-842b98d7cd",
    "es|¿Qué lado pesa más?": "es-016ae30203",
    "es|¿Qué puedo hacer?": "es-e44d433265",
    "es|¿Qué sigue?": "es-af283e4008",
    "es|óvalo": "es-3f5347302b"
  };

  var cache = Object.create(null);   // id -> Audio
  var uris  = Object.create(null);   // id -> data URI | ''

  function norm(t) {
    return String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
  }

  function idDe(text, lang) {
    if (!text) return '';
    return MAPA[(lang || 'es') + '|' + norm(text)] || '';
  }

  /* Igual que en #61: el data: URI viene envuelto en url("...") porque así
     declara la app sus recursos, y getComputedStyle no es gratis, así que se
     desenvuelve una vez y se recuerda. Si el CSS todavía no aplicó, la
     variable llega vacía y NO memorizamos el fallo. */
  function uriFor(id) {
    if (!id) return '';
    if (id in uris) return uris[id];
    var raw = '';
    try {
      raw = getComputedStyle(document.documentElement)
              .getPropertyValue('--pa62-' + id) || '';
    } catch (e) { raw = ''; }
    raw = String(raw).trim();
    var m = raw.match(/^url\(\s*["']?([^"')]+)["']?\s*\)$/);
    var out = m ? m[1] : (raw.indexOf('data:') === 0 ? raw : '');
    if (out) uris[id] = out;
    return out;
  }

  function has(text, lang) {
    return !!uriFor(idDe(text, lang));
  }

  function el(id) {
    var a = cache[id];
    if (!a) { a = new Audio(uriFor(id)); a.preload = 'auto'; cache[id] = a; }
    return a;
  }

  /* Resuelve true solo si el clip sonó entero. Cualquier tropiezo resuelve
     false y quien llame cae al sintetizador; nunca rechaza, porque una
     promesa rota dejaría la ronda a medias y sin premio. */
  function playClip(id) {
    return new Promise(function (resolve) {
      if (typeof S === 'undefined' || !S.sound || !uriFor(id)) return resolve(false);
      var a;
      try { a = el(id); } catch (e) { return resolve(false); }
      var done = false;
      function fin(ok) { if (done) return; done = true; a.onended = a.onerror = null; resolve(ok); }
      a.onended = function () { fin(true); };
      a.onerror = function () { fin(false); };
      try {
        a.currentTime = 0;
        var pr = a.play();
        if (pr && pr.then) pr.catch(function () { fin(false); });
      } catch (e) { fin(false); }
    });
  }

  /* El guion de Rufo vive en un solo sitio —AUDIO_MANIFEST.keys, dentro de
     app.js—, así que aquí solo se compara contra él; nunca se duplica el
     texto. Devuelve la clave si la frase es de las suyas. */
  function claveRufo(text, opts, lang) {
    try {
      if (opts && opts.key) return opts.key;
      var keys = window.AudioBank && window.AudioBank.manifest &&
                 window.AudioBank.manifest.keys;
      if (!keys || !text) return null;
      var n = norm(text);
      for (var k in keys) {
        if (!Object.prototype.hasOwnProperty.call(keys, k)) continue;
        if (keys[k] && norm(keys[k][lang]) === n) return k;
      }
    } catch (e) {}
    return null;
  }

  function bankTiene(key, lang) {
    try {
      return !!(window.AudioBank && window.AudioBank.enabled &&
                window.AudioBank.has(key, lang));
    } catch (e) { return false; }
  }

  function rufoTiene(key, lang) {
    try { return !!(key && window.VozRufo && window.VozRufo.has(key, lang)); }
    catch (e) { return false; }
  }

  /* Devuelve el id de nuestro clip solo si la frase nos toca a nosotros: si
     es del guion de Rufo se la dejamos entera, tenga clip locutado o
     embebido. */
  function nuestra(text, opts, lang) {
    if (typeof S === 'undefined' || !S.sound) return '';
    var key = claveRufo(text, opts, lang);
    if (key && (bankTiene(key, lang) || rufoTiene(key, lang))) return '';
    var id = idDe(text, lang);
    return uriFor(id) ? id : '';
  }

  /* Fallback de una sola frase dentro de una secuencia: la dice el
     sintetizador y avisa al terminar, para que la siguiente no se le monte
     encima. Copia deliberada de la de #61: cuando #62 toma el mando de una
     tanda mixta, las partes ajenas siguen necesitando este cierre. */
  function ttsPart(p, lang, done) {
    if (typeof S === 'undefined' || !S.sound || !window.speechSynthesis || !p || !p.t) return done();
    try {
      var u = new SpeechSynthesisUtterance(p.t);
      u.lang = lang === 'es' ? 'es-ES' : 'en-US';
      u.rate = p.rate || 0.9;
      u.pitch = p.pitch || 1.12;
      u.onend = function () { done(); };
      u.onerror = function () { done(); };
      speechSynthesis.speak(u);
    } catch (e) { done(); }
  }

  var _speak    = (typeof window.speak    === 'function') ? window.speak    : null;
  var _speakSeq = (typeof window.speakSeq === 'function') ? window.speakSeq : null;

  if (_speak) {
    window.speak = function (text, opts) {
      opts = opts || {};
      var lang = opts.lang || (typeof S !== 'undefined' ? S.lang : 'es');
      var id = nuestra(text, opts, lang);
      if (id) {
        /* Se corta el sintetizador antes de soltar el clip: si no, la frase
           anterior se solapa y no se entiende ninguna. */
        if (window.speechSynthesis) { try { speechSynthesis.cancel(); } catch (e) {} }
        playClip(id).then(function (ok) { if (!ok) _speak(text, opts); });
        return;
      }
      return _speak(text, opts);
    };
  }

  if (_speakSeq) {
    window.speakSeq = function (parts) {
      parts = parts || [];
      var lang0 = (typeof S !== 'undefined' ? S.lang : 'es');
      var usa = parts.some(function (p) {
        return p && nuestra(p.t, p, p.lang || lang0);
      });
      /* Si ninguna frase de la tanda es nuestra, esto no es asunto nuestro:
         que la resuelva quien ya la resolvía, entera y de una pieza. */
      if (!usa) return _speakSeq(parts);
      if (window.speechSynthesis) { try { speechSynthesis.cancel(); } catch (e) {} }
      var i = 0;
      (function next() {
        if (i >= parts.length) return;
        var p = parts[i++];
        if (!p || !p.t) return next();
        var lang = p.lang || lang0;
        var id = nuestra(p.t, p, lang);
        if (id) {
          playClip(id).then(function (ok) { if (ok) next(); else resto(p, next); });
        } else {
          resto(p, next);
        }
      })();

      /* Una parte que no es nuestra puede seguir siendo de Rufo: en ese caso
         le pedimos su clip directamente, que devuelve promesa y nos deja
         encadenar sin adivinar duraciones. Si tampoco es suya, la dice el
         sintetizador. */
      function resto(p, done) {
        var lang = p.lang || lang0;
        var key = claveRufo(p.t, p, lang);
        if (key && !bankTiene(key, lang) && rufoTiene(key, lang)) {
          window.VozRufo.play(key, lang).then(function (ok) {
            if (ok) done(); else ttsPart(p, lang, done);
          });
          return;
        }
        ttsPart(p, lang, done);
      }
    };
  }

  /* Superficie mínima para las pruebas y para depurar desde la consola. */
  window.VozNarradora = {
    has: has,
    id: idDe,
    uri: uriFor,
    play: playClip,
    frases: function () { return Object.keys(MAPA); },
    total: function () { return Object.keys(MAPA).length; }
  };
})();
