# Especificación funcional — App personal de presupuesto y gastos

**Versión:** 1.4  
**Fecha:** 29 de septiembre de 2026  
**Nombre de la aplicación:** Margen.  
**Estado:** base funcional para desarrollar y seguir iterando el producto.

## 1. Propósito y alcance del documento

La aplicación permite responder: **«De mi sueldo de este mes, ¿cuánto tengo comprometido en gastos y cuánto me queda disponible?»**

Es una app web de uso personal, para una sola persona, utilizable desde computadora y celular. Reemplaza el uso de una planilla para organizar el presupuesto mensual, las compras con tarjeta, los préstamos y otros gastos.

Este documento describe el comportamiento del producto. No define tecnologías, arquitectura, estructura del repositorio, librerías, infraestructura ni diseño visual.

### Cómo interpretar las definiciones

- **Confirmado:** requisito expresamente elegido o aclarado durante la conversación.
- **Base propuesta:** detalle de funcionamiento que concreta las ideas conversadas; está identificado como propuesta cuando todavía admite una decisión del usuario.
- **Pendiente:** pregunta funcional todavía abierta. No equivale a autorización para añadir esa función.
- **Fuera de alcance:** función que no pertenece a la versión inicial.

Los ejemplos monetarios y las cotizaciones de este documento son ficticios. No representan valores de mercado.

## 2. Decisiones confirmadas

| ID   | Decisión                                                                                                                                                                                                                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-01 | El presupuesto de cada mes es el sueldo que el usuario carga para ese mes, en pesos argentinos. El sueldo de un mes calendario paga lo cargado durante el mes calendario anterior, por lo que la app abre por defecto en el mes de trabajo (mes calendario real + 1). |
| D-02 | Un gasto descuenta del presupuesto desde que queda registrado en el mes correspondiente.                                                                                                                                                                              |
| D-03 | No se lleva seguimiento de pagos: no hay estados «pagado/pendiente», pago mínimo, pago total ni conciliación del resumen.                                                                                                                                             |
| D-04 | Los meses son independientes. No se arrastra el sobrante al mes siguiente. Tampoco se traslada automáticamente un resultado negativo.                                                                                                                                 |
| D-05 | Se registran consumos de tarjetas de crédito BBVA y Supervielle, con totales separados por tarjeta.                                                                                                                                                                   |
| D-06 | Los consumos de tarjeta admiten ARS y USD. El importe ingresado es el de la cuota del mes, no el precio completo de la compra.                                                                                                                                        |
| D-07 | Las cuotas futuras aparecen automáticamente, incrementando su número hasta alcanzar el total de cuotas.                                                                                                                                                               |
| D-08 | Los préstamos son únicamente en ARS. Sus entidades pueden ser BBVA, Supervielle, Mercado Pago u otras ingresadas por el usuario.                                                                                                                                      |
| D-09 | Las cuotas de los préstamos pueden tener importes diferentes. El usuario ya conoce los importes futuros y debe poder cargarlos por anticipado.                                                                                                                        |
| D-10 | También existen otros gastos y gastos que se repiten mensualmente.                                                                                                                                                                                                    |
| D-11 | Los conceptos se escriben libremente; no se exige elegir categorías desde listas desplegables.                                                                                                                                                                        |
| D-12 | Se permite cargar gastos individualmente durante el mes y también varios juntos al revisar un resumen. Ambos flujos usan los mismos registros.                                                                                                                        |
| D-13 | Los USD se convierten a ARS utilizando dólar tarjeta, valor de venta, obtenido mediante un servicio de cotización.                                                                                                                                                    |
| D-14 | Cada mes conserva su cotización aplicada. No se actualiza automáticamente al abrir la app, agregar un consumo o descargar un PDF.                                                                                                                                     |
| D-15 | La actualización de la cotización mensual es explícita. También se contempla poder editarla manualmente.                                                                                                                                                              |
| D-16 | Se puede descargar información en PDF: todos los gastos o una selección de ellos.                                                                                                                                                                                     |
| D-17 | La aplicación debe ser cómoda en computadora y celular, con acceso a la misma información guardada.                                                                                                                                                                   |
| D-18 | Es una herramienta personal, no un producto comercial ni una plataforma para múltiples clientes.                                                                                                                                                                      |

## 3. Conceptos del producto

### Mes presupuestario

Período identificado por mes y año. Como base se usan meses calendario. Contiene el sueldo, los gastos que corresponden a ese período y su cotización de dólar tarjeta, si está definida.

El mes asignado a un gasto no depende necesariamente de la fecha en que se lo carga. Es posible registrar en septiembre una compra cuya primera cuota corresponda a octubre.

**Mes de trabajo:** el sueldo que se cobra en un mes calendario paga lo que se fue cargando durante el mes calendario anterior. Por eso el mes presupuestario que la app muestra por defecto es el mes calendario real + 1 (por ejemplo, en septiembre de 2026 se abre octubre de 2026). Reportes (RF-10) es la excepción: sigue anclado al mes calendario real.

