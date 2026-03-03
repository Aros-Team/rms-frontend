# Restaurant Management System | Frontend

Frontend base del RMS orientada a escalar por modulos y alineada con una arquitectura hexagonal en backend.

## Stack

- Angular 21
- Tailwind CSS
- PrimeNG

## Inicio rapido

- Instalar dependencias: `npm install`
- Ejecutar en local: `npm run start`
- Ejecutar en Docker: `docker-compose up --build`

La app queda disponible en `http://localhost:4200`.

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
