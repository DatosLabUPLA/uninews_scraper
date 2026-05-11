import * as cheerio from "cheerio";
import { setTimeout as sleep } from "node:timers/promises";

const BASE_URL = "https://uninews.datoslab.cl";
const TIME_ZONE = "America/Santiago";
const STOPWORDS = new Set([
  "a",
  "al",
  "algo",
  "algun",
  "alguna",
  "algunas",
  "alguno",
  "algunos",
  "ante",
  "antes",
  "como",
  "con",
  "contra",
  "cual",
  "cuales",
  "de",
  "del",
  "desde",
  "donde",
  "dos",
  "e",
  "el",
  "ella",
  "ellas",
  "ellos",
  "en",
  "entre",
  "era",
  "erais",
  "eran",
  "eras",
  "eres",
  "es",
  "esa",
  "esas",
  "ese",
  "eso",
  "esos",
  "esta",
  "estaba",
  "estado",
  "estais",
  "estamos",
  "estan",
  "estar",
  "estas",
  "este",
  "esto",
  "estos",
  "fue",
  "fueron",
  "ha",
  "habia",
  "han",
  "hasta",
  "hay",
  "la",
  "las",
  "le",
  "les",
  "lo",
  "los",
  "mas",
  "me",
  "mi",
  "mientras",
  "mis",
  "mucho",
  "muy",
  "no",
  "nos",
  "nosotras",
  "nosotros",
  "nuestra",
  "nuestras",
  "nuestro",
  "nuestros",
  "o",
  "os",
  "otra",
  "otras",
  "otro",
  "otros",
  "para",
  "pero",
  "por",
  "porque",
  "que",
  "quien",
  "quienes",
  "se",
  "sea",
  "segun",
  "ser",
  "si",
  "sin",
  "sobre",
  "son",
  "su",
  "sus",
  "tambien",
  "te",
  "tenia",
  "tiene",
  "tienen",
  "todo",
  "tras",
  "tu",
  "tus",
  "u",
  "un",
  "una",
  "uno",
  "unos",
  "y",
  "ya",
]);

function construirUrlBusqueda(nombre, page = 1) {
  const url = new URL("/busqueda/", BASE_URL);
  url.searchParams.set("search", nombre.toLowerCase());

  if (page > 1) {
    url.searchParams.set("page", String(page));
  }

  return url.href;
}

