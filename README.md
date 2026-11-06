# Portal de Encomiendas Lapticon

Portal web en HTML, CSS y JavaScript puro (sin frameworks) que consume el backend de Lapticon:

1. Inicio de sesión con Firebase (`signInWithPassword`).
2. Catálogo de países y ciudades para los selects de origen y destino.
3. Registro de encomiendas, con validación en el cliente.
4. Listado de mis encomiendas, que se refresca sin recargar la página.
5. Cancelar una encomienda (`PUT /api/encomiendas/:id/estado`).

## Cómo ejecutarlo

Sirve la carpeta con un servidor local (no abras el `.html` con doble clic):

```bash
python3 -m http.server 5500 --bind 127.0.0.1
```

Luego abre http://localhost:5500.

Usuario de pruebas: `test30@gmail.com`.

## Modo demo (API simulada)

El backend de Lapticon en Render (`lapticon-backend-ed.onrender.com`) **no está disponible**: todas las rutas responden `404` con la cabecera `x-render-routing: no-server`, igual que una dirección de Render que no existe.

Para poder demostrar el portal, `mock-api.js` simula **solo** ese backend (países, ciudades, crear, listar y cancelar encomiendas, incluido el `401` cuando falta el token). El login con Firebase **sigue siendo real**.

- Un aviso amarillo en la parte superior indica cuándo los datos son simulados.
- Se activa con el botón **"Activar modo demo"** o abriendo `http://localhost:5500/?demo=1`.
- Se desactiva con **"Usar backend real"** o `?demo=0`.
- Las encomiendas simuladas se guardan en el `localStorage` del navegador; **"Reiniciar datos"** las borra.

Cuando el backend vuelva a estar en línea, basta con desactivar el modo demo: `script.js` no cambia.

## Archivos

- `index.html`: estructura de la página.
- `script.js`: lógica y llamadas a la API con `fetch`.
- `style.css`: estilos.
- `mock-api.js`: API simulada para el modo demo.
