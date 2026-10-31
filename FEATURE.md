# Certia — Funcionalidades del MVP

Prioridades:

- **P0**: imprescindible para el piloto con los socios de diseño.
- **P1**: entra en el MVP si el plan se cumple; es lo primero que se recorta.
- **Fase 2**: fuera del MVP, documentado para no perderlo.

Cada funcionalidad tiene un ID (`F-xx`) que se usa en ramas, commits y tareas.

## Resumen

| ID | Funcionalidad | Prioridad | Semanas |
|---|---|---|---|
| F-01 | Login, organizaciones, usuarios y roles | P0 | 1–2 |
| F-02 | Registro de eventos y auditoría | P0 | 1–2 |
| F-03 | Motor de fichas y cálculo de ahorro | P0 | 3–4 |
| F-04 | Contactos, leads y expedientes | P0 | 3–4 |
| F-05 | Extracción de datos con IA y revisión | P1 | 15–21 |
| F-06 | Portal de subida y normalización de documentos | P0 | 5–7 |
| F-07 | Comparador de versiones de ficha | P1 | 15–21 |
| F-08 | Checklist documental | P0 | 5–7 |
| F-09 | Generación de documentos con plantillas | P0 | 8–9 |
| F-10 | Lotes | P0 | 10–11 |
| F-11 | Paquetes de verificación y emisión | P0 | 10–11 |
| F-12 | Tareas y subsanaciones | P0 | 12 |
| F-13 | Semáforo de atascos | P0 | 12 |
| F-14 | KPIs y objetivos por persona | P1 | 15–21 |
| F-15 | Importación de expedientes | P0 | 13–14 |
| F-16 | Cifrado de datos sensibles | P0 | 1–14 |
| F-17 | Búsqueda y listados filtrables | P0 | 3–12 |

---

## F-01 · Login, organizaciones, usuarios y roles — P0

**Como** miembro del equipo de una empresa cliente, **quiero** entrar con mi cuenta corporativa **para** no gestionar otra contraseña y ver solo los datos de mi empresa.

Criterios de aceptación:

- Cada organización tiene su dominio de correo; solo pueden entrar cuentas de ese dominio.
- Login con Google en el MVP; Microsoft en una fase posterior.
- Ningún usuario puede ver ni modificar datos de otra organización; hay tests que lo comprueban en cada endpoint.
- El equipo de Certia da de alta organizaciones y su primer administrador.
- Un administrador de la organización asigna uno o varios roles: administrador, dirección, gestión, verificación, lectura.
- Un usuario desactivado en su proveedor de identidad pierde el acceso en su siguiente petición.
- Cada endpoint de la API comprueba el rol; ocultar un botón en la interfaz no basta.
- El beneficiario accede **solo** a su portal mediante un enlace firmado y con caducidad, sin cuenta.

## F-02 · Registro de eventos y auditoría — P0

**Como** dirección, **quiero** saber quién cambió qué y cuándo **para** tener trazabilidad y no depender de notas manuales.

Criterios de aceptación:

- Cada creación, cambio de estado, edición de campo, subida o generación de documento crea un evento.
- Los eventos no se pueden editar ni borrar desde la aplicación.
- Cada expediente y cada lote muestran su historial cronológico.
- Las consultas a datos sensibles (DNI, IBAN) también quedan registradas.

## F-03 · Motor de fichas y cálculo de ahorro — P0

**Como** equipo técnico, **quiero** definir cada ficha como configuración **para** añadir tipos de actuación sin cambiar el código del motor.

Criterios de aceptación:

- Una ficha define: código, versión, vigencia, campos, fórmula, documentos requeridos, reglas de agrupación, plantillas, reglas de empaquetado y flujo.
- Las fichas se validan al arrancar y en CI (`pnpm fichas:check`); una ficha inválida impide el despliegue.
- Cada ficha incluye casos de prueba de cálculo que deben pasar en CI.
- La fórmula se evalúa con un evaluador seguro, sin ejecutar código arbitrario.
- Un expediente queda anclado a una versión concreta de ficha.
- MVP: ficha de vehículo eléctrico en su versión anterior y vigente.

## F-04 · Contactos, leads y expedientes — P0

**Como** gestor, **quiero** ver y trabajar cada expediente en una sola pantalla **para** no tener que actualizar varias hojas.

Criterios de aceptación:

