# Análisis competitivo: flota-frigorifico vs. software de mantenimiento de flotas del mercado

## 1. Estado actual del proyecto

Revisé la carpeta `flota-frigorifico`. Antes de comparar, es importante ser honesto sobre el punto de partida: hoy el proyecto es un scaffold de Next.js recién inicializado con `create-next-app`, sin funcionalidades de negocio implementadas todavía. `app/page.tsx` es la plantilla por defecto de Next.js (el logo y los links de "Getting Started"), y no existen carpetas `prisma/`, `lib/` ni `components/` con lógica propia. No hay modelo de datos, ni pantallas de camiones, órdenes de trabajo, mantenimiento o temperatura.

Lo que sí está definido es el stack elegido en `package.json`, que muestra hacia dónde apunta el proyecto: Next.js 16 + React 19, Prisma 7 sobre PostgreSQL para el modelo de datos, NextAuth v5 para autenticación, React Hook Form + Zod para formularios y validación, TanStack Table para listados de datos, Recharts para dashboards, Vercel Blob + browser-image-compression para fotos (ideal para checklists de inspección), y shadcn/ui + Tailwind para la interfaz.

Esto cambia el tipo de comparación posible: no puedo comparar "función por función" porque todavía no hay funciones construidas. Lo que sigue es una comparación de mercado y una hoja de ruta priorizada para que, a medida que construyas en Claude Code, sepas contra qué estás compitiendo y dónde diferenciarte.

## 2. Panorama competitivo

| Competidor | Categoría | Fortalezas clave |
|---|---|---|
| Fleetio | Mantenimiento preventivo + inventario | Programación automática por km/horas/tiempo, órdenes de trabajo con costos y mano de obra, inventario de repuestos con puntos de reposición, directorio de integraciones con telemática |
| Whip Around | Inspecciones (DVIR) + compliance | Checklists digitales con fotos, inspección electrónica auditable, abre órdenes de trabajo automáticamente a partir de códigos de falla de Samsara/Geotab/Motive |
| Fullbay | Taller pesado (heavy-duty) | Ciclo completo de reparación: cotización, aprobación del cliente, seguimiento técnico y facturación en un solo flujo |
| Samsara | Telemática + monitoreo de frío | Alertas de temperatura en menos de 90 segundos, apoyo a cumplimiento FSMA, video-telemetría y mantenimiento en una sola plataforma de hardware + software |
| ORBCOMM | Especialista en cadena de frío | Más del 80% del mercado de telemática para semirremolques frigoríficos; comandos remotos de dos vías (encender/apagar/ajustar setpoint), sensores multi-zona |
| Motive (ex KeepTruckin) | ELD + mantenimiento + seguridad | Cumplimiento normativo (ELD/HOS en EE. UU.), cámaras con IA, diagnóstico de fallas en tiempo real |
| Moviloc / SITca / Transportex (Argentina) | Gestión de flota local | Precios en pesos, soporte local, gestión de turnos de VTV, pensados para el marco regulatorio argentino, pero con foco más en ruta/costos que en mantenimiento predictivo |
| Fracttal | CMMS mantenimiento industrial/transporte | Mantenimiento inteligente aplicable a flotas, fuerte en gestión de activos en general |

## 3. Puntos fuertes de los competidores, en conjunto

Mirando el mercado en general (no un solo competidor), estos son los puntos donde son consistentemente más fuertes que un desarrollo propio recién empezado:

Tienen un ecosistema de integraciones ya armado con telemática, ELD y tarjetas de combustible, en vez de tener que construir cada sensor o protocolo desde cero. Hacen mantenimiento predictivo real basado en uso (kilómetros, horas motor, códigos de falla del motor), no solo en calendario. Ofrecen apps móviles para chofer y mecánico que funcionan offline, con checklists fotográficos. Manejan inventario de repuestos con reposición automática y trazabilidad de costos por unidad. Tienen cumplimiento normativo integrado (DVIR, HOS/ELD en EE. UU.; en tu mercado sería el equivalente con VTV, RTO y documentación de la unidad). Los especializados en frío (Samsara, ORBCOMM) monitorean temperatura en tiempo real con alertas multicanal y control remoto del equipo de frío, algo central para vos por ser frigorífico. Y en general tienen un producto maduro: onboarding, soporte, actualizaciones constantes, años de validación en campo con miles de flotas.

## 4. Pros y contras de tu proyecto frente al mercado

**A favor tuyo (potenciales, dado el stack elegido):**

