# AGENTS.md

Instrucciones de desarrollo para agentes que trabajen en este repositorio. Priorizar corrección, legibilidad y simplicidad. Es una aplicación personal: no diseñar una plataforma comercial ni incorporar funcionalidades no solicitadas.

## 1. Contexto funcional y documentación

- Antes de implementar comportamiento, localizar y leer el documento funcional. La ruta propuesta es `docs/FUNCIONALIDAD.md`; si el repositorio usa `FUNCIONALIDAD.md`, `FUNCTIONALITY.md` o `functionality.md` en otra ubicación, utilizar ese archivo sin renombrarlo ni duplicarlo. Si hay varias versiones incompatibles, preguntar cuál es la fuente de verdad.
- `AGENTS.md` explica cómo desarrollar; el documento funcional explica qué debe hacer el producto. No copiar aquí toda la especificación ni introducir arquitectura en el documento funcional.
- Respetar la distinción entre requisitos confirmados, bases propuestas, pendientes y fuera de alcance. Los pendientes no son autorización para implementar funciones nuevas. Si una propuesta afecta una decisión relevante todavía abierta, consultar antes de convertirla en comportamiento definitivo.
- Una solicitud explícita del usuario puede cambiar una decisión anterior. Si el cambio es claro, actualizar el requisito y sus criterios de aceptación en la misma tarea. Si hay contradicción o ambigüedad material, explicarla y preguntar antes de modificar ese comportamiento.
- No reescribir requisitos para justificar una implementación incorrecta. Un refactor sin cambios observables no requiere modificar la especificación funcional.
- Conservar los identificadores de requisitos y criterios existentes. Actualizar versión o fecha al introducir un cambio funcional real e informar qué se modificó.
- No debilitar estas reglas ni añadir excepciones al propio `AGENTS.md` sin autorización. El diseño visual se define por separado; no iniciar un rediseño global por iniciativa propia.

### Idioma y nombres

- Usar inglés para identificadores del código y nombres de archivos y carpetas nuevos: componentes, funciones, hooks, variables, tipos y módulos. Mantener nombres coherentes para los conceptos del dominio, como `expense`, `installment`, `loan`, `monthlyBudget` y `exchangeRate`, y respetar el estilo de nombres configurado en el repositorio.
- Mantener en español el contenido de la interfaz: etiquetas, botones, ayudas, validaciones, errores orientados al usuario y textos accesibles. Los PDF y demás reportes para el usuario también deben estar en español.
- Escribir la documentación del proyecto y las respuestas de entrega de los agentes en español. Conservar los identificadores, comandos y nombres técnicos originales dentro de ejemplos y referencias.
- Los comentarios dentro del código se escriben en inglés. Solo se agregan cuando explican una decisión, una restricción o un motivo que el código no deja evidente por sí solo (ver criterio de comentarios en la sección 5); si el código puede reescribirse para explicarse solo, se prefiere esa vía antes que agregar un comentario.
- Respetar los nombres propios, contratos externos y nombres de archivo convencionales, como `AGENTS.md`, `README.md` y `package.json`. Conservar el nombre y la ruta del documento funcional existente, incluido `FUNCIONALIDAD.md`; esta convención no autoriza renombrados masivos ni duplicar documentación.
- Esta separación de idiomas no implica soporte multilingüe. No incorporar internacionalización ni dependencias de traducción sin una necesidad y autorización explícitas.

## 2. Forma de trabajo y límites de autonomía