function limpiarTexto(texto) {
  return texto
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function normalizarPalabra(texto) {
  return limpiarTexto(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extraerPalabrasLimpias(texto) {
  return normalizarPalabra(texto)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((palabra) => palabra.length > 2 && !STOPWORDS.has(palabra));
}

function construirPalabrasClave(noticias, autor = "") {
  const palabrasExcluidas = new Set(extraerPalabrasLimpias(autor));
  const frecuencias = new Map();

  for (const noticia of noticias) {
    const palabrasNoticia = extraerPalabrasLimpias(
      `${noticia.titulo} ${noticia.bajada}`
    );

    for (const palabra of palabrasNoticia) {
      if (palabrasExcluidas.has(palabra)) {
        continue;
      }

      frecuencias.set(palabra, (frecuencias.get(palabra) ?? 0) + 1);
    }
  }

  return Array.from(frecuencias.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .map(([palabra, cantidad]) => ({ palabra, cantidad }));
}

function convertirFecha(fechaTexto) {
  const meses = {
    enero: "01",
    febrero: "02",
    marzo: "03",
    abril: "04",
    mayo: "05",
    junio: "06",
    julio: "07",
    agosto: "08",
    septiembre: "09",
    setiembre: "09",
    octubre: "10",
    noviembre: "11",
    diciembre: "12",
  };

  const match = limpiarTexto(fechaTexto)
    .toLowerCase()
    .match(/^(\d{1,2}) de ([a-záéíóúñ]+) de (\d{4})$/i);

  if (!match) return limpiarTexto(fechaTexto);

  const [, dia, mesTexto, anio] = match;
  const mes = meses[mesTexto];

  if (!mes) return limpiarTexto(fechaTexto);

  return `${dia.padStart(2, "0")}-${mes}-${anio}`;
}

function obtenerTimestampChile(fecha = new Date()) {
  const partesFecha = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(fecha);

  const valores = Object.fromEntries(
    partesFecha
      .filter((parte) => parte.type !== "literal")
      .map((parte) => [parte.type, parte.value])
  );

  const offsetPartes = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(fecha);

  const offsetTexto =
    offsetPartes.find((parte) => parte.type === "timeZoneName")?.value ?? "GMT-00:00";
  const offsetBase = offsetTexto.replace("GMT", "");
  const offset = offsetBase === ""
    ? "+00:00"
    : offsetBase.replace(/^([+-])(\d{1,2})(?::(\d{2}))?$/, (_, signo, horas, minutos = "00") => {
        return `${signo}${horas.padStart(2, "0")}:${minutos}`;
      });

  return `${valores.year}-${valores.month}-${valores.day}T${valores.hour}:${valores.minute}:${valores.second}${offset}`;
}

async function obtenerHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 scraper-uninews/1.0",
      "Accept": "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status} al consultar ${url}`);
  }

  return await response.text();
}

function extraerTotalPaginas($) {
  let totalPaginas = 1;

  $(".pagination .page-link").each((_, el) => {
    const texto = limpiarTexto($(el).text());
    const numero = Number.parseInt(texto, 10);

    if (!Number.isNaN(numero)) {
      totalPaginas = Math.max(totalPaginas, numero);
    }
  });

  return totalPaginas;
}

function extraerNoticias(html) {
  const $ = cheerio.load(html);
  const noticias = [];

  $(".card.shadow-sm").each((_, card) => {
    const $card = $(card);

    const tituloEl = $card.find(".card-body .card-text a").first();
    const href = tituloEl.attr("href");

    if (!href) return;

    const titulo = limpiarTexto(tituloEl.text());
    const bajada = limpiarTexto($card.find(".texto-bajada").first().text());
    const institucion = limpiarTexto(
      $card.find('a[href^="/universidad/"]').first().text()
    );
    const fechaTexto = limpiarTexto($card.find("small.text-muted").first().text());
    const imagen = $card.find(".div-imagen img").first().attr("src") || null;

    noticias.push({
      titulo,
      bajada,
      institucion,
      fecha: convertirFecha(fechaTexto),
      url: new URL(href, BASE_URL).href,
      imagen: imagen ? new URL(imagen, BASE_URL).href : null,
    });
  });

  return {
    noticias,
    totalPaginas: extraerTotalPaginas($),
  };
}

function eliminarDuplicadosPorUrl(noticias) {
  const mapa = new Map();

  for (const noticia of noticias) {
    mapa.set(noticia.url, noticia);
  }

  return Array.from(mapa.values());
}

async function scrapearAutor(nombre, opciones = {}) {
  const delayMs = opciones.delayMs ?? 300;

  const primeraUrl = construirUrlBusqueda(nombre, 1);
  const primerHtml = await obtenerHtml(primeraUrl);
  const primeraPagina = extraerNoticias(primerHtml);

  let noticias = [...primeraPagina.noticias];
  const totalPaginas = primeraPagina.totalPaginas;

  for (let page = 2; page <= totalPaginas; page++) {
    await sleep(delayMs);

    const urlPagina = construirUrlBusqueda(nombre, page);
    const html = await obtenerHtml(urlPagina);
    const resultadoPagina = extraerNoticias(html);

    noticias.push(...resultadoPagina.noticias);
  }

  noticias = eliminarDuplicadosPorUrl(noticias);

  return {
    autor: nombre,
    url_busqueda: primeraUrl,
    cantidad_noticias: noticias.length,
    palabras_clave: construirPalabrasClave(noticias, nombre),
    noticias,
  };
}

export async function scrapearAutores(nombres, opciones = {}) {
  const listaNombres = Array.isArray(nombres) ? nombres : [nombres];
  const resultados = [];
  const extraido = obtenerTimestampChile();

  for (const nombre of listaNombres) {
    const resultado = await scrapearAutor(nombre, opciones);
    resultados.push(resultado);
  }

  const totalNoticias = resultados.reduce(
    (suma, resultado) => suma + resultado.cantidad_noticias,
    0
  );
  const cantidadAutores = resultados.length;
  const promedioNoticiasPorAutor = cantidadAutores === 0
    ? 0
    : totalNoticias / cantidadAutores;

  return {
    extraido,
    estadisticas: {
      cantidad_autores: cantidadAutores,
      total_noticias: totalNoticias,
      promedio_noticias_por_autor: promedioNoticiasPorAutor,
    },
    resultados,
  };
}