# Certia

Plataforma para gestionar expedientes de **Certificados de Ahorro Energético (CAE)** en España: desde la captación del beneficiario y la recogida de documentación hasta la formación de lotes, la verificación y la emisión.

Certia separa un **motor genérico** (expedientes, documentos, flujos, lotes, tareas) de las **fichas** de actuación, que se definen como configuración. Añadir un nuevo tipo de actuación (vehículo eléctrico, aerotermia, envolvente, electrodomésticos…) consiste en dar de alta una ficha, no en programar.

> Estado: **MVP en desarrollo.** Primera ficha soportada: vehículo eléctrico (versión anterior y vigente).

Documentación del proyecto:

- [PROJECT.md](./PROJECT.md): contexto, objetivos, alcance, arquitectura y plan de entregas.
- [FEATURE.md](./FEATURE.md): funcionalidades del MVP con prioridad y criterios de aceptación.

---

## Stack

| Capa | Tecnología |
|---|---|
| Lenguaje | TypeScript (Node.js 22 LTS) |
| API | Fastify |
| Frontend | React + Vite |
| Base de datos | PostgreSQL 16 + Drizzle ORM |
| Validación | Zod (compartido entre frontend y API) |
| Tareas en segundo plano | Worker propio con cola en Postgres (Cloud Tasks opcional en producción) |
| Almacenamiento de archivos | Google Cloud Storage (local: disco) |
| PDF y plantillas | docxtemplater + Gotenberg |
| Extracción de datos | Modelo con visión vía Vertex AI |
| Autenticación | Login con Google (OIDC), limitado al dominio de la organización |
| Tests | Vitest |
| Monorepo | pnpm workspaces |
| Infraestructura | Docker · Google Cloud Run · Cloud SQL · región `europe-southwest1` (Madrid) |

## Estructura

```
certia/
├── apps/
│   ├── web/          # Frontend React + Vite (estático)
│   ├── api/          # API REST (Fastify)
│   └── worker/       # Tareas: extracción IA, PDFs, alertas
├── packages/
│   ├── core/         # Dominio puro: fichas, cálculo, flujos, lotes (sin dependencias de infraestructura)
│   ├── db/           # Esquema Drizzle y migraciones
│   ├── fichas/       # Definiciones YAML de las fichas + validación
│   ├── adapters/     # Storage, colas, IA, email, PDF (interfaces + implementaciones)
│   └── shared/       # Tipos y esquemas Zod compartidos
├── docker/
│   ├── Dockerfile    # Una imagen para api (con el frontend), worker y migraciones
│   ├── start.mjs     # Arranque según APP_MODE
│   └── compose.yml   # Postgres y Gotenberg en local (+ perfil "app" con la imagen)
├── PROJECT.md
├── FEATURE.md
└── pnpm-workspace.yaml
```

Reglas de dependencia:

- `core` no importa nada de `db`, `adapters` ni de las apps.
- Las apps dependen de `core`, `db`, `adapters` y `shared`.
- Toda integración externa (GCP, IA, email) pasa por una interfaz de `adapters`.

## Puesta en marcha local

Requisitos: Docker, Node.js 22 y pnpm 10 (`corepack enable`).

```bash
git clone https://github.com/daykelm/certia.git
cd certia
cp .env.example .env                          # rellena ENCRYPTION_KEY con: openssl rand -base64 32
pnpm install
docker compose -f docker/compose.yml up -d   # postgres y gotenberg
pnpm db:migrate
pnpm db:seed                                  # organización, usuario admin y fichas
pnpm dev                                      # api + worker + web en modo desarrollo
```

- Web: http://localhost:5173
- API: http://localhost:3000 (salud: `/api/salud`)
- Gotenberg: http://localhost:3001

En desarrollo los documentos se guardan en `.storage/` y todas las peticiones se identifican como `DEV_USER_EMAIL` hasta que esté el login con Google (F-01).

### Primera vez en el repositorio

El esqueleto se creó sin acceso al registro de npm, así que faltan dos archivos generados. Tras el primer `pnpm install`:

```bash
pnpm db:generate                 # crea la migración inicial en packages/db/migrations
git add pnpm-lock.yaml packages/db/migrations
git commit -m "chore: lockfile y migración inicial"
```

### Probar la imagen de producción en local

```bash
docker compose -f docker/compose.yml --profile app up --build
# http://localhost:8080 (API + frontend)
```

## Scripts

| Script | Descripción |
|---|---|
| `pnpm dev` | Arranca api, worker y web con recarga en caliente |
| `pnpm build` | Compila todos los paquetes |
| `pnpm test` | Ejecuta los tests (Vitest) |
| `pnpm lint` | ESLint + comprobación de tipos |
| `pnpm db:generate` | Genera una migración a partir del esquema |
| `pnpm db:migrate` | Aplica las migraciones pendientes |
| `pnpm db:seed` | Carga datos de ejemplo |
| `pnpm fichas:check` | Valida las fichas YAML y ejecuta sus casos de prueba de cálculo |

## Variables de entorno

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Conexión a Postgres |
| `APP_MODE` | `api`, `worker` o `migrate` (la misma imagen arranca en los tres modos) |
| `DEV_USER_EMAIL` | Solo desarrollo: usuario con el que se identifican las peticiones |
| `STORAGE_DRIVER` / `STORAGE_LOCAL_DIR` | `local` en desarrollo (carpeta en disco) o `gcs` |
| `AUTH_GOOGLE_CLIENT_ID` / `AUTH_GOOGLE_CLIENT_SECRET` | Credenciales OIDC de Google |
| `AUTH_ALLOWED_DOMAIN` | Dominio de correo permitido para iniciar sesión |
| `STORAGE_BUCKET` | Bucket de documentos (con `gcs`) |
| `QUEUE_DRIVER` | `postgres` o `cloudtasks` |
| `GOTENBERG_URL` | URL interna de Gotenberg |
| `AI_PROVIDER` / `AI_MODEL` | Proveedor y modelo de extracción |
| `ENCRYPTION_KEY` | Clave de cifrado en base64 (32 bytes), solo en local |
| `ENCRYPTION_KEY_REF` | Producción: referencia a la clave en Cloud KMS |

Nunca subas `.env` al repositorio.

## Despliegue

GitHub Actions, en cada push a `main`:

1. Lint, tipos y tests (incluido `fichas:check`).
2. Construye la imagen y la sube a Artifact Registry.
3. Aplica migraciones en **staging** y despliega `api` y `worker` en Cloud Run.
4. La promoción a **producción** es manual (aprobación en GitHub).

Servicios en Google Cloud:

- Cloud Run: `certia-api`, `certia-worker`, `certia-gotenberg` (solo acceso interno).
- Cloud SQL (PostgreSQL), conexión privada.
- Cloud Storage: buckets privados para documentos y frontend estático.
- Cloud Tasks y Cloud Scheduler para tareas y alertas.
- Secret Manager y Cloud KMS para secretos y cifrado de datos sensibles.

## Convenciones

- Ramas: `main` (desplegable), `feat/*`, `fix/*`.
- Commits: [Conventional Commits](https://www.conventionalcommits.org/).
- Toda funcionalidad nueva referencia su ID de [FEATURE.md](./FEATURE.md) (por ejemplo, `feat(lotes): F-08 propuesta automática de lotes`).
- Las fichas publicadas son inmutables: un cambio normativo crea una **nueva versión**.
- Los datos personales sensibles (DNI, IBAN) se cifran a nivel de aplicación y nunca aparecen en logs.

## Licencia

Privado. Todos los derechos reservados.
