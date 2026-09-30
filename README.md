# Margen

Aplicación web personal para responder una pregunta simple: **«De mi sueldo de este mes, ¿cuánto tengo comprometido en gastos y cuánto me queda disponible?»**

Margen reemplaza la planilla con la que se organiza el presupuesto mensual: compras con tarjeta en cuotas, préstamos, gastos recurrentes y otros gastos, todo en pesos argentinos y con soporte de consumos en dólares. Es una herramienta de uso personal, para una sola persona, pensada para usarse desde la computadora y desde el celular.

## Funcionalidades

- **Presupuesto mensual:** sueldo por mes, total comprometido y disponible. Los meses son independientes: no se arrastran saldos.
- **Compras con tarjeta:** consumos en ARS o USD de BBVA y Supervielle, con cuotas que avanzan solas mes a mes.
- **Préstamos:** en ARS, con importes de cuota distintos por mes.
- **Gastos recurrentes y otros gastos:** conceptos libres, sin categorías obligatorias.
- **Dólar tarjeta:** cotización mensual fija, que se actualiza solo por una acción explícita del usuario y nunca de forma silenciosa.
- **Carga rápida y por lotes:** guardar y agregar otro, duplicar y cargar varios gastos juntos, con aviso de posibles duplicados.
- **Reportes:** consulta con filtros por rango de meses, selección de gastos y descarga en PDF.
- **Próximos meses:** proyección de lo ya comprometido para los meses siguientes.
- **Acceso privado:** inicio de sesión con email y contraseña, con datos aislados por usuario.

El comportamiento completo, con las reglas de negocio y los criterios de aceptación, está en [`FUNCTIONALITY.md`](./FUNCTIONALITY.md).

> **Mes de trabajo:** el sueldo que se cobra en un mes calendario paga lo cargado durante el mes anterior. Por eso la app abre por defecto en el mes calendario real + 1. Reportes es la excepción: sigue anclado al mes real.

## Stack

| Área            | Tecnologías                                                       |
| --------------- | ----------------------------------------------------------------- |
| Interfaz        | React 19, TypeScript 6 (`strict`), Vite 8                         |
| Estilos         | Tailwind CSS 4, componentes propios sobre Base UI (estilo shadcn) |
| Rutas           | React Router 8                                                    |
| Datos remotos   | TanStack Query 4, Supabase (Postgres, Auth, RLS)                  |
| Formularios     | React Hook Form, Zod                                              |
| Dinero          | decimal.js, sin aritmética monetaria con `number`                 |
| PDF             | @react-pdf/renderer                                               |
| Pruebas         | Vitest, Testing Library, Playwright                               |
| Calidad y flujo | ESLint, Prettier, Husky, lint-staged, commitlint, GitHub Actions  |

## Primeros pasos

### Requisitos

