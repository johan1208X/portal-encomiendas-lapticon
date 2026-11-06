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

## Archivos

- `index.html`: estructura de la página.
- `script.js`: lógica y llamadas a la API con `fetch`.
- `style.css`: estilos.
