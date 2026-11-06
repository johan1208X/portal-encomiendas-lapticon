const BASE_URL = "https://lapticon-backend-ed.onrender.com";
const FIREBASE_API_KEY = "AIzaSyAuh64b_I2OtC7KYuubCVx9plEe2pojp2M";

let idToken = null;
let uid = null;

// Mapa id -> nombre de ciudad, para mostrar nombres legibles en la tabla
const ciudadesPorId = new Map();

// ---------- Utilidades ----------

const $ = (id) => document.getElementById(id);

// Muestra un mensaje en un <p class="status"> con un tipo: "loading" | "ok" | "error"
function setStatus(el, mensaje, tipo = "") {
  el.textContent = mensaje;
  el.className = `status ${tipo}`;
}

// Lee el cuerpo de una respuesta sin reventar si no es JSON (ej. "Not Found")
async function leerRespuesta(res) {
  const texto = await res.text();
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

// Extrae el mensaje de error que devuelva la API (Firebase o backend)
function mensajeDeError(data, res) {
  if (data && typeof data === "object") {
    if (data.error?.message) return data.error.message; // Firebase
    if (typeof data.error === "string") return data.error;
    if (data.message) return data.message;
    if (data.mensaje) return data.mensaje;
    if (Array.isArray(data.errors)) return data.errors.map((e) => e.msg || e.message || e).join(", ");
  }
  if (typeof data === "string" && data.trim()) return `${res.status} ${data.trim()}`;
  return `Error ${res.status}`;
}

// "Failed to fetch" = el servidor no respondió o bloqueó la petición (red, CORS, servidor caído)
function textoError(err) {
  if (err instanceof TypeError) {
    return "no hay conexión con el servidor (puede estar caído o despertando). Intenta de nuevo en un momento.";
  }
  return err.message;
}

// La API puede devolver un arreglo directo o envuelto en { data: [...] }, { ciudades: [...] }, etc.
function comoLista(data, ...claves) {
  if (Array.isArray(data)) return data;
  for (const k of [...claves, "data", "results", "items"]) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  return [];
}

const idDe = (obj) => obj?._id ?? obj?.id ?? obj?.codigo ?? obj?.nombre ?? obj?.name;
const nombreDe = (obj) => obj?.nombre ?? obj?.name ?? obj?.ciudad ?? obj?.pais ?? String(idDe(obj) ?? "");

// Fetch con token: si el token expiró (401), avisamos y volvemos al login
async function fetchProtegido(url, opciones = {}) {
  const res = await fetch(url, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      ...(opciones.headers || {}),
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (res.status === 401) {
    cerrarSesion("Tu sesión expiró. Vuelve a iniciar sesión.");
    throw new Error("Sesión expirada");
  }
  return res;
}

// ---------- Bloque 1: Login ----------

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("login-email").value.trim();
  const password = $("login-password").value;
  const boton = e.submitter || e.target.querySelector("button");
  const status = $("login-status");

  boton.disabled = true;
  setStatus(status, "Iniciando sesión…", "loading");

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );
    const data = await leerRespuesta(res);

    if (!res.ok) {
      setStatus(status, `No se pudo iniciar sesión: ${mensajeDeError(data, res)}`, "error");
      return;
    }

    idToken = data.idToken;
    uid = data.localId;

    setStatus(status, "");
    $("login-password").value = "";
    $("login-section").hidden = true;
    $("app-section").hidden = false;
    $("welcome-message").textContent = `¡Bienvenido, ${data.email || email}!`;

    // Primero las ciudades (para poder traducir ids a nombres en la tabla)
    await cargarCiudades();
    await cargarEncomiendas();
  } catch (err) {
    setStatus(status, `No se pudo iniciar sesión: ${textoError(err)}`, "error");
  } finally {
    boton.disabled = false;
  }
});

function cerrarSesion(mensaje = "") {
  idToken = null;
  uid = null;
  ciudadesPorId.clear();
  $("encomiendas-body").innerHTML = "";
  $("app-section").hidden = true;
  $("login-section").hidden = false;
  setStatus($("login-status"), mensaje, mensaje ? "error" : "");
}

$("logout-btn").addEventListener("click", () => cerrarSesion());

// ---------- Bloque 2: Catálogo de ciudades ----------