- Node.js (versión LTS)
- [pnpm](https://pnpm.io) `10.33`, definido en `packageManager` (se activa con `corepack enable`)
- Un proyecto de [Supabase](https://supabase.com) con las migraciones de `supabase/migrations` aplicadas

### Instalación

```bash
pnpm install
cp .env.example .env.local
```

Completá `.env.local` con los datos de tu proyecto de Supabase:

```bash
VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<clave publishable>
```

> Estas variables quedan expuestas en el navegador. Usá únicamente la clave **publishable**, nunca una clave privilegiada (`service_role`). La protección de los datos la dan las políticas RLS de la base, no el cliente.

```bash
pnpm dev
```

La app queda disponible en `http://localhost:5173`.

## Scripts

| Comando               | Qué hace                                                            |
| --------------------- | ------------------------------------------------------------------- |
| `pnpm dev`            | Servidor de desarrollo                                              |
| `pnpm build`          | Comprueba tipos y genera el build de producción en `dist/`          |
| `pnpm preview`        | Sirve el build de producción                                        |
| `pnpm lint`           | ESLint sobre todo el repositorio                                    |
| `pnpm typecheck`      | Verificación de tipos de la app y de la configuración de Vite       |
| `pnpm test`           | Pruebas unitarias y de integración (Vitest)                         |
| `pnpm test:watch`     | Vitest en modo observador                                           |
| `pnpm format`         | Prettier sobre los archivos `.ts` y `.tsx`                          |
| `pnpm supabase:types` | Regenera `database.types.ts` desde el proyecto de Supabase enlazado |

Las pruebas end to end de Playwright se ejecutan con `pnpm exec playwright test`; levantan el build y lo sirven solas.

## Estructura del proyecto

El código se organiza por funcionalidades del producto, no por capas técnicas:

```text
src/
  app/                  # Router, layout general (cabecera, tabs), páginas 404 y de error
  components/ui/        # Primitivas de interfaz (estilo shadcn sobre Base UI)
  features/
    auth/               # Inicio de sesión y protección de rutas
    monthly-budget/     # Presupuesto del mes, sueldo, cotización y "Limpiar todo"
    card-purchases/     # Compras con tarjeta y sus cuotas
    loans/              # Préstamos
    recurring-expenses/ # Gastos recurrentes
    other-expenses/     # Otros gastos
    upcoming-expenses/  # Próximos meses
    reports/            # Filtros, selección y PDF
  shared/lib/           # Dinero, períodos, cliente de Supabase y tipos generados
supabase/migrations/    # Esquema, funciones y políticas versionados
e2e/                    # Pruebas end to end
```

Dentro de cada feature, las reglas de negocio viven en `model/` como funciones puras, sin depender de React ni de Supabase; el acceso a datos está en `api/` y las pruebas en `tests/`.

## Base de datos

El esquema, las funciones de base de datos que aplican operaciones completas (como generar cuotas o limpiar un mes) y las políticas de seguridad están versionados en `supabase/migrations`. Cada tabla pertenece a un único usuario y queda aislada mediante RLS (`auth.uid()`).

Las migraciones nuevas se aplican al proyecto remoto de forma explícita con la CLI de Supabase; el repositorio no las ejecuta por su cuenta. Tras un cambio de esquema, regenerá los tipos con `pnpm supabase:types`.

## Calidad y flujo de trabajo

- **Trunk-based:** sin ramas de feature ni pull requests. Todo se commitea directo en `main`, en unidades de trabajo, con [Conventional Commits](https://www.conventionalcommits.org).
- **Hooks locales (Husky):**
  - `pre-commit`: lint-staged y verificación de tipos.
  - `commit-msg`: valida el formato del mensaje con commitlint.
  - `pre-push`: pruebas unitarias y de integración.
- **CI:** GitHub Actions corre en cada `push` a `main` los jobs de lint, typecheck, pruebas unitarias, build y e2e.
- **Pruebas por riesgo:** se prioriza proteger cálculos, cuotas y recurrencias, persistencia sin duplicados, reportes y aislamiento de datos, en lugar de buscar cobertura total.

## Despliegue

La app se despliega en [Vercel](https://vercel.com) desde `main`:

- Preset **Vite**, sin comandos personalizados: Vercel detecta pnpm, el build y `dist/`.
- Variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` cargadas en el proyecto.
- [`vercel.json`](./vercel.json) reescribe todas las rutas a `index.html`, necesario para que las URL internas (como `/months/2026/10`) funcionen al recargar.
- En Supabase, en **Authentication → URL Configuration**, la URL de producción debe figurar como _Site URL_ y en _Redirect URLs_.

## Documentación

| Documento                                | Contenido                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| [`FUNCTIONALITY.md`](./FUNCTIONALITY.md) | Qué debe hacer el producto: requisitos, reglas y criterios de aceptación |
| [`AGENTS.md`](./AGENTS.md)               | Cómo desarrollar: convenciones de código, arquitectura y pruebas         |