### Gasto mensual

Importe que se computa una sola vez dentro de un mes. Puede ser una compra en un pago, una cuota de tarjeta, una cuota de préstamo o la aparición mensual de un gasto recurrente.

### Plan de cuotas

Una compra o préstamo que tiene una cantidad finita de cuotas. Cada cuota pertenece a un mes y tiene su número e importe. La compra o préstamo que agrupa las cuotas no se suma como un gasto adicional.

### Gasto recurrente

Gasto que se repite mensualmente hasta que se lo detiene. No tiene necesariamente una cantidad total de repeticiones. Puede estar asociado a una tarjeta de crédito o pertenecer a otros gastos.

### Cotización mensual aplicada

Cantidad de ARS por USD guardada para un mes, utilizada para convertir sus consumos en dólares. Se conserva el valor, su origen y la información temporal disponible de la consulta.

### Agrupación y repetición

El grupo al que pertenece un gasto y su forma de repetirse son independientes. Una suscripción mensual de BBVA es un gasto de BBVA y un gasto recurrente, pero se suma una sola vez. Un préstamo de BBVA pertenece a préstamos, no a la tarjeta BBVA.

## 4. RF-01 — Presupuesto mensual

La app abre por defecto en el mes de trabajo (mes calendario real + 1), no en el mes calendario real; el botón «Hoy» lleva a ese mismo mes. Reportes (RF-10) es la excepción explícita: sigue anclado al mes calendario real.

El usuario puede consultar meses anteriores, el de trabajo y meses futuros; ingresar o modificar el sueldo de un mes; y ver sus gastos y disponible.

**Regla principal:**

> Disponible del mes = sueldo del mes − total de gastos del mes expresado en ARS.

El total incluye cuotas de tarjetas, cuotas de préstamos y otros gastos, con los consumos en USD convertidos una sola vez.

El indicador debe llamarse «Disponible del presupuesto» o equivalente. No representa el saldo real de una cuenta bancaria.

### Comportamientos

- Modificar el sueldo afecta únicamente al mes seleccionado.
- Un disponible negativo se muestra como tal, sin ocultarlo ni convertirlo a cero.
- El sobrante de un mes no aumenta el presupuesto del siguiente.
- Un resultado negativo no genera automáticamente un gasto en el mes siguiente.
- Se pueden registrar gastos de un mes aunque todavía no se haya cargado su sueldo.
- Un sueldo no cargado se muestra como «Sin presupuesto definido». No se interpreta como un sueldo de cero.
- Sin sueldo definido, se muestran los gastos conocidos, pero no un disponible definitivo.

**Base propuesta:** permitir «Copiar sueldo del mes anterior» como acción explícita. Nunca copiarlo automáticamente ni copiar con él gastos que ya se generan por cuotas o recurrencias.

## 5. RF-02 — Compras con tarjeta de crédito

### Información de cada compra

| Dato                      | Comportamiento                                                    |
| ------------------------- | ----------------------------------------------------------------- |
| Concepto o producto       | Texto libre obligatorio.                                          |
| Tarjeta                   | BBVA o Supervielle como tarjetas iniciales.                       |
| Moneda                    | ARS o USD.                                                        |
| Importe de la cuota       | Importe correspondiente a la cuota mensual, en la moneda elegida. |
| Número de cuota           | Cuota desde la que se empieza a registrar la compra.              |
| Total de cuotas           | Cantidad total de cuotas de la compra.                            |
| Mes de la cuota ingresada | Mes al que corresponde ese número de cuota.                       |
| Fecha de compra           | Opcional; no determina automáticamente el mes presupuestario.     |

Una compra en un pago equivale a cuota 1 de 1. Se puede presentar una opción «Un pago» para simplificar su carga.

### Ejemplo de continuidad

Al registrar «Notebook · BBVA · ARS 45.000 · cuota 3 de 6 · septiembre de 2026», se obtiene:

| Mes                | Cuota  | Importe    |
| ------------------ | ------ | ---------- |
| Septiembre de 2026 | 3 de 6 | ARS 45.000 |
| Octubre de 2026    | 4 de 6 | ARS 45.000 |
| Noviembre de 2026  | 5 de 6 | ARS 45.000 |
| Diciembre de 2026  | 6 de 6 | ARS 45.000 |

En enero de 2027 no aparece otra cuota. No se exige cargar las cuotas 1 y 2 ni se crean como gastos históricos automáticamente.

### Reglas de continuidad

- Las cuotas avanzan por mes calendario, no por la cantidad de veces que se abre la app.
- No es necesario visitar todos los meses intermedios para consultar correctamente uno posterior.
- Cada cuota aparece una única vez, aunque se vuelva a abrir el mes o se reintente una operación.
- En una compra con cuotas iguales, se conserva el importe original y la moneda en los meses siguientes.
- Una cuota en USD conserva sus USD; su equivalente en ARS usa la cotización del mes correspondiente.
- La última cuota termina el plan. No se agrega otra por defecto.
- El usuario elige el mes de imputación; no se calculan automáticamente fechas de cierre o vencimiento de tarjeta.