async function cargarCiudades() {
  const status = $("ciudades-status");
  const origen = $("origen-select");
  const destino = $("destino-select");
  setStatus(status, "Cargando ciudades… (el servidor puede tardar ~1 min en despertar)", "loading");
  origen.disabled = destino.disabled = true;

  try {
    // Las dos peticiones son independientes: se lanzan en paralelo
    const [paisesRes, ciudadesRes] = await Promise.all([
      fetch(`${BASE_URL}/api/ciudades/paises`),
      fetch(`${BASE_URL}/api/ciudades/ciudades`),
    ]);
    const [paisesData, ciudadesData] = await Promise.all([
      leerRespuesta(paisesRes),
      leerRespuesta(ciudadesRes),
    ]);

    if (!ciudadesRes.ok) throw new Error(mensajeDeError(ciudadesData, ciudadesRes));

    const paises = paisesRes.ok ? comoLista(paisesData, "paises") : [];
    const ciudades = comoLista(ciudadesData, "ciudades");
    if (ciudades.length === 0) throw new Error("La API no devolvió ciudades");

    // id de país -> nombre de país
    const nombrePais = new Map(paises.map((p) => [String(idDe(p)), nombreDe(p)]));

    // Agrupar ciudades por país
    const grupos = new Map();
    for (const c of ciudades) {
      ciudadesPorId.set(String(idDe(c)), nombreDe(c));
      const p = c.pais ?? c.paisId ?? c.country;
      const pais =
        (p && typeof p === "object" ? nombreDe(p) : nombrePais.get(String(p)) ?? p) || "Otras";
      if (!grupos.has(pais)) grupos.set(pais, []);
      grupos.get(pais).push(c);
    }

    for (const select of [origen, destino]) {
      select.innerHTML = "";
      const placeholder = new Option(
        select === origen ? "— Ciudad de origen —" : "— Ciudad de destino —",
        ""
      );
      select.add(placeholder);

      for (const [pais, lista] of [...grupos].sort((a, b) => String(a[0]).localeCompare(b[0]))) {
        const grupo = document.createElement("optgroup");
        grupo.label = pais;
        lista
          .sort((a, b) => nombreDe(a).localeCompare(nombreDe(b)))
          .forEach((c) => grupo.appendChild(new Option(nombreDe(c), idDe(c))));
        select.appendChild(grupo);
      }
    }

    setStatus(status, `${ciudades.length} ciudades en ${grupos.size} países.`, "ok");
  } catch (err) {
    setStatus(status, `No se pudieron cargar las ciudades: ${textoError(err)}`, "error");
  } finally {
    origen.disabled = destino.disabled = false;
  }
}

// ---------- Bloque 3: Crear encomienda ----------

$("encomienda-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = $("encomienda-status");
  const boton = e.submitter || e.target.querySelector("button");

  const body = {
    ciudadOrigen: $("origen-select").value,
    ciudadDestino: $("destino-select").value,
    valor: $("valor-input").value.trim(),
    moneda: $("moneda-select").value,
    observaciones: $("observaciones-input").value.trim(),
  };

  // Validación en el cliente: ningún campo vacío
  const etiquetas = {
    ciudadOrigen: "ciudad de origen",
    ciudadDestino: "ciudad de destino",
    valor: "valor",
    moneda: "moneda",
    observaciones: "observaciones",
  };
  const faltantes = Object.keys(body).filter((k) => !body[k]);
  if (faltantes.length) {
    setStatus(status, `Completa: ${faltantes.map((k) => etiquetas[k]).join(", ")}.`, "error");
    return;
  }
  if (body.ciudadOrigen === body.ciudadDestino) {
    setStatus(status, "El origen y el destino deben ser diferentes.", "error");
    return;
  }
  const valorNum = Number(body.valor);
  if (!Number.isFinite(valorNum) || valorNum <= 0) {
    setStatus(status, "El valor debe ser un número mayor que 0.", "error");
    return;
  }
  body.valor = valorNum;

  boton.disabled = true;
  setStatus(status, "Creando encomienda…", "loading");

  try {
    const res = await fetchProtegido(`${BASE_URL}/api/encomiendas`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await leerRespuesta(res);

    if (!res.ok) {
      setStatus(status, `No se pudo crear la encomienda: ${mensajeDeError(data, res)}`, "error");
      return;
    }

    setStatus(status, "¡Encomienda creada con éxito!", "ok");
    $("encomienda-form").reset();
    $("origen-select").value = "";
    $("destino-select").value = "";

    await cargarEncomiendas();
  } catch (err) {
    if (idToken) setStatus(status, `No se pudo crear la encomienda: ${textoError(err)}`, "error");
  } finally {
    boton.disabled = false;
  }
});