- Antes de editar, revisar instrucciones aplicables, estado de Git, estructura existente, `package.json`, lockfile, scripts y configuraciones relevantes. Comprobar qué librerías y versiones están realmente instaladas; no asumirlas a partir de una recomendación anterior.
- Para tareas de varias partes, explicar brevemente el alcance y los riesgos. Hacer el cambio mínimo coherente que resuelva la tarea completa, no simplemente el menor número de líneas.
- No instalar, añadir, actualizar, reemplazar ni eliminar dependencias, herramientas o servicios sin autorización explícita. Incluye dependencias de desarrollo, CLIs, instalaciones globales y navegadores para pruebas. Una herramienta faltante, aunque esté declarada, no habilita a instalarla automáticamente.
- No eludir esa regla con `npx`, `pnpm dlx`, generadores, comandos de shadcn, descargas ejecutables ni cambios indirectos del lockfile. Ejecutar herramientas ya disponibles no equivale a autorizar instalaciones nuevas. Antes de proponer una dependencia, explicar el problema, la alternativa con lo existente y su costo de mantenimiento.
- Respetar el gestor de paquetes y el formato configurados. No regenerar lockfiles, cambiar de gestor, reformatear todo el repositorio ni introducir una librería duplicada para resolver el mismo problema.
- No aplicar migraciones remotas, desplegar, modificar recursos de producción ni ejecutar operaciones destructivas sin autorización explícita para esa acción y entorno. Preparar una migración versionada no autoriza a ejecutarla en remoto.
- Preservar cambios previos del usuario. No revertir, borrar, hacer commit, push ni modificar el historial de Git sin que forme parte de lo solicitado.
- Preguntar ante cambios de comportamiento no definidos, permisos, costos o riesgo de pérdida de datos. Para detalles locales reversibles, seguir las convenciones existentes sin pedir aprobación por cada función o archivo. Si una parte queda bloqueada, avanzar con lo independiente e informar el límite.
- Flujo de Git de este proyecto: trunk-based, sin ramas de feature ni pull requests. Todo el trabajo se commitea directamente en `main`, en work units con Conventional Commits. El CI corre únicamente sobre `push` a `main`.

## 3. TypeScript y contratos

- Mantener `strict: true`. No desactivar verificaciones para resolver errores. No usar `any`, explícito ni implícito, en código propio, pruebas ni mocks.
- Tipar props, parámetros, callbacks, contratos de datos y límites de módulos. Aprovechar la inferencia cuando sea precisa: no anotar cada variable o retorno de componente de manera redundante. Usar retornos explícitos cuando estabilicen un contrato público o aclaren una función de dominio.
- Usar `unknown` para datos realmente desconocidos y validarlos o estrecharlos antes de operar. Validar entradas externas en sus límites; una aserción `as` no sustituye una validación.
- No ocultar errores con `as any`, dobles aserciones `as unknown as T`, `@ts-ignore`, aserciones no nulas injustificadas ni desactivaciones amplias del linter. `@ts-expect-error` solo en pruebas deliberadas del sistema de tipos o excepciones expresamente autorizadas, con explicación precisa.
- Preferir uniones discriminadas cuando haya variantes incompatibles. No crear objetos con muchos campos opcionales que permitan combinaciones inválidas. No crear jerarquías genéricas, tipos nominales ni utilidades de tipos complejas sin una necesidad real.
- Inferir tipos desde esquemas o tipos generados cuando corresponda; no mantener contratos equivalentes a mano. No editar artefactos generados ni declaraciones de terceros solo para imponer el estilo del proyecto. Contener tipos inseguros externos en un límite validado, sin propagarlos al dominio.
- Revisar `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` como endurecimiento recomendado, no como permiso para rehacer el proyecto. Proponer su activación si faltan; conservarlos si ya están habilitados.
- Configurar la prohibición de `any` con el linter existente cuando la tarea incluya esa configuración. No instalar plugins sin permiso. Mantener los tests bajo verificación de tipos; ejecutar pruebas no reemplaza ejecutar TypeScript.

## 4. Componentes, funciones y hooks

- Todos los componentes propios deben ser funcionales, con función flecha y exportación nombrada: `export const ComponentName = ...`. No usar componentes de clase ni `export default` para componentes propios.
- Preferir funciones flecha asignadas a `const` para funciones y hooks propios. Exportar únicamente lo que necesite otro módulo: no convertir todos los helpers privados en API pública.
- Un retorno implícito es preferible cuando contiene una expresión breve y clara. No comprimir validaciones, múltiples decisiones, ternarios anidados o efectos en una línea. La legibilidad y el formateador prevalecen sobre ahorrar líneas.
- Usar nombres descriptivos. Componentes en PascalCase y hooks con prefijo `use`. Una función pura que no usa hooks no debe convertirse en hook solo por utilizarse desde React. Respetar las convenciones existentes de nombres de archivos.
- Cada componente, función y hook debe tener una responsabilidad coherente y una razón clara para cambiar. No imponer límites arbitrarios de líneas ni exigir un archivo por cada helper.
- Favorecer componentes presentacionales que reciben datos y callbacks. Extraer reglas de dinero, cuotas, fechas, transformación de datos y persistencia. No crear automáticamente un par contenedor/vista o un hook por cada componente.
- Puede permanecer en el componente la lógica local de interfaz: abrir un diálogo, alternar una vista, manejar foco, condiciones simples de renderizado o un formulario que no gane claridad al extraerse. Separar una lógica únicamente si mejora comprensión, independencia, reutilización o pruebas.
- Los hooks coordinan comportamiento con React y, cuando corresponde, consultas o mutaciones. Las reglas de negocio reutilizables deben poder ejecutarse como funciones puras sin montar React.
- Usar efectos para sincronización con sistemas externos, no para almacenar totales derivados, responder indirectamente a un clic ni copiar datos remotos a otro estado. Los eventos explícitos deben iniciar sus acciones explícitas.
- No añadir `memo`, `useMemo` o `useCallback` por rutina. Usarlos por una necesidad concreta de costo, identidad o integración; no para corregir un modelo de estado defectuoso.

Ejemplo del estilo de componentes propios:

```tsx
type ExpenseAmountProps = {
  formattedAmount: string
}

export const ExpenseAmount = ({ formattedAmount }: ExpenseAmountProps) => (
  <span>{formattedAmount}</span>
)
```

Las convenciones de exportación de componentes no prohíben un `export default` requerido o convencional en archivos de configuración de herramientas. Si una integración exige una excepción real en código de aplicación, explicar el motivo y pedir autorización en vez de introducirla silenciosamente.

## 5. Programación funcional, DRY y simplicidad

- Preferir funciones puras, composición, transformaciones explícitas e inmutabilidad de los datos compartidos. Aislar acceso a red, almacenamiento, reloj y otros efectos de las reglas de cálculo.
- No mutar props, estado de React, caché de consultas ni objetos recibidos de otro módulo. La mutación local de un objeto nuevo y no compartido es aceptable si hace la función más sencilla y no produce efectos observables externos.
- Aplicar DRY al conocimiento y a las reglas de negocio, no a cualquier similitud de sintaxis. Una pequeña duplicación de interfaz puede ser preferible a una abstracción llena de flags.
- Extraer código compartido cuando haya responsabilidad compartida real o una razón clara de aislamiento o prueba. No generalizar por usos futuros imaginarios ni exigir un número fijo de repeticiones.
- Usar patrones solo si resuelven un problema presente. No añadir fábricas, contenedores de inyección, repositorios genéricos, buses de eventos ni múltiples capas que solo reenvían argumentos.
- Preferir código directo a composición excesivamente abstracta. No introducir librerías de programación funcional ni arquitecturas adicionales por el nombre del patrón.
- Los comentarios deben explicar decisiones, restricciones y motivos no evidentes. No narrar lo que una línea ya expresa. Evitar nombres genéricos como `manager`, `helper` o `utils` para responsabilidades que pueden nombrarse por su función.

## 6. Arquitectura basada en funcionalidades

Organizar el código por capacidades del producto. El árbol debe mostrar presupuesto, gastos, préstamos, recurrencias, cotizaciones y reportes antes que capas técnicas globales. Esta organización no obliga a adoptar todas las capas de Clean Architecture ni una metodología adicional.

Ejemplo orientativo, no una orden de crear todos estos directorios:

```text
src/
  app/                         # Arranque, providers, rutas y composición
  features/
    monthly-budget/
    expenses/
      components/
      hooks/
      api/
      model/                   # Tipos, esquemas y reglas de esta feature
      tests/
        unit/
        integration/
        e2e/
    loans/
    recurring-expenses/
    exchange-rates/
    reports/
    auth/
  shared/
    ui/
    lib/                       # Módulos específicos, no un cajón de utilidades
    tests/
```

