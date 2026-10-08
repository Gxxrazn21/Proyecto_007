# Fuentes de datos

## APIs en vivo (a través de `server/nasa.ts`)
| Dato | API | Uso en el juego | Respaldo offline |
|---|---|---|---|
| Llamaradas, CME, tormentas geomagnéticas | [NASA DONKI](https://api.nasa.gov) (`/DONKI/FLR`, `/CMEAnalysis`, `/GST`, últimos 120 días) | Eventos de operación y su gravedad | `public/data/fallback/donki.json`: eventos históricos reales (X9.3 de 2017, X9.0 de 2024, tormenta G5 de mayo de 2024, Starlink 2022…) |
| Asteroides cercanos | [NASA NeoWs](https://api.nasa.gov) (`/neo/rest/v1/feed`, próximos 7 días) | Evento de observación de un asteroide | `fallback/neows.json` (Apophis 2029, 2012 DA14) |
| Eventos naturales en la Tierra | [NASA EONET](https://eonet.gsfc.nasa.gov/docs/v3) (incendios, volcanes, tormentas, inundaciones; eventos abiertos de los últimos 60 días, sin clave) | Evento de la misión Vigía Terrestre: fotografiar el desastre | `fallback/eonet.json` (huracán Otis 2023, Hunga Tonga 2022, incendios de Quebec 2023) |
| Imagen del día | [NASA APOD](https://api.nasa.gov) | Tarjeta en el menú | Se oculta la tarjeta |
| Distancias al Sol y a la Tierra | [JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html) (cantidades 19 y 20) | Potencia solar (1/r²), enlace (1/d²), retardo de la señal | `src/systems/ephemeris.ts`: [elementos keplerianos aproximados de JPL](https://ssd.jpl.nasa.gov/planets/approx_pos.html), validados contra la oposición de Marte de 2027 (0,678 UA) |

## Valores de hardware (redondeados para el juego)
| Elemento | Referencia pública |
|---|---|
| GPHS-RTG: 56 kg, ~290 W | Cassini, New Horizons (NASA/DOE) |
| Alas solares en Júpiter | Juno: ~14 kW a 1 UA, ~500 W en Júpiter |
| Antena de alta ganancia | MRO: plato de 3 m, hasta ~6 Mbps desde Marte |
| Motor de inserción, Isp 320 s | Leros 1b (Juno), ~318 s |
| Cámara y espectrómetro | HiRISE (65 kg) y CRISM (33 kg) de MRO |
| Falcon 9 | SpaceX: 69,75 M$; 22,8 t a LEO y 4,0 t a Marte en modo desechable. Valores reutilizables y TLI: **estimaciones** |
| Falcon Heavy | SpaceX: 63,8 t a LEO, 16,8 t a Marte. Contrato de Europa Clipper: 178 M$ |
| SLS Block 1 | NASA: >27 t a TLI. Auditoría OIG (2022): ~2 200 M$ por cohete |

> Las cifras están simplificadas para que el juego sea comprensible y equilibrado. Cada JSON incluye un campo `source` por elemento. Lo marcado como "est." es una estimación del equipo y conviene revisarlo antes de la entrega.