// ---------- Bloque 4: Listar mis encomiendas ----------

// La ciudad puede venir como id, como nombre, o como objeto poblado
function nombreCiudad(valor) {
  if (valor && typeof valor === "object") return nombreDe(valor);
  return ciudadesPorId.get(String(valor)) ?? valor ?? "—";
}

function formatearValor(valor, moneda) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return `${valor ?? "—"} ${moneda ?? ""}`.trim();
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: moneda || "USD" }).format(n);
  } catch {
    return `${n.toLocaleString("es-CO")} ${moneda ?? ""}`.trim();
  }
}

function crearFila(enc) {
  const tr = document.createElement("tr");
  tr.dataset.id = idDe(enc);

  const celdas = [
    nombreCiudad(enc.ciudadOrigen ?? enc.origen),
    nombreCiudad(enc.ciudadDestino ?? enc.destino),
    null, // estado (badge)
    formatearValor(enc.valor, enc.moneda),
  ];
  celdas.forEach((texto, i) => {
    const td = document.createElement("td");
    if (i === 2) {
      td.className = "estado-cell";
      td.appendChild(crearBadge(enc.estado));
    } else {
      td.textContent = texto;
    }
    tr.appendChild(td);
  });

  const tdAccion = document.createElement("td");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "danger small";
  btn.textContent = "Cancelar";
  btn.disabled = esFinal(enc.estado);
  btn.addEventListener("click", () => cancelarEncomienda(idDe(enc), tr));
  tdAccion.appendChild(btn);
  tr.appendChild(tdAccion);

  return tr;
}

function esFinal(estado) {
  return ["cancelada", "entregada"].includes(String(estado || "").toLowerCase());
}

function crearBadge(estado) {
  const span = document.createElement("span");
  const e = String(estado || "pendiente").toLowerCase();
  span.className = `badge badge-${e.replace(/\s+/g, "-")}`;
  span.textContent = e;
  return span;
}

async function cargarEncomiendas() {
  const status = $("encomiendas-status");
  const tbody = $("encomiendas-body");
  setStatus(status, "Cargando encomiendas…", "loading");

  try {
    const res = await fetchProtegido(`${BASE_URL}/api/encomiendas`);
    const data = await leerRespuesta(res);

    if (!res.ok) throw new Error(mensajeDeError(data, res));

    const encomiendas = comoLista(data, "encomiendas");

    tbody.innerHTML = "";
    if (encomiendas.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.className = "empty";
      td.textContent = "Aún no tienes encomiendas registradas.";
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      encomiendas.forEach((enc) => tbody.appendChild(crearFila(enc)));
    }
    setStatus(status, "");
  } catch (err) {
    if (idToken) setStatus(status, `No se pudieron cargar las encomiendas: ${textoError(err)}`, "error");
  }
}

$("refresh-btn").addEventListener("click", cargarEncomiendas);

// ---------- Bloque 5 (reto opcional): cambiar estado ----------

async function cancelarEncomienda(encomiendaId, fila) {
  if (!confirm("¿Seguro que quieres cancelar esta encomienda?")) return;

  const status = $("encomiendas-status");
  const btn = fila.querySelector("button");
  btn.disabled = true;
  btn.textContent = "Cancelando…";

  try {
    const res = await fetchProtegido(`${BASE_URL}/api/encomiendas/${encomiendaId}/estado`, {
      method: "PUT",
      body: JSON.stringify({ estado: "cancelada" }),
    });
    const data = await leerRespuesta(res);

    if (!res.ok) throw new Error(mensajeDeError(data, res));

    // Actualizar solo esta fila, sin recargar la tabla ni la página
    const nuevoEstado = data?.estado ?? data?.encomienda?.estado ?? data?.data?.estado ?? "cancelada";
    const celda = fila.querySelector(".estado-cell");
    celda.replaceChildren(crearBadge(nuevoEstado));
    btn.textContent = "Cancelar";
    btn.disabled = esFinal(nuevoEstado);
    setStatus(status, "Encomienda cancelada.", "ok");
  } catch (err) {
    btn.textContent = "Cancelar";
    btn.disabled = false;
    if (idToken) setStatus(status, `No se pudo cancelar: ${textoError(err)}`, "error");
  }
}