Es un desarrollo a medida: podés modelar exactamente tu operación (tus rutas, tipos de camión, tus propios sensores) sin pagar por módulos genéricos que no usás. El costo marginal por licencia es cero frente a SaaS que cobran por vehículo/mes (Samsara, ORBCOMM suelen atar el software a hardware propietario caro). Podés localizar todo en español, en pesos y adaptado a normativa argentina (VTV, RTO, SENASA, facturación AFIP), algo que ningún jugador grande prioriza. El stack (Next.js 16, Prisma 7, Postgres) es moderno y te da control total de tus datos, sin depender de exportar información sensible de tu operación a un tercero. Y queda abierto para integrar en el futuro el hardware de sensores que vos elijas, sin atarte a un proveedor de telemática específico.

**En contra (hoy):**

No hay ninguna funcionalidad construida: ni modelo de datos, ni autenticación, ni una sola pantalla de negocio. No hay telemetría ni IoT: falta toda integración de sensores de temperatura, GPS o lectura de códigos de falla del motor, que es justamente lo que los competidores ya resuelven con hardware certificado. No tenés años de iteración ni validación en campo como tienen ellos, ni soporte 24/7, ni apps nativas móviles todavía. Vas a tener que construir vos mismo cosas que en el mercado "vienen incluidas": app offline para choferes, integraciones con ELD, cumplimiento normativo, gestión de firmware de sensores. Y no tenés efecto de red ni ecosistema de integraciones (Fleetio tiene marketplace de apps; Whip Around se conecta nativamente con Samsara, Geotab y Motive).

## 5. Sugerencias para llegar a la par (roadmap de funcionalidades básicas)

**Fase 1 — Fundaciones.** Definir el schema de Prisma con las entidades centrales: Unidad/Camión, Conductor, Orden de Trabajo, Repuesto/Inventario, Proveedor, Registro de Temperatura y Alerta. Configurar NextAuth con roles (administrador de flota, mecánico, chofer, responsable de calidad).

**Fase 2 — Mantenimiento preventivo básico.** Programación de mantenimiento por kilómetros, horas de motor o fecha (equivalente a lo que hace Fleetio). Órdenes de trabajo con estado, costos, mano de obra y repuestos utilizados. Inventario de repuestos con alertas de stock mínimo.

**Fase 3 — Inspecciones y compliance.** Checklist digital pre-viaje y post-viaje (equivalente a un DVIR) con fotos; tu stack ya trae `browser-image-compression` y `Vercel Blob`, que encajan perfecto para esto. Registro de VTV/RTO, seguros y documentación por unidad, con recordatorios de vencimiento.

**Fase 4 — Cadena de frío, tu diferencial obligado.** Integración con sensores de temperatura (vía API de un proveedor de hardware o sensores propios Bluetooth/LoRa/4G). Alertas en tiempo real de rotura de cadena de frío, con umbrales configurables según el tipo de mercadería. Reporte de trazabilidad de temperatura por viaje, exportable para auditorías de SENASA o de tus clientes.

**Fase 5 — Dashboards y analítica.** Ya tenés Recharts en el stack: costo de mantenimiento por camión, disponibilidad de flota, próximos vencimientos. TanStack Table para listados filtrables de órdenes de trabajo, camiones y repuestos.

## 6. Oportunidades de diferenciación (más allá de igualar al mercado)

Ningún jugador grande (Fleetio, Samsara, Motive) está optimizado para la normativa e idiosincrasia del transporte frigorífico en Argentina, y los locales (Moviloc, SITca, Transportex) no muestran mantenimiento predictivo fuerte ni una experiencia de usuario moderna. Ahí hay espacio real.

Concretamente, podrías diferenciarte combinando en una sola herramienta lo que hoy se resuelve con dos o tres sistemas distintos: mantenimiento de flota, monitoreo de temperatura y gestión de calidad/trazabilidad. Un modelo de costos por disponibilidad de flota en vez de por vehículo/mes con hardware propietario caro bajaría la barrera de entrada para transportistas frigoríficos chicos y medianos que hoy no pueden pagar Samsara u ORBCOMM. También hay lugar para alertas proactivas que crucen señales (por ejemplo, un camión con historial de fallas de motor, asignado a una ruta larga, con carga sensible a temperatura, como prioridad automática de mantenimiento). Un módulo de "auditoría lista para el cliente o SENASA" con un clic, que genere un PDF con la trazabilidad completa del viaje (temperatura, mantenimiento al día, checklist firmado), sería un diferencial fuerte y poco común. Y una integración nativa con AFIP/facturación electrónica y remitos es algo que el software genérico americano directamente no contempla.