## 6. RF-03 — Préstamos

Cada préstamo tiene concepto libre, entidad, número de cuota desde el que se lo registra, total de cuotas, mes correspondiente e importes de sus cuotas.

Las entidades iniciales sugeridas son BBVA, Supervielle y Mercado Pago. El usuario puede escribir otra sin tener que elegirla de un catálogo cerrado.

### Importes variables conocidos

Se debe poder cargar la cuota del mes y, mediante «Completar próximas cuotas», ingresar los distintos importes futuros. La app propone los meses y números de cuota; el usuario completa los montos.

| Mes                | Cuota   | Importe ingresado |
| ------------------ | ------- | ----------------- |
| Septiembre de 2026 | 4 de 12 | ARS 120.000       |
| Octubre de 2026    | 5 de 12 | ARS 117.500       |
| Noviembre de 2026  | 6 de 12 | ARS 115.000       |

Estos valores los aporta el usuario. La aplicación no calcula intereses, amortizaciones, índices ni ajustes del préstamo.

### Reglas

- Los préstamos admiten únicamente ARS.
- Es posible guardar la cuota del mes sin completar todas las siguientes.
- Los importes futuros que se hayan ingresado se respetan individualmente.
- Corregir una cuota no sobrescribe los montos ya definidos para otras cuotas.
- La numeración avanza automáticamente y termina en la última cuota.
- Tener la misma entidad que una tarjeta no mezcla ambos grupos de gastos.

**Base propuesta para importes faltantes:** una cuota futura sin monto muestra «Falta completar importe». No se copia silenciosamente el último valor ni se la trata como un gasto de cero. El mes presenta el subtotal conocido y una advertencia de cálculo incompleto.

## 7. RF-04 — Otros gastos y texto libre

El usuario puede cargar conceptos como «Supermercado», «Veterinaria», «Alquiler» o «Arreglo del auto», sin categorías obligatorias ni jerarquías de clasificación.

Los datos básicos son concepto, importe, moneda y mes. La moneda inicial propuesta es ARS. También se contempla USD para los gastos fuera de tarjetas de crédito que el usuario quiera presupuestar con conversión a pesos.

El medio de pago, cuando se registra, puede distinguir débito, transferencia, efectivo u otro texto libre. Es un dato descriptivo: no habilita seguimiento de saldos ni pagos.

Una compra con débito BBVA no pertenece al total de la tarjeta de crédito BBVA. Como base, los consumos con débito se imputan al mes elegido dentro de otros gastos.

### Preferencias de carga

- Los nombres y conceptos se escriben a mano.
- Las sugerencias de textos anteriores son opcionales y nunca restringen la escritura.
- Para datos acotados, como moneda o una tarjeta existente, se prefieren opciones visibles sin depender de desplegables.
- Entrar desde una tarjeta o un mes propone ese contexto para el formulario.
- No se exige crear categorías ni configurar comercios antes de cargar un gasto.

## 8. RF-05 — Gastos recurrentes mensuales

Los gastos pueden repetirse de una de estas formas: una sola vez, en una cantidad finita de cuotas o mensualmente hasta que el usuario detenga la repetición.

Un recurrente mensual conserva su concepto, agrupación, moneda y regla de importe. Puede ser, por ejemplo, internet en pesos o una suscripción en USD asociada a una tarjeta.

### Base de comportamiento propuesta

- Al crear un recurrente se elige el mes de inicio.
- Para un importe fijo, se repite el valor definido.
- Para un importe variable, se permite corregir el valor de cada mes. Si se utiliza el último monto como referencia para un futuro todavía desconocido, debe indicarse que es estimado.
- Se puede modificar solo la aparición de un mes o el mes elegido y los siguientes.
- Se puede omitir una aparición mensual sin detener todas las siguientes.
- Se puede detener la repetición desde un mes elegido sin borrar el historial anterior.
- Reabrir un mes no vuelve a crear una aparición que ya existe ni una que fue omitida explícitamente.
- La repetición no genera estados de pago.

Un recurrente de tarjeta aparece en el subtotal de esa tarjeta, no también en otros gastos. Se puede identificar como recurrente sin alterar esa regla.

## 9. RF-06 — Totales, monedas y disponible

La aplicación presenta gastos separados por tarjeta de crédito, préstamos y otros gastos. Dentro de préstamos se pueden consultar subtotales por entidad.

### Totales de una tarjeta

Para cada tarjeta se muestra:

1. Subtotal de consumos originales en ARS.
2. Subtotal de consumos originales en USD.
3. Equivalente en ARS de esos USD con la cotización mensual.
4. Total de la tarjeta expresado en ARS.

> Total ARS de una tarjeta = consumos originales ARS + suma de equivalentes ARS de sus consumos USD.

El total mensual suma los grupos sin duplicaciones. No se suman directamente cantidades de pesos y dólares ni se agrega como gasto adicional el equivalente ya incluido.

