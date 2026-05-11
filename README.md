# uninews-scraper

Paquete de Node.js para consultar UniNews por nombre de autor y obtener el resultado como JSON, sin escribir archivos en disco.

Repositorio GitHub actual: `DatosLabUPLA/uninews_scraper`

Nombre del paquete: `uninews-scraper`

## Instalacion

Desde GitHub:

```bash
npm install github:DatosLabUPLA/uninews_scraper
```

Tambien puedes fijar una rama, tag o commit:

```bash
npm install github:DatosLabUPLA/uninews_scraper#master
```

```bash
npm install github:DatosLabUPLA/uninews_scraper#v1.0.0
```

Si mas adelante renombras el repositorio para usar guiones, una opcion consistente seria `uninews-scraper`, manteniendo el mismo nombre que el paquete.

## Uso

```js
import { scrapearAutores } from "uninews-scraper";

const resultado = await scrapearAutores(
  ["Paulina Arellano", "Ezequiel Lagos"],
  { delayMs: 300 }
);

console.log(JSON.stringify(resultado, null, 2));
```

Tambien acepta un solo nombre:

```js
import { scrapearAutores } from "uninews-scraper";

const resultado = await scrapearAutores("Paulina Arellano");
console.log(resultado);
```

## Respuesta

```json
{
  "extraido": "2026-05-11T14:46:43-04:00",
  "resultados": [
    {
      "autor": "Paulina Arellano",
      "url_busqueda": "https://uninews.datoslab.cl/busqueda/?search=paulina+arellano",
      "cantidad_noticias": 5,
      "noticias": [
        {
          "titulo": "...",
          "bajada": "...",
          "institucion": "UPLA",
          "fecha": "13-11-2025",
          "url": "https://uninews.datoslab.cl/detalle/82650",
          "imagen": "https://..."
        }
      ]
    }
  ]
}
```

## Uso interno

Si el proyecto se usara solo de forma interna, no hace falta publicarlo en npm. Basta con subirlo a GitHub e instalarlo desde la URL del repositorio en los proyectos consumidores.