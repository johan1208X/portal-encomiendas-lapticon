// ============================================================
// MODO DEMO — API simulada de Lapticon
// ------------------------------------------------------------
// El backend real (lapticon-backend-ed.onrender.com) no está
// disponible en Render (responde 404 "x-render-routing: no-server").
// Este archivo simula SOLO ese backend para poder demostrar el
// portal. El login con Firebase sigue siendo real.
//
// Cómo funciona: envuelve window.fetch. Si el modo demo está
// activo y la URL empieza por BASE_URL, responde con datos
// simulados; cualquier otra petición (Firebase) pasa intacta.
//
// Activar/desactivar: botón del aviso superior, o ?demo=1 / ?demo=0
// ============================================================

(function () {
  const DEMO_KEY = "lapticon-demo";
  const DATA_KEY = "lapticon-demo-encomiendas";
  const API = "https://lapticon-backend-ed.onrender.com";

  // ?demo=1 o ?demo=0 en la URL activa/desactiva y se recuerda
  const param = new URLSearchParams(location.search).get("demo");
  if (param !== null) guardar(DEMO_KEY, param === "1" ? "1" : "0");
  const activo = leer(DEMO_KEY) === "1";

  function leer(k) {
    try { return localStorage.getItem(k); } catch { return null; }
  }
  function guardar(k, v) {
    try { localStorage.setItem(k, v); } catch { /* sin almacenamiento: solo dura esta visita */ }
  }

  // ---------- Datos simulados ----------
  const paises = [
    { _id: "pais-co", nombre: "Colombia", codigo: "CO" },
    { _id: "pais-us", nombre: "Estados Unidos", codigo: "US" },
    { _id: "pais-es", nombre: "España", codigo: "ES" },
    { _id: "pais-mx", nombre: "México", codigo: "MX" },
  ];
  const ciudades = [
    { _id: "ciu-bog", nombre: "Bogotá", pais: "pais-co" },
    { _id: "ciu-med", nombre: "Medellín", pais: "pais-co" },
    { _id: "ciu-cal", nombre: "Cali", pais: "pais-co" },
    { _id: "ciu-baq", nombre: "Barranquilla", pais: "pais-co" },
    { _id: "ciu-ctg", nombre: "Cartagena", pais: "pais-co" },
    { _id: "ciu-mia", nombre: "Miami", pais: "pais-us" },
    { _id: "ciu-nyc", nombre: "Nueva York", pais: "pais-us" },
    { _id: "ciu-mad", nombre: "Madrid", pais: "pais-es" },
    { _id: "ciu-bcn", nombre: "Barcelona", pais: "pais-es" },
    { _id: "ciu-cdmx", nombre: "Ciudad de México", pais: "pais-mx" },
  ];
  const ESTADOS_VALIDOS = ["pendiente", "en transito", "entregada", "cancelada"];

  function cargarEncomiendas() {
    try {
      const guardadas = JSON.parse(leer(DATA_KEY));
      if (Array.isArray(guardadas)) return guardadas;
    } catch { /* datos corruptos: se reinician */ }
    return [
      { _id: "demo-1", ciudadOrigen: "ciu-bog", ciudadDestino: "ciu-mia", valor: 80, moneda: "USD", observaciones: "Documentos", estado: "en transito" },
      { _id: "demo-2", ciudadOrigen: "ciu-med", ciudadDestino: "ciu-mad", valor: 150000, moneda: "COP", observaciones: "Ropa", estado: "pendiente" },
    ];
  }
  let encomiendas = cargarEncomiendas();
  const persistir = () => guardar(DATA_KEY, JSON.stringify(encomiendas));

  // ---------- Router ----------
  function json(status, body) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  function tokenDe(opciones) {
    const h = new Headers(opciones?.headers || {});
    const auth = h.get("Authorization") || "";
    return auth.startsWith("Bearer ") ? auth.slice(7) : "";
  }

  function atender(url, opciones = {}) {
    const metodo = (opciones.method || "GET").toUpperCase();
    const ruta = new URL(url).pathname;
    let body = {};
    try { body = opciones.body ? JSON.parse(opciones.body) : {}; } catch { return json(400, { message: "JSON inválido" }); }

    // Rutas públicas
    if (metodo === "GET" && ruta === "/api/ciudades/paises") return json(200, paises);
    if (metodo === "GET" && ruta === "/api/ciudades/ciudades") return json(200, ciudades);

    // Rutas protegidas: igual que el backend real, exigen Bearer token
    const token = tokenDe(opciones);
    if (!token || token === "null") return json(401, { message: "Token no proporcionado o inválido" });

    if (ruta === "/api/encomiendas" && metodo === "GET") return json(200, encomiendas);

    if (ruta === "/api/encomiendas" && metodo === "POST") {
      const { ciudadOrigen, ciudadDestino, valor, moneda, observaciones } = body;
      if (!ciudadOrigen || !ciudadDestino || valor === undefined || valor === "" || !moneda) {
        return json(400, { message: "Faltan campos obligatorios" });
      }
      if (!ciudades.some((c) => c._id === ciudadOrigen) || !ciudades.some((c) => c._id === ciudadDestino)) {
        return json(400, { message: "Ciudad de origen o destino no válida" });
      }
      if (ciudadOrigen === ciudadDestino) return json(400, { message: "El origen y el destino deben ser diferentes" });
      if (!(Number(valor) > 0)) return json(400, { message: "El valor debe ser mayor que 0" });

      const nueva = {
        _id: "demo-" + Date.now(),
        ciudadOrigen,
        ciudadDestino,
        valor: Number(valor),
        moneda,
        observaciones: observaciones || "",
        estado: "pendiente",
        createdAt: new Date().toISOString(),
      };
      encomiendas.push(nueva);
      persistir();
      return json(201, nueva);
    }

    const m = ruta.match(/^\/api\/encomiendas\/([^/]+)\/estado$/);
    if (m && metodo === "PUT") {
      const enc = encomiendas.find((e) => e._id === decodeURIComponent(m[1]));
      if (!enc) return json(404, { message: "Encomienda no encontrada" });
      if (!ESTADOS_VALIDOS.includes(body.estado)) return json(400, { message: "Estado no válido" });
      if (enc.estado === "cancelada" || enc.estado === "entregada") {
        return json(409, { message: `La encomienda ya está ${enc.estado}` });
      }
      enc.estado = body.estado;
      persistir();
      return json(200, enc);
    }

    return json(404, { message: "Ruta no encontrada (API simulada)" });
  }

  // ---------- Interceptar fetch ----------
  const fetchOriginal = window.fetch.bind(window);
  window.fetch = async (input, opciones) => {
    const url = typeof input === "string" ? input : input.url;
    if (activo && url.startsWith(API)) {
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 300)); // latencia para ver los estados de carga
      return atender(url, opciones);
    }
    return fetchOriginal(input, opciones);
  };

  // ---------- Aviso visible ----------
  window.LapticonDemo = {
    activo,
    alternar() {
      guardar(DEMO_KEY, activo ? "0" : "1");
      location.href = location.pathname; // recargar sin ?demo
    },
    reiniciarDatos() {
      try { localStorage.removeItem(DATA_KEY); } catch { /* nada que borrar */ }
      location.reload();
    },
  };

  document.addEventListener("DOMContentLoaded", () => {
    const aviso = document.getElementById("demo-banner");
    if (!aviso) return;
    const texto = aviso.querySelector(".demo-texto");
    const boton = aviso.querySelector("#demo-toggle");
    const reiniciar = aviso.querySelector("#demo-reset");

    aviso.classList.toggle("on", activo);
    texto.textContent = activo
      ? "MODO DEMO: el backend de Lapticon (Render) está caído, así que ciudades y encomiendas son datos SIMULADOS en el navegador. El login con Firebase es real."
      : "Usando el backend real de Lapticon. Si no responde, puedes activar el modo demo con datos simulados.";
    boton.textContent = activo ? "Usar backend real" : "Activar modo demo";
    reiniciar.hidden = !activo;
    boton.addEventListener("click", window.LapticonDemo.alternar);
    reiniciar.addEventListener("click", window.LapticonDemo.reiniciarDatos);
  });
})();