### Datos incompletos y estimaciones

Debe distinguirse entre un valor conocido, un valor estimado y un dato faltante. Esta distinción describe el cálculo, no si algo se pagó.

Si falta un importe o una cotización necesaria, se conservan los datos originales y se informa que el total no está completo. No se muestra un disponible engañosamente definitivo ni se representa lo faltante como cero.

### Base propuesta de redondeo

Los importes monetarios se presentan con hasta dos decimales. Cada equivalente en ARS se redondea a dos decimales antes de sumar los renglones; cuando el tercer decimal es 5 o mayor, se incrementa el segundo decimal. Los subtotales y el total deben coincidir con la suma de los renglones visibles, tanto en la app como en el PDF.

## 10. RF-07 — Dólar tarjeta y cotización mensual fija

### Obtención inicial

Para el mes actual, al preparar su cotización por primera vez, se obtiene dólar tarjeta, valor de venta, desde un servicio externo. Si se obtiene un dato válido, se guarda como cotización aplicada de ese mes.

Se conserva el importe en ARS por USD, si su origen es consulta automática o edición manual, el momento de consulta o modificación y, cuando la fuente la informa, su fecha de actualización.

La fecha de consulta no debe presentarse como fecha de actualización de la fuente si son distintas.

### Permanencia

- Todos los consumos en USD del mes usan la misma cotización mensual aplicada.
- Los nuevos consumos utilizan la cotización ya guardada.
- Abrir o recargar la app no sustituye ese valor por otro.
- Descargar un PDF no consulta ni aplica una cotización nueva.
- Cambiar la cotización de un mes no cambia la de otros meses.
- El importe y la moneda originales del consumo se conservan.
- No se añade automáticamente otro recargo porcentual sobre la cotización de dólar tarjeta.

### Actualización explícita

La acción «Actualizar cotización» consulta un nuevo valor, pero no lo aplica silenciosamente. Antes de confirmar se muestra la cotización anterior, la nueva y su efecto sobre los gastos y el disponible del mes.

Ejemplo: para USD 100, pasar de ARS 2.000 a ARS 2.050 por USD incrementa el gasto equivalente de ARS 200.000 a ARS 205.000. Cancelar mantiene la cotización y los totales previos.

La edición manual también es una acción explícita y muestra el impacto antes de confirmar. Solo se aceptan cotizaciones válidas mayores que cero.

### Meses futuros

No existe una cotización futura conocida. Se puede mostrar una conversión de referencia claramente identificada, sin presentarla como definitiva.

**Base propuesta:** usar como referencia una cotización anterior guardada, indicando de qué mes proviene. Conservar esa referencia hasta una acción explícita y no vincularla a un valor que cambie silenciosamente. Al llegar ese mes, el usuario puede obtener y aplicar su propia cotización; no se la reemplaza solo por abrir la app.

### Meses pasados

No se usa la cotización actual como si fuera histórica. Para un mes pasado sin cotización se permite ingresar un valor manual y se explica qué valor se aplicará.

La consulta automática de cotizaciones históricas es una posible ampliación, no un requisito de la versión inicial.

### Fallos del servicio

Si falla la consulta o el dato no es válido, se conserva la cotización anterior y se muestra la advertencia. Sin una cotización previa, los USD siguen registrados, pero su conversión queda sin definir hasta obtener un dato válido o cargarlo manualmente.

La cotización es una referencia presupuestaria. No constituye una conciliación con el importe cobrado por un banco.

## 11. RF-08 — Edición, eliminación y conservación del historial

Un gasto individual puede corregirse o eliminarse. Las acciones sobre cuotas o recurrentes deben mostrar su alcance antes de aplicarse.

### Alcances habituales

- **Solo este mes:** modifica únicamente el registro mensual seleccionado.
- **Desde este mes:** modifica las apariciones correspondientes desde el mes elegido, sin alterar las anteriores.
- **Detener futuras apariciones:** deja de generar gastos desde el mes elegido, conservando lo anterior.

Para préstamos con importes individuales ya cargados no se interpreta una corrección puntual como una orden para igualar sus demás cuotas.

### Base propuesta para evitar pérdidas y duplicaciones

Las acciones que eliminan varios registros o afectan meses futuros requieren confirmación, indicando qué meses y registros se modificarán.

Eliminar u omitir una aparición no debe provocar su recreación al volver a abrir el mes. En un plan finito, quitar una cuota mensual aislada no renumera silenciosamente las restantes.

Cambiar estructuras de un plan ya cargado —por ejemplo, desplazar todas las cuotas a otro mes o modificar su cantidad total— requiere resolver primero las reglas pendientes de la sección 19. No debe sobrescribir historial por una suposición.

No existe una acción de «Registrar pago del resumen» que vuelva a descontar sus consumos.

## 12. RF-09 — Carga rápida y carga de varios gastos

### Carga rápida

Se registra un gasto desde la vista del mes o desde uno de sus grupos. El contexto propone mes y tarjeta cuando corresponda, pero el usuario puede corregirlos.

Las acciones principales son «Guardar» y «Guardar y agregar otro». El formulario solicita únicamente los datos necesarios para ese tipo de gasto.

### Carga de varios gastos

El usuario elige una tarjeta y un mes una vez y agrega varios consumos a una lista revisable. Puede corregir o quitar elementos antes de guardar el conjunto.

La moneda y los datos de cuota se ven en cada gasto. No se arrastra inadvertidamente el número de cuota de la compra anterior. No se exige una interfaz de grilla ni edición de celdas como en una planilla.

**Base propuesta de guardado:** el conjunto se valida antes de confirmar. Si no puede guardarse completo, se informa el fallo sin mostrarlo como guardado; un reintento no duplica los gastos. No se deben perder los datos que el usuario estaba ingresando por un error recuperable.

### Flujo mixto

Al revisar un resumen se ven los gastos que ya se anotaron y las cuotas continuadas automáticamente. El usuario agrega lo que falta o corrige lo existente; no comienza un registro independiente del resumen.

**Base propuesta para posibles duplicados:** advertir ante un gasto con tarjeta o grupo, mes, concepto, moneda, importe y cuota coincidentes o muy similares. Se permite revisar el existente o continuar, porque dos compras iguales pueden ser legítimas. La advertencia no debe fusionar ni borrar registros automáticamente.

## 13. RF-10 — Consulta, filtros y selección

Se puede consultar el detalle del mes actual y localizar gastos por concepto, tipo de gasto, tarjeta, entidad y moneda original.

La consulta separa los filtros de visualización de los datos guardados: filtrar no modifica, elimina ni vuelve a imputar ningún gasto.

**Cambio v1.2:** por pedido explícito del usuario se simplificó el
alcance: ya no se elige un mes, un rango o todo el historial — el
reporte es siempre del mes calendario actual, sin selector de alcance.
Además queda **una sola fuente de filtros**: los controles del panel
de filtros (concepto, tipo de gasto, tarjeta/entidad, moneda) deciden
qué se ve y qué se exporta; se eliminaron los botones redundantes
"Seleccionar todo BBVA/Supervielle/…" del panel de selección, que
duplicaban esas mismas categorías con otro control.

### Selección para exportación

- Marcar o desmarcar gastos individuales.
- Seleccionar todos los resultados del filtro actual.
- Limpiar la selección.
- Ver cuántos registros están seleccionados y sus subtotales.

**Base propuesta:** la selección persiste al cambiar filtros dentro de la misma operación de exportación. Si hay gastos seleccionados que no se ven con el filtro actual, se informa expresamente y se permite revisar la selección completa. Cambiar un filtro no agrega gastos a la selección sin una acción del usuario.

Exportar una selección vacía debe estar deshabilitado o explicar que primero se deben seleccionar gastos.

## 14. RF-11 — Descarga en PDF

El usuario puede descargar todos los gastos del mes actual, los resultados de un filtro o una selección manual.

**Cambio v1.2:** el alcance ya no admite rango de meses ni "todo el
historial" — ver el cambio de RF-10. El documento indica siempre el mes
exportado y si se trata de una exportación parcial (filtro o selección
que deja afuera líneas del mes).

### Contenido

- Período o períodos incluidos y fecha de generación.
- Concepto de cada gasto.
- Tarjeta, entidad o grupo cuando corresponda.
- Número de cuota y total de cuotas, si aplica.
- Importe y moneda originales.
- Equivalente en ARS para consumos en USD.
- Subtotales por grupo y moneda, y total equivalente en ARS.

**Cambio v1.1:** por pedido explícito del usuario, el PDF ya no incluye
el detalle de "Cotización aplicada por mes" ni una sección de
"Advertencias" separada — se prefirió un documento más corto. El
equivalente en ARS de cada línea en USD sigue calculándose con la
cotización guardada de su propio mes (eso no cambia, sólo se dejó de
listar aparte); la distinción entre importe conocido/estimado/faltante
sigue visible en cada línea individual.

Se puede incluir u ocultar el sueldo y el disponible. En una exportación parcial, cualquier resumen mensual completo que se incluya debe estar separado y rotulado como contexto, no mezclarse con el total de la selección.

### Reglas de consistencia

- El total de una selección incluye únicamente sus registros.
- No se incluyen gastos ocultos no seleccionados ni registros fuera del alcance elegido.
- Exportar solo una tarjeta no incluye préstamos del mismo banco.
- Los importes coinciden con los datos y la cotización vigentes en la vista revisada para exportar.
- No se obtiene otra cotización durante la descarga.
- Cada mes de un PDF con varios períodos conserva su propia cotización.
- Los USD originales no se suman otra vez al total ARS convertido.
- Cuando faltan datos, el documento identifica el subtotal conocido como incompleto.
- Los documentos de varias páginas deben seguir siendo legibles, sin recortar conceptos o importes.

La descarga no requiere guardar copias del PDF dentro de la app. El PDF es un reporte para consultar o compartir; no se define como mecanismo para restaurar todos los datos.