- Crear únicamente los archivos y subdirectorios necesarios. Una feature pequeña puede empezar con pocos archivos. No forzar todas a tener la misma estructura interna ni rehacer estructura válida preexistente solo por coincidir con el ejemplo.
- Mantener juntos UI, acceso a datos y reglas que pertenezcan a una feature. No crear carpetas globales gigantes de `components`, `hooks` y `services` para el código del negocio.
- `shared` no debe importar features. Reservarlo para infraestructura o capacidades realmente compartidas, como primitivas de UI o reglas monetarias comunes, no para esconder acoplamiento.
- Evitar ciclos entre features. Componer flujos transversales en `app` o en la feature dueña del caso de uso. Cuando una feature necesite otra, utilizar un contrato público pequeño y explícito, no sus archivos internos arbitrariamente.
- No crear `index.ts` masivos que reexporten todo ni una fachada adicional para cada archivo. Elegir el límite mínimo que mantenga claras las dependencias.
- Mantener las reglas puras independientes de React, TanStack Query y el cliente de Supabase. Evitar llamadas directas a Supabase o a APIs externas desde componentes presentacionales.
- Conservar los aliases y ubicaciones de shadcn ya configurados. No mover componentes generados ni reescribirlos masivamente por razones cosméticas.

## 7. Estado, consultas y formularios

- Usar las herramientas realmente presentes en el repositorio. Cuando existan TanStack Query, React Hook Form, Zod, Zustand y Supabase, mantener responsabilidades separadas.
- TanStack Query gestiona consultas y caché de datos remotos. No duplicar presupuestos y gastos persistidos en Zustand o Context como segunda fuente de verdad.
- Reservar Zustand, si está instalado y aporta valor, para estado de interfaz compartido o borradores. Preferir estado local para interacciones locales; la URL puede representar mes, navegación y filtros compartibles.
- Los formularios son dueños de sus valores transitorios. No guardar cada pulsación en un store global ni recrear un motor de formularios sobre la librería existente.
- Derivar totales y valores calculables de sus entradas, en vez de mantener copias sincronizadas mediante efectos. Compartir la misma política de cálculo entre pantalla y exportación.
- Las claves de consulta deben distinguir los datos que representan, incluido usuario, mes y filtros relevantes. Invalidar o actualizar la caché correspondiente tras una mutación; limpiar datos sensibles al cerrar sesión.
- Los renders, consultas y recargas deben ser libres de escrituras persistentes. Reconsultar una cotización mensual guardada no equivale a consultar y aplicar un nuevo valor de mercado. La generación persistente de cuotas debe pertenecer a una operación explícita; una proyección de lectura no debe guardar registros ocultamente.
- Manejar carga, error, resultado vacío y datos incompletos como estados distintos. No mostrar errores como totales cero ni perder un borrador por un fallo recuperable. No introducir persistencia offline por iniciativa propia.

## 8. Precisión, integridad y seguridad

- Aplicar las reglas funcionales vigentes de dinero, redondeo, períodos y dólar tarjeta. No realizar aritmética monetaria dispersa con `number` ni usar `toFixed` como sustituto de una política decimal. Utilizar la solución decimal ya adoptada sin perder precisión en conversiones intermedias.
- Representar explícitamente moneda y período mensual. No sumar ARS y USD sin conversión ni tratar un mes presupuestario como un instante que pueda desplazarse por zona horaria. Sumar meses calendario, no bloques de 30 días.
- No introducir estados de pago, arrastre de saldos ni actualizaciones silenciosas de la cotización. Los importes faltantes no son cero. Para reglas detalladas y cambios de alcance, consultar el documento funcional.
- Proteger guardados y generación de cuotas frente a reintentos y doble envío con integridad en el backend, no solo deshabilitando un botón. No confundir la identidad de un mismo envío con dos gastos legítimos de igual concepto e importe.
- Las operaciones que deban guardarse completas deben ser atómicas. Respetar historial, alcances de edición y conflictos entre dispositivos; no sobrescribir silenciosamente cambios más recientes.
- Con Supabase, mantener RLS y políticas de autorización para los datos expuestos. La UI y la validación del cliente no son controles de acceso. Las funciones de backend deben validar identidad, pertenencia y entradas.
- Versionar cambios de esquema y permisos mediante migraciones; mantener actualizados los tipos generados y los contratos afectados. No mantener tipos de tablas a mano si existe generación configurada.
- No incluir secretos ni claves privilegiadas de Supabase en el frontend, logs, fixtures o repositorio. Una variable expuesta al bundle no debe contener secretos. Mantener ejemplos de entorno sin credenciales reales.
- No registrar datos financieros personales para depuración ni usar cuentas o bases de producción en pruebas. Evitar construir SQL con concatenación de entradas del usuario.

