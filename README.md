# Restaurant Management System | Frontend

Frontend base del RMS orientada a escalar por modulos y alineada con una arquitectura hexagonal en backend.

## Stack

- Angular 21
- Tailwind CSS
- PrimeNG

## Inicio rapido

- Copiar `.env.example` a `.env` y ajustar si es necesario
- Instalar dependencias: `npm install`
- Ejecutar en local: `npm run start`
- Ejecutar en Docker: `docker-compose up --build`

La app queda disponible en `http://localhost:4200`.

## Variables de entorno

Para configurar el entorno, copiar `.env.example` a `.env`:

```bash
cp .env.example .env
```

### Puppeteer (tests E2E)

| Variable | Descripcion | Valor por defecto |
|----------|-------------|-------------------|
| `PUPPETEER_SKIP_DOWNLOAD` | Omitir descarga automatica de Chrome | `true` |
| `PUPPETEER_EXECUTABLE_PATH` | Ruta al ejecutable de Chrome/Chromium | `/usr/bin/chromium` |

**Instalacion de Chrome/Chromium:**
- Linux (Debian/Ubuntu): `sudo apt install -y chromium`
- macOS: Instalar Google Chrome desde el sitio oficial
- Windows: Instalar Google Chrome desde el sitio oficial

**Ejecutar tests E2E:**
```bash
npm run test:e2e
```

## Integracion con API

- El frontend consume la API via proxy en `/api` (`proxy.conf.json`).
- El `apiBaseUrl` de la app apunta a `/api/v1` para mapear con los endpoints versionados de la API.
- Dentro de Docker, el proxy usa `http://host.docker.internal:8080`.

## Arquitectura base frontend

Se adopta una variante de arquitectura hexagonal/clean para frontend:

- `core`: reglas de negocio, modelos, puertos y casos de uso
- `infrastructure`: adaptadores externos (HTTP, storage, etc.)
- `features`: pantallas y orquestacion UI (facades)
- `shared`: componentes utilitarios reutilizables

Ejemplo inicial implementado: flujo `orders` para agregar producto a una orden.