- Los formularios web crean el lead directamente en Certia mediante un endpoint público protegido contra abuso.
- Se guarda el canal de origen del lead.
- Convertir un lead crea el contacto y el expediente con la ficha elegida.
- El expediente muestra: datos del beneficiario, campos de la ficha, documentos, ahorro calculado, estado, responsable, tareas e historial.
- Los cambios de estado respetan las transiciones definidas en la ficha y explican qué falta cuando una transición no es posible.
- Se puede reasignar el responsable de un expediente.
- **Tipo de beneficiario**: persona física o persona jurídica. El tipo determina los campos de identificación (DNI/NIE o CIF y representante legal) y los documentos que pide la checklist (F-08), por ejemplo la escritura de poderes solo para personas jurídicas.
- **Observaciones como historial**: cada nota se guarda con fecha y autor automáticos, y se muestra en orden cronológico junto a los cambios de estado. La última nota es visible en el listado (F-17). Nadie escribe la fecha a mano ni edita notas de otros.

## F-05 · Extracción de datos con IA y revisión — P1

**Como** gestor, **quiero** que los datos se rellenen solos a partir de los documentos **para** revisar en lugar de teclear.

Criterios de aceptación:

- Al subir un documento, el worker lo clasifica por tipo y extrae los campos que la ficha asocia a ese tipo.
- Cada campo extraído guarda su valor, el documento de origen y un nivel de confianza.
- La pantalla de revisión muestra el documento junto a los campos, con los dudosos destacados.
- Ningún dato extraído se considera válido hasta que una persona lo confirma.
- Si la extracción falla, el documento queda marcado para entrada manual, sin bloquear el expediente.
- **Plan B si se recorta:** formulario de entrada manual con el documento visible al lado.

## F-06 · Portal de subida y normalización de documentos — P0

**Como** beneficiario, **quiero** subir mis documentos desde el móvil **para** no tener que enviarlos por email.

Criterios de aceptación:

- El portal muestra qué documentos faltan, en lenguaje claro.
- Acepta PDF, JPG, PNG y HEIC, incluidas fotos de móvil.
- Cada archivo se convierte a PDF, se renombra según la convención y se comprime por debajo del límite configurado (10 MB por defecto).
- Se conserva el original junto a la versión normalizada.
- El equipo también puede subir documentos desde la ficha del expediente.
- Los documentos se guardan en un bucket privado y solo se sirven mediante enlaces temporales.

## F-07 · Comparador de versiones de ficha — P1

**Como** gestor, **quiero** ver el ahorro de un expediente con la versión anterior y la vigente de la ficha **para** elegir la más favorable para el beneficiario.

Criterios de aceptación:

- Para un expediente, muestra lado a lado el ahorro y la remuneración estimada con cada versión aplicable.
- Indica qué datos o documentos adicionales requiere cada versión.
- Cambiar la versión del expediente queda registrado como evento.

## F-08 · Checklist documental — P0

**Como** gestor, **quiero** saber de un vistazo qué falta en cada expediente **para** pedirlo al beneficiario cuanto antes.

Criterios de aceptación:

- La checklist se genera a partir de los documentos requeridos por la ficha, incluidos los condicionales.
- Cada documento tiene estado: pendiente, subido, validado o rechazado (con motivo).
- Desde la checklist se puede enviar al beneficiario un email con lo que falta y su enlace al portal.
- El expediente solo puede pasar a "completo" con todos los obligatorios validados.

## F-09 · Generación de documentos con plantillas — P0

**Como** gestor, **quiero** generar el acuerdo de cesión y la declaración responsable con un clic **para** no editar plantillas a mano.

Criterios de aceptación:

- Las plantillas son archivos Word con variables, versionados con la ficha.
- Las cláusulas opcionales se activan con casillas al generar el documento, sin editar la plantilla.
- El documento generado se guarda en el expediente en PDF, con la plantilla, la versión y las opciones usadas.
- Si falta algún dato obligatorio para la plantilla, la generación se bloquea y se indica qué falta.
- Solo administradores pueden modificar plantillas.

## F-10 · Lotes — P0

**Como** responsable de verificación, **quiero** que el sistema me proponga lotes **para** no calcularlos a mano.

Criterios de aceptación:

- Vista de expedientes completos agrupados por las claves de la ficha (comunidad autónoma y año), con el ahorro acumulado frente al mínimo.
- Indica también los expedientes casi completos que podrían sumarse a cada grupo.
- Crear un lote a partir de una propuesta o seleccionando expedientes manualmente.
- No se puede pasar el lote a "preparado" si no alcanza el mínimo o mezcla claves incompatibles.
- Se pueden añadir o retirar expedientes mientras el lote no se haya enviado.
- El lote registra verificador, fechas de envío y respuesta.

## F-11 · Paquetes de verificación y emisión — P0

