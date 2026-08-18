# Plan de mantenimiento preventivo — actividades del mecánico interno y drivers de control

Basado en los estándares de la industria (Fleetio, Whip Around, Thermo King/Carrier) relevados en el análisis competitivo anterior. Cada actividad tiene un driver de control: KM (kilometraje del camión), HORAS (horas de uso de un motor/equipo específico), CALENDARIO (tiempo fijo) o EVENTO (vencimiento puntual o inspección de rutina). Este listado está pensado para cargarse directo como plantilla de "planes de mantenimiento" en tu sistema (tabla `PlanMantenimiento`: sistema, actividad, tipoDriver, valorFrecuencia).

## 1. Motor y powertrain

| Actividad | Driver de control | Frecuencia |
|---|---|---|
| Cambio de aceite y filtro de aceite del motor | KM | Cada 15.000–20.000 km (ajustar según análisis de aceite) |
| Cambio de filtro de combustible | KM | Cada 15.000–20.000 km |
| Cambio de filtro de aire del motor | KM | Cada 30.000–45.000 km, con inspección visual mensual |
| Inspección de correas y mangueras del motor | KM | Cada 20.000 km, cambio preventivo a los 100.000 km o 2 años |
| Cambio de refrigerante del motor | CALENDARIO / KM | Cada 2 años o 200.000 km, lo que ocurra primero |

## 2. Transmisión y tren motriz

| Actividad | Driver de control | Frecuencia |
|---|---|---|
| Cambio de aceite de caja de cambios | KM | Cada 80.000–100.000 km |
| Cambio de aceite de diferencial | KM | Cada 80.000–100.000 km |
| Lubricación de crucetas / cardán | KM | Cada 20.000–25.000 km |
| Inspección y lubricación de rodamientos de rueda | KM / CALENDARIO | Cada 40.000 km o 1 año |

## 3. Frenos

| Actividad | Driver de control | Frecuencia |
|---|---|---|
| Inspección de pastillas/campanas y sistema neumático | KM | Cada 20.000 km |
| Cambio de cartucho desecante del secador de aire | CALENDARIO / KM | Cada 12 meses o 100.000 km |
| Purga de tanques de aire | EVENTO | Diaria (checklist del chofer) |

## 4. Neumáticos y suspensión

| Actividad | Driver de control | Frecuencia |
|---|---|---|
| Rotación de cubiertas | KM | Cada 20.000 km (ejemplo dado) |
| Alineación | KM / EVENTO | Cada 40.000 km o ante desgaste irregular detectado |
| Control de presión de inflado | EVENTO | Semanal por el chofer, verificación mensual por el mecánico |
| Inspección de suspensión (bujes, amortiguadores) | KM | Cada 20.000 km |

## 5. Sistema eléctrico

| Actividad | Driver de control | Frecuencia |
|---|---|---|
| Prueba de carga de batería | CALENDARIO | Cada 6 meses |
| Inspección de luces y sistema eléctrico | EVENTO / CALENDARIO | Diaria (chofer, pre-viaje) + revisión mensual del mecánico |

## 6. Equipo de frío (unidad reefer Thermo King / Carrier) — el driver acá NUNCA es km del camión, siempre horas del motor del equipo

| Actividad | Driver de control | Frecuencia |
|---|---|---|
| Servicio A: aceite motor auxiliar, filtro de aceite, filtro de combustible | HORAS de uso del equipo de frío | Cada 1.500 horas (o cada 250–500 horas en uso intensivo 18+ hs/día, según ejemplo dado) |
| Servicio B: A + filtro de aire, correas, mangueras | HORAS de uso del equipo de frío | Cada 3.000 horas o 6 meses |
| Servicio C / anual: compresor, condensador, evaporador, chequeo integral | HORAS de uso del equipo de frío | Cada 6.000 horas o 12 meses |
| Cambio de refrigerante del motor auxiliar | HORAS / CALENDARIO | Cada 12.000 horas o 5 años |
| Revisión de carga de gas refrigerante | HORAS / CALENDARIO | Cada 3.000 horas o semestral |

Nota práctica: la frecuencia real depende de cuántas horas por día corre el equipo. Unidades de uso intensivo (18+ hs/día) deberían entrar a servicio cada 250 horas; unidades de uso moderado (8–12 hs/día) pueden estirarse hasta 500 horas. Esto es exactamente el tipo de dato que tu sensor de temperatura/gateway (Particle, Monnit, etc.) puede alimentar automáticamente si además mide horas de motor del equipo de frío.

## 7. Carrocería y aislación térmica (específico de cadena de frío)

| Actividad | Driver de control | Frecuencia |
|---|---|---|
| Inspección de burletes de puertas y estanqueidad térmica | KM / CALENDARIO | Mensual o cada 10.000 km |
| Inspección de piso y paredes aislantes (daños, humedad, filtraciones) | CALENDARIO | Mensual |
| Calibración de sondas de temperatura propias | CALENDARIO | Cada 90 días |

## 8. Documentación y cumplimiento legal (Argentina)

| Actividad | Driver de control | Frecuencia |
|---|---|---|
| VTV / RTO | EVENTO (vencimiento) | Según fecha de vencimiento de la unidad |
| Habilitación de transporte de alimentos (SENASA / Bromatología) | EVENTO (vencimiento) | Según fecha de vencimiento |
| Recarga de matafuegos | CALENDARIO | Cada 12 meses |
| Revisión de botiquín y elementos de seguridad | CALENDARIO | Mensual |

## Resumen de tipos de driver

Kilometraje (KM): la mayoría de los ítems del chasis, motor principal, frenos y neumáticos. Horas de uso (HORAS): todo lo que dependa de un motor auxiliar, en tu caso el equipo de frío — es el driver correcto para reefer, no el km del camión. Calendario: ítems que se degradan con el tiempo independientemente del uso (batería, refrigerante, matafuegos, sondas). Evento: vencimientos puntuales (documentación) o checklists de rutina que no dependen de un contador (inspección diaria del chofer).

Esto mapea directo a la Fase 2 y Fase 4 del roadmap que armamos antes: tu modelo de datos en Prisma necesita, como mínimo, un campo `tipoDriver` (enum: KM, HORAS, CALENDARIO, EVENTO) y un `valorFrecuencia` en la tabla de planes de mantenimiento, más un contador de horas específico para el equipo de frío separado del odómetro del camión.