## 15. RF-12 — Consulta de próximos meses

El usuario puede ver cuánto tiene ya comprometido en los próximos meses en cuotas de tarjeta pendientes (de más de un pago), y cuándo terminan esos planes.

Se distinguen gastos conocidos, importes estimados, conversiones de referencia e información faltante. No se supone que el próximo sueldo será igual al actual.

La ausencia de sueldo no impide consultar gastos futuros. Tampoco obliga a cargar ese sueldo como cero.

Esta vista no pronostica cotizaciones, ingresos ni intereses; organiza compromisos que ya fueron registrados.

Al igual que el presupuesto (RF-01), abre por defecto en el mes de trabajo (mes calendario real + 1).

**Cambio v1.3:** por pedido explícito del usuario se redujo el alcance
de esta vista a compras con tarjeta únicamente — préstamos y gastos
recurrentes ya no aparecen ni en el comprometido del mes ni en "planes
que terminan" (siguen viéndose en sus propias secciones y en
Reportes). Una compra con tarjeta de una sola cuota (pago único) queda
afuera de **toda** esta vista, no sólo de "planes que terminan": ni el
comprometido del mes, ni el disponible estimado, ni la tabla de gastos
la incluyen, aunque se haya cargado en el mes que se está viendo — un
pago único no tiene ninguna cuota pendiente que mostrar acá (sí sigue
viéndose con normalidad en el resumen del mes y en Reportes). Se
corrigió además un cálculo erróneo del mes de fin: cuando la primera
cuota cargada de una compra no es la número 1 (por ejemplo, se empezó
a registrar desde la última cuota), el fin ahora se calcula a partir
del número de cuota real de esa
ocurrencia, no asumiendo siempre que la primera cargada es la cuota 1.

**Cambio v1.4:** por pedido explícito del usuario, el sueldo que se cobra
en un mes calendario paga lo cargado durante el mes calendario anterior,
para todo tipo de gasto. Por eso el presupuesto y esta vista abren por
defecto en el mes de trabajo (mes calendario real + 1) y el título de la
sección de gastos del presupuesto pasó de «Gastos de {mes}» a «A pagar
en {mes}». Reportes (RF-10) no cambia: sigue en el mes calendario real.

## 16. RF-13 — Acceso privado y uso en dos dispositivos

La información es privada y pertenece al único usuario de la aplicación. Se necesita un acceso protegido; no se requiere registro público, invitaciones, equipos ni roles comerciales.

Computadora y celular utilizan la misma información guardada. Un gasto guardado desde uno debe poder consultarse desde el otro al actualizar sus datos.

No se exige edición colaborativa ni actualización instantánea permanente. Si una edición entra en conflicto con cambios más recientes de otro dispositivo, no se debe sobrescribir información silenciosamente.

No se solicitan contraseñas bancarias, números completos de tarjeta, códigos de seguridad ni acceso a cuentas de bancos. Los nombres BBVA y Supervielle identifican agrupaciones, no conexiones bancarias.

La aplicación debe permitir cargar, editar, revisar cuotas, seleccionar gastos y descargar PDF desde ambos tipos de dispositivo. El diseño visual concreto se definirá por separado.

## 17. Validaciones y comportamiento ante errores

### Base propuesta

- Concepto obligatorio y no compuesto solo por espacios.
- Importes de gastos mayores que cero y con hasta dos decimales. El tratamiento de reintegros o importes negativos queda pendiente.
- Sueldo mayor o igual que cero cuando se ingresa expresamente; «no cargado» es distinto de cero.
- Cuota actual y total de cuotas como números enteros positivos, con cuota actual menor o igual al total.
- Mes y año válidos para todo gasto imputado.
- ARS y USD como únicas monedas iniciales; préstamos solo en ARS.
- Cotizaciones mayores que cero y con su precisión conservada para el cálculo.
- Presentación de números y fechas adecuada a español de Argentina. La entrada debe explicar el formato y evitar interpretar silenciosamente un separador ambiguo.
- Un error al guardar no presenta el gasto como persistido.
- Un reintento o doble activación de «Guardar» no crea duplicados del mismo envío.
- Las operaciones de solo consulta no cambian cotizaciones, importes ni historial.
- Sin conexión, se informa la imposibilidad de guardar cuando corresponda. La carga offline y su posterior sincronización no son requisito inicial.
- La edición y selección deben poder operarse con teclado y controles identificables, además de interacción táctil.

## 18. Fuera de alcance de la versión inicial

No se implementan seguimiento de pagos, pagos mínimos, pagos parciales, liquidación del resumen, saldos bancarios, conciliación, transferencias entre cuentas ni contabilidad de doble partida.

Tampoco se incluyen cálculo automático de intereses, amortización de préstamos, conexión con bancos, lectura automática de resúmenes, importación de archivos de gastos, reconocimiento de comprobantes ni carga mediante un asistente conversacional dentro de la app.