## 9. Pruebas basadas en riesgo

No buscar cobertura total ni escribir un test por archivo. Elegir pruebas según el daño que produciría una regresión y el costo de detectarla y repararla. Usar el nivel más pequeño que proteja de verdad ese riesgo.

| Prioridad             | Riesgos que deben quedar protegidos al trabajar en esa parte                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| Cálculos              | Totales, disponible, conversión, redondeo y datos faltantes.                                              |
| Cuotas y recurrencias | Secuencia y fin, cambio de año, importes variables, omisiones y conservación del historial.               |
| Persistencia          | Doble envío, reintentos, operaciones completas y errores que puedan perder un borrador o duplicar gastos. |
| Reportes              | Solo exportar la selección, separar grupos y mantener importes y cotizaciones de cada mes.                |
| Seguridad             | Rechazo de acceso no autorizado y aislamiento de los datos por sesión o propietario.                      |

- Preferir unitarios para reglas puras e integración para formularios, persistencia, restricciones y permisos. Los mocks de Supabase no demuestran que una política RLS o una transacción funcionen: comprobar esas garantías en un entorno de prueba real y autorizado.
- Añadir E2E únicamente cuando el riesgo dependa del flujo completo y no esté suficientemente cubierto por pruebas menores. Ejemplos útiles: cargar una compra y verificar su persistencia tras recargar, o seleccionar registros y descargar el PDF correcto. No crear un E2E por variante de validación.
- No testear detalles internos de librerías, getters triviales, envoltorios sin comportamiento ni componentes puramente decorativos por rutina. Evitar snapshots masivos, selectores acoplados al DOM interno y pruebas de detalles de implementación.
- Una corrección de un bug importante debe incorporar una prueba de regresión cuando sea viable. No debilitar aserciones, borrar tests ni cambiar expectativas para ocultar un fallo.
- Usar datos ficticios y resultados deterministas. Controlar reloj, cotizaciones y respuestas externas; no depender del dólar en vivo ni de servicios de producción para pasar la suite.
- Guardar pruebas de cada feature en `src/features/<feature>/tests/`, nunca como archivos sueltos junto a componentes, hooks o funciones. Crear `unit/`, `integration/` y `e2e/` solo cuando aporten orden.
- Un E2E transversal pertenece a `tests/e2e/` de la feature dueña del flujo; no duplicarlo en todas las features participantes. Las pruebas de utilidades compartidas pertenecen a `shared/tests/` o al directorio `tests/` de su módulo compartido.
- Mantener fixtures y utilidades específicas dentro de esos directorios de pruebas. Compartir infraestructura de testing únicamente cuando tenga varios consumidores reales.

## 10. Verificación y entrega

- Descubrir los comandos reales en `package.json`, documentación y configuración; usar el gestor indicado por el lockfile. No asumir nombres como `test`, `typecheck` o `lint` ni inventar comandos de instalación.
- Ejecutar las comprobaciones existentes pertinentes: TypeScript, lint, pruebas de riesgo afectadas y build cuando corresponda. Un cambio exclusivamente documental no exige pruebas de aplicación; revisar entonces contenido, rutas y coherencia.
- Si falta infraestructura, una dependencia autorizada no está disponible o una verificación requiere credenciales, informar el bloqueo. No instalar herramientas ni contactar producción para resolverlo por cuenta propia.
- Revisar el diff antes de terminar: alcance, errores, secretos, archivos accidentales y coherencia con estas reglas y la especificación. No convertir una tarea puntual en una limpieza general.
- Entregar un resumen en español con qué cambió, qué verificaciones se ejecutaron y su resultado, qué no se pudo verificar y qué decisiones quedan pendientes. No afirmar que un test pasó si no se ejecutó ni presentar un mock como una integración terminada.
- Priorizar código que el usuario pueda entender y mantener. Si una solución necesita demasiadas capas o explicaciones para una necesidad pequeña, revisar si existe una alternativa más directa.