**Como** responsable de verificación, **quiero** generar el paquete de un lote con un clic **para** evitar rechazos por formato.

Criterios de aceptación:

- Genera el ZIP con la estructura de carpetas, la nomenclatura y los anexos que exige la ficha.
- Valida nombres (caracteres no permitidos, longitud) y tamaños antes de generarlo, con un informe de errores.
- Genera el convenio o documento agrupado del lote a partir de su plantilla.
- Paquetes distintos para verificación y para emisión.
- Cada paquete generado queda guardado y asociado al lote, con su fecha.

## F-12 · Tareas y subsanaciones — P0

**Como** responsable de verificación, **quiero** registrar cada requerimiento como una tarea asignada a gestión **para** que nada se pierda entre departamentos.

Criterios de aceptación:

- Una tarea se vincula a un expediente o a un lote.
- Campos: descripción, origen (previsión, verificador, gestor autonómico), responsable, prioridad y fecha límite.
- Las tareas del gestor autonómico tienen prioridad máxima por defecto.
- Un lote o expediente con tareas abiertas lo muestra claramente.
- Vista "mis tareas" para cada usuario, ordenada por prioridad y vencimiento.
- Completar una tarea queda registrado en el historial.

## F-13 · Semáforo de atascos — P0

**Como** dirección, **quiero** ver lo que lleva demasiado tiempo parado **para** actuar sobre lo más urgente.

Criterios de aceptación:

- Lista de expedientes y lotes ordenada por días sin cambio de estado, con colores según umbrales configurables por estado.
- Filtros por responsable, estado, comunidad autónoma y verificador.
- Los estados que dependen de terceros (por ejemplo, en emisión) se distinguen de los que dependen del equipo.
- Se calcula automáticamente a partir de los eventos, sin entrada manual.

## F-14 · KPIs y objetivos por persona — P1

**Como** dirección, **quiero** ver el avance de cada persona frente a su objetivo mensual **para** gestionar bonificaciones sin hojas aparte.

Criterios de aceptación:

- Objetivos mensuales configurables por usuario y métrica (por ejemplo, expedientes con dictamen favorable, expedientes emitidos, solicitudes de verificación).
- Avance calculado a partir de los eventos, con proyección a fin de mes.
- Cada usuario ve sus propios KPIs; dirección ve los de todos.
- Exportación a CSV.

## F-15 · Importación de expedientes — P0

**Como** administrador de una organización nueva, **quiero** importar mis expedientes y lotes existentes **para** empezar a usar Certia sin perder historial.

Criterios de aceptación:

- Importación desde archivos CSV o Excel exportados de las herramientas actuales del cliente.
- Mapeo configurable de columnas y de estados antiguos a estados nuevos.
- Modo simulación que muestra un informe de lo que se importaría y los errores, sin escribir nada.
- Importación idempotente: repetirla no duplica registros.
- Importación de documentos existentes desde un archivo ZIP o una carpeta, asociándolos a su expediente.

## F-16 · Cifrado de datos sensibles — P0

**Como** responsable de protección de datos, **quiero** que el DNI y los datos bancarios estén cifrados **para** limitar el impacto de cualquier fuga.

Criterios de aceptación:

- DNI, IBAN y titular de la cuenta se cifran antes de guardarse; la clave no está en la base de datos.
- Para buscar por DNI se usa un hash, nunca el valor en claro.
- Solo los roles autorizados ven los valores descifrados, y cada consulta queda registrada.
- Los datos sensibles nunca aparecen en logs ni en mensajes de error.
- Documentos de identidad solo accesibles con enlaces temporales.

## F-17 · Búsqueda y listados filtrables — P0

**Como** usuario, **quiero** encontrar cualquier expediente o lote rápidamente **para** dejar de buscar en hojas de cálculo.

Criterios de aceptación:

- Búsqueda por nombre, DNI (exacto), matrícula, referencia de expediente o de lote.
- Listados con filtros por estado, responsable, ficha, comunidad autónoma, año y lote.
- Los filtros se pueden guardar como vistas personales.
- Exportación del listado filtrado a CSV.

---

## Fase 2 (fuera del MVP)