Quedan fuera presupuestos por categoría, clasificación obligatoria, objetivos de inversión o ahorro, monedas adicionales, arrastre de saldos entre meses, actualización silenciosa del dólar y cálculo automático de cierres de tarjetas.

No se requiere una app móvil nativa, operación offline, colaboración entre usuarios, funciones comerciales, cobros por suscripción ni administración de clientes.

Usar agentes de IA para desarrollar el proyecto no implica incorporar funciones de IA al producto.

## 19. Ampliaciones y preguntas funcionales pendientes

Estas cuestiones no bloquean el núcleo confirmado. No deben considerarse nuevas funcionalidades aprobadas por defecto.

| ID   | Cuestión                                                                                                   | Base o límite mientras no se resuelva                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-01 | ¿Se necesita registrar devoluciones, reintegros o descuentos negativos?                                    | No añadir un sistema de créditos o compensaciones. Permitir corregir gastos existentes; consultar antes de ampliar el cálculo a movimientos negativos.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| P-02 | ¿Se necesita fijar un equivalente ARS particular para un consumo USD que difiera de la cotización mensual? | Todos los USD usan la misma cotización del mes. La corrección manual prevista es la de esa cotización; una excepción por consumo requiere definir cómo se muestra y recalcula.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| P-03 | ¿Se podrán agregar, renombrar y archivar más tarjetas de crédito?                                          | Garantizar BBVA y Supervielle. No borrar historial al cambiar sus etiquetas. La gestión ampliada se define antes de construir su interfaz.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| P-04 | ¿Cómo se reprograma un plan si cambia el mes de una cuota o la cantidad total después de registrar varias? | **Resuelto para compras con tarjeta (RF-02, v1.1):** el usuario puede corregir concepto, tarjeta, moneda, importe de cuota y total de cuotas de una compra ya cargada. La corrección se aplica «desde este mes» (RF-08): el mes editado y los siguientes se regeneran con los valores nuevos; los meses anteriores al editado no se tocan. **Resuelto también para préstamos (RF-03):** la edición de un préstamo (concepto, entidad, total de cuotas) se aplica desde el mes editado en adelante y reprograma mes y número de cuota, pero **nunca sobrescribe los importes ya cargados** de otras cuotas; los meses anteriores al editado tampoco se tocan. **Resuelto también para gastos recurrentes (RF-05), con una regla propia:** como sus apariciones se generan mes a mes por una acción explícita (nunca todas de una vez), editar concepto/agrupación/moneda cambia el plan igual que en préstamos y tarjetas, pero editar el importe fijo sólo actualiza «desde este mes» las apariciones ya generadas que todavía coincidían con el importe anterior — una excepción puntual que el usuario ya haya cargado distinta nunca se pisa. Detener la repetición (`stop_recurring_plan`) conserva todo lo generado antes del mes elegido. Sigue pendiente trasladar una cuota a un mes distinto del que ya tiene asignado. |
| P-05 | ¿Hace falta marcar meses como revisados y protegerlos de ediciones accidentales?                           | No existe cierre obligatorio. La estabilidad inicial depende de no alterar datos ni cotizaciones sin una acción explícita.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| P-06 | ¿Se añade descarga y restauración de una copia recuperable de los datos?                                   | Es una ampliación recomendable para conservación de información; no reemplazarla por un PDF ni asumir que ya existe una función de restauración.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| P-07 | ¿Qué alcance temporal resulta más cómodo para la vista de próximos meses?                                  | Se puede navegar por meses. Una cantidad fija de meses visibles y gráficos comparativos se decidirán con el diseño.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## 20. Criterios de aceptación funcional

Estos escenarios permiten verificar el comportamiento sin depender de una tecnología específica.