| ID | Funcionalidad | Nota |
|---|---|---|
| F-18 | Alta de organizaciones en autoservicio | Registro, verificación del dominio y primer administrador sin intervención del equipo de Certia |
| F-19 | Suscripción y facturación del servicio | Planes, facturas con IVA y cobro recurrente |
| F-20 | Pagos a beneficiarios | Validación de titularidad, control de duplicados, estados de pago por lote |
| F-21 | Remesas SEPA de pago | Fichero de remesa para el banco a partir de los pagos aprobados |
| F-22 | Venta y facturación de CAE | Compradores, contratos, facturas |
| F-23 | Conexión contable o ERP | A definir según el sistema del cliente |
| F-24 | Nuevas fichas | Priorizadas por la demanda; la segunda, muy distinta de la primera para validar el motor |
| F-25 | Editor visual de fichas | Solo si el volumen de cambios lo justifica |
| F-26 | Recordatorios automáticos a verificadores | Sobre la base del semáforo (F-13) |
| F-27 | WhatsApp y llamadas desde el expediente | Integración con proveedor a elegir |
| F-28 | Portal para verificadores | Descarga directa de paquetes con acceso controlado |
| F-29 | Firma electrónica | Solo en los supuestos que admita la normativa |
| F-30 | Formularios de captación externos | Los formularios de la web del cliente (WordPress u otros) envían leads a Certia mediante un formulario embebible o un endpoint con clave por organización |
| F-31 | Sincronización temporal con hojas de cálculo | Durante la transición, leer y escribir en la hoja actual del cliente (Google Sheets) para convivir con ella hasta retirarla |
| F-32 | Buzón de entrada de documentos | Una dirección de correo por organización: los documentos recibidos por email se asocian al expediente por referencia o remitente |
| F-33 | Correo desde la cuenta del cliente | Enviar los correos al beneficiario desde un buzón del propio cliente (Google o Microsoft) mediante su API, sin guardar contraseñas |
| F-34 | Agente de expediente | Flujo con pasos de IA que avanza cada expediente y propone; una persona confirma. Detalle abajo |
| F-35 | Base de conocimiento con RAG | Normativa común con citas y memoria de subsanaciones por organización. Detalle abajo |

### F-34 · Agente de expediente

**Como** gestor, **quiero** que cada expediente se revise solo al llegar documentación **para** dedicarme a confirmar y resolver excepciones, no a teclear.

Se construye por fases:

1. **Revisión automática** (amplía F-05): al entrar un documento, por el portal o por email (F-32), se clasifica, se extraen los campos de la ficha y se validan documentos entre sí (mismo titular, mismo NIF, misma matrícula, fechas en plazo). Recalcula el ahorro y la checklist.
2. **Siguiente paso propuesto**: si falta algo o hay incoherencias, redacta la petición al beneficiario; si está completo, propone pasar a "completo".
3. **Requerimientos**: lee los requerimientos de verificadores y gestores autonómicos, crea las tareas (F-12) y propone qué documento o respuesta atiende cada uno, apoyándose en F-35.

Criterios de aceptación:

- Es un flujo definido con pasos de IA, ejecutado por el worker; no un agente libre que decide qué hacer.
- El agente **propone y una persona confirma**: no envía correos, no cambia estados críticos y no envía paquetes sin aprobación.
- Cada propuesta guarda su origen, su confianza y su justificación; quién la aprobó o corrigió queda en el historial (F-02).
- Las herramientas del agente son funciones de Certia (leer expediente y documentos, calcular, comprobar checklist, crear propuesta, redactar correo), siempre limitadas a la organización del expediente.
- Qué extraer y qué validar sale de la ficha: una ficha nueva no exige reprogramar el agente.
- Proveedor de IA desplegado en la UE y con contrato que impida usar los datos para entrenar.

### F-35 · Base de conocimiento con RAG

**Como** gestor, **quiero** preguntar dudas normativas y ver cómo se resolvieron casos parecidos **para** decidir rápido y con fundamento.

Dos espacios separados:

1. **Normativa común**: Real Decreto 36/2023, catálogo de fichas con todas sus versiones, procedimientos de cada comunidad autónoma, preguntas frecuentes oficiales y criterios publicados por verificadores. Solo fuentes públicas.
2. **Memoria de cada organización**: requerimientos recibidos y cómo se resolvieron, visibles solo para esa organización.

Criterios de aceptación:

- Asistente en la aplicación que responde **siempre con cita** (documento y apartado); si no hay fuente, lo dice en lugar de inventar.
- La normativa está versionada por fecha: una consulta sobre un expediente usa la norma vigente en su fecha.
- Aviso de cambios cuando se publica una nueva versión de una ficha o un procedimiento.
- Índices en Postgres con pgvector, en la misma base de datos; la memoria de cada organización se filtra siempre por `organization_id`.
- Sin datos personales en los índices: de los requerimientos se indexa el contenido, nunca nombres, DNI ni direcciones.
- El cálculo del ahorro **nunca** depende de RAG: lo hace siempre el motor de fichas (F-03).