| ID    | Escenario                                                            | Resultado esperado                                                                                 |
| ----- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| CA-01 | Sueldo ARS 1.500.000 y gastos conocidos ARS 600.000.                 | Disponible ARS 900.000, sin consultar estados de pago.                                             |
| CA-02 | Gastos mayores que el sueldo.                                        | Disponible negativo visible; no se arrastra al siguiente mes.                                      |
| CA-03 | Se abre un mes con gastos, pero sin sueldo.                          | Se ven los gastos y «Sin presupuesto definido», sin asumir sueldo cero.                            |
| CA-04 | Sobran ARS 100.000 al terminar un mes.                               | No se agregan al sueldo del siguiente mes.                                                         |
| CA-05 | Se carga cuota 3 de 6 en septiembre.                                 | Aparecen 4 de 6 en octubre, 5 de 6 en noviembre, 6 de 6 en diciembre y ninguna en enero.           |
| CA-06 | Se empieza a registrar una compra desde cuota 3 de 6.                | No se exige ni se crea automáticamente el gasto histórico de las cuotas 1 y 2.                     |
| CA-07 | Se abre noviembre sin haber visitado octubre.                        | La cuota de noviembre tiene la numeración correcta.                                                |
| CA-08 | Se reabre un mes varias veces o se reintenta el mismo guardado.      | No se duplican cuotas ni gastos del mismo envío.                                                   |
| CA-09 | Se cargan cuotas de préstamo ARS 120.000, ARS 117.500 y ARS 115.000. | Cada mes muestra su importe específico; no se igualan entre sí.                                    |
| CA-10 | Se intenta cargar un préstamo en USD.                                | Se rechaza la moneda y se explica que los préstamos solo admiten ARS.                              |
| CA-11 | Una cuota futura de préstamo no tiene importe.                       | Se informa el faltante y el total conocido queda identificado como incompleto.                     |
| CA-12 | Una suscripción recurrente pertenece a BBVA crédito.                 | Se incluye una sola vez en BBVA, no además en otros gastos.                                        |
| CA-13 | Un préstamo y una tarjeta pertenecen a BBVA.                         | Sus subtotales permanecen separados.                                                               |
| CA-14 | Una compra se registra con débito BBVA.                              | No se suma al total de la tarjeta de crédito BBVA.                                                 |
| CA-15 | Se cargan USD 20 con cotización mensual ARS 2.000.                   | Se conservan USD 20 y se computan ARS 40.000.                                                      |
| CA-16 | La fuente cambia su cotización, pero el usuario solo abre la app.    | La cotización aplicada y los totales guardados no cambian.                                         |
| CA-17 | Se agrega otro consumo USD al mismo mes.                             | Usa la cotización ya guardada, sin obtener una nueva para ese gasto.                               |
| CA-18 | El usuario consulta una cotización nueva y cancela su aplicación.    | No se modifica el presupuesto ni la cotización mensual.                                            |
| CA-19 | Se actualiza explícitamente la cotización de septiembre.             | Solo se recalculan las conversiones de septiembre; otros meses no cambian.                         |
| CA-20 | Falla la consulta de dólar tarjeta.                                  | Se conserva el valor anterior o se informa la falta de cotización; nunca se convierte usando cero. |
| CA-21 | Se carga un gasto pasado sin cotización histórica.                   | No se aplica silenciosamente la cotización actual.                                                 |
| CA-22 | Se anotó una compra durante el mes y luego se revisa el resumen.     | La compra ya está visible y puede editarse sin crear otro registro.                                |
| CA-23 | Se ingresa una compra muy similar a una existente.                   | Se advierte el posible duplicado y se permite confirmar una compra distinta.                       |
| CA-24 | Se modifica solo una aparición de un recurrente.                     | No cambian los meses anteriores ni los siguientes.                                                 |
| CA-25 | Se detiene un recurrente desde noviembre.                            | Los meses anteriores se conservan; desde noviembre no se generan nuevas apariciones.               |
| CA-26 | Se exportan tres gastos seleccionados de diez.                       | El PDF contiene esos tres y el total de esos tres, identificado como parcial.                      |
| CA-27 | Se exporta un filtro que contiene solo BBVA crédito.                 | No se incluyen préstamos BBVA ni otras tarjetas.                                                   |
| CA-28 | Se exportan varios meses con distintas cotizaciones.                 | Cada gasto USD usa la cotización de su propio mes.                                                 |
| CA-29 | Se descarga un PDF después de revisar los importes.                  | Coincide con esos datos; la descarga no aplica una nueva cotización.                               |
| CA-30 | Se guarda un gasto desde el celular y se actualiza la computadora.   | Se consulta el mismo gasto, no un registro independiente por dispositivo.                          |
| CA-31 | Se suman los importes visibles de un grupo.                          | Coinciden con el subtotal, incluido el redondeo, tanto en pantalla como en PDF.                    |
| CA-32 | Un filtro oculta parte de la selección de exportación.               | Se informa que existen seleccionados fuera de la vista y se puede revisar el conjunto.             |

### Ejemplo integral de cálculo

Sueldo del mes: ARS 1.500.000. Cotización aplicada: ARS 2.000 por USD.

| Gasto                            | Grupo               | Original    | Equivalente ARS |
| -------------------------------- | ------------------- | ----------- | --------------- |
| Notebook, cuota 3 de 6           | BBVA crédito        | ARS 45.000  | ARS 45.000      |
| Suscripción mensual              | BBVA crédito        | USD 20      | ARS 40.000      |
| Zapatillas, cuota 1 de 3         | Supervielle crédito | ARS 30.000  | ARS 30.000      |
| Préstamo personal, cuota 4 de 12 | Préstamos BBVA      | ARS 120.000 | ARS 120.000     |
| Alquiler mensual                 | Otros gastos        | ARS 300.000 | ARS 300.000     |

Subtotal BBVA crédito: ARS 85.000. Subtotal Supervielle crédito: ARS 30.000. Préstamos: ARS 120.000. Otros gastos: ARS 300.000.

**Total de gastos: ARS 535.000. Disponible: ARS 965.000.**

Al actualizar explícitamente la cotización de ese mes a ARS 2.050 por USD, la suscripción pasa a equivaler ARS 41.000. El total resulta ARS 536.000 y el disponible ARS 964.000. Los USD 20 originales y los demás importes no cambian.
