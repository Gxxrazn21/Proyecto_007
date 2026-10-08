# Misión Órbita — GDD de una página

**Reto:** NASA Space Apps Challenge 2026 · *Space Mission Design Game* · **Plataforma:** navegador (PC y móvil horizontal) · **Público:** estudiantes de nivel principiante a intermedio (12–18 años) · **Duración de una partida:** 8–12 min

## 1. Fantasía y objetivo pedagógico
Eres el ingeniero jefe de una misión de la NASA. Con un presupuesto fijo diseñas la nave pieza por pieza, eliges el cohete y la operas mientras llegan eventos de clima espacial **reales**. El juego enseña que **en el espacio todo es un compromiso**: cada kilo, cada vatio y cada millón cuentan, y cada resultado se puede rastrear hasta una decisión concreta.

## 2. Bucle de juego (4 fases)
| Fase | El jugador… | Trade-off que aprende |
|---|---|---|
| **1. Briefing** | Elige Tierra, Luna, Marte o Júpiter. Ve el presupuesto, el Δv, el eclipse, la ciencia mínima y las distancias reales de hoy (JPL Horizons). | El destino define las reglas físicas. |
| **2. Taller** | Arrastra 12 tipos de módulo a 15 ranuras. Siete medidores se actualizan al instante. | Masa ↔ Δv ↔ cohete; energía ↔ distancia; datos ↔ antena; ciencia ↔ costo. |
| **3. Lanzamiento** | Elige Falcon 9, Falcon Heavy o SLS según capacidad, costo y duración del viaje. | Si la masa supera la capacidad, el lanzamiento **falla**. |
| **4. Operación** | Responde a eventos en 12 s, sobrevive a la inserción orbital y recibe el reporte. | Los márgenes y la redundancia salvan misiones. |

## 3. Fórmulas (todas en `src/systems/calc.ts`)
- **Masa húmeda** = Σ masa seca + Σ propelente → debe ser ≤ `payload[destino]` del cohete.
- **Δv (Tsiolkovsky)** = Isp · g₀ · ln(masa húmeda / masa seca), con g₀ = 9,80665 m/s². Se necesita un motor.
- **Energía solar** = W₁ᵤₐ · 0,9 / r², donde r es la distancia al Sol en UA (de Horizons). **RTG** = potencia constante. Margen = generación − consumo.
- **Batería en eclipse** ≥ (consumo − RTG) · minutos de eclipse / 60 / 0,8 (profundidad de descarga del 80 %).
- **Enlace** = mín(máx. del hardware, kbps₁ᵤₐ / d²), donde d es la distancia a la Tierra en UA. **Datos que llegan** = mín(1, enlace / datos generados).
- **Energía disponible** = mín(1, generación / consumo).
- **Ciencia** = Σ ciencia del instrumento × afinidad con el destino × datos que llegan × energía disponible (un instrumento repetido rinde 40 %).
- **Costo** = Σ módulos + cohete ≤ presupuesto (el juego no deja elegir un cohete que no se pueda pagar).

## 4. Eventos de operación (`public/data/events.json`)
13 eventos con 2 opciones cada uno. El resultado **depende del diseño** según condiciones como `batteryWh>=eclipseNeedWh`, `comms>=2`, `count.tank>=2` o `deltaVMargin>=60`. Las llamaradas, las CME y las tormentas geomagnéticas usan datos de **NASA DONKI** (en vivo o históricos reales); los asteroides usan **NeoWs**. Si se acaba el tiempo, se aplica la opción por defecto. Cada evento enseña una lección real: Starlink en 2022, el telescopio Kepler y K2, la antena de Galileo, la bóveda de Juno, Voyager 1 en 2024…

Número de eventos: crucero = 0 / 1 / 2 / 4 según la duración del viaje (de 0 a más de 1 200 días). Ciencia = 4–5 según la misión, y el eclipse aparece siempre si la órbita tiene sombra.

## 5. Condiciones de victoria y derrota
| Resultado | Condición |
|---|---|
| **Fallo en el lanzamiento** | Masa húmeda > capacidad del cohete al destino. |
| **Nave perdida** | La salud llega a 0 por los eventos (se conserva el 30 % de la ciencia ya enviada). |
| **Éxito parcial** | Sobrevive, pero falla la inserción (Δv restante < requerido → sobrevuelo con 15 % de ciencia) o la ciencia queda por debajo del mínimo. |
| **Misión exitosa** ★ | En órbita, con salud > 0 y ciencia ≥ mínimo. |
| ★★ / ★★★ | +1 si la ciencia ≥ 130 % del mínimo; +1 si el costo total ≤ 80 % del presupuesto. |

## 6. Balance (verificable con `npm run balance`)
Diseños de referencia que deben pasar o fallar: Tierra equilibrada ✓ y sin batería ✗; Luna sin tanque ✗; Marte ligero con Falcon 9 ✓ y solo con antena de baja ganancia ✗ (llega el 2 % de los datos); Júpiter con 2 RTG estilo Cassini ✓, con 4 alas solares estilo Juno ✓ y con cámara ✗ (cuello de botella de datos). En Júpiter, el SLS cuesta 2 200 M$ y acorta el viaje de 5,5 a 2,5 años, que es la misma decisión que tomó Europa Clipper al revés.

## 7. Rejugabilidad
- **8 insignias** (p. ej. *Ingeniería Cassini*: llegar a Júpiter solo con RTG; *Al estilo Juno*: solo con paneles; *Presupuesto de hierro*: triunfar con ≤ 60 % del presupuesto) y **récord de ciencia** por misión. Se guardan en el navegador del jugador.
- Los eventos cambian en cada partida y usan datos en vivo, así que dos partidas nunca son iguales.
- Sonido chiptune sintetizado con Web Audio, con botón para silenciarlo.

## 8. Dirección de arte
Pixel art a 480×270, escalado entero sin suavizado y una **paleta de 20 colores** (`src/art/palette.ts`). La firma visual es el **oro de la manta térmica (MLI)**, reservado para la nave y la acción principal. Fuentes: Pixelify Sans para títulos y "Orbita UI" para la interfaz (letras de Tiny5 + dígitos de Silkscreen, porque en Tiny5 el 9 se confunde con el 3). El lienzo se dibuja a la resolución física de la pantalla para que todo se vea nítido. El arte del MVP se genera por código (`src/art/sprites.ts`); cada PNG final reemplaza al placeholder usando la misma clave.

## 9. Alcance
**MVP (hecho):** 4 misiones, 12 módulos, 3 cohetes, 14 eventos, 7 escenas, 5 fuentes de datos NASA/JPL con respaldo offline, móvil, sonido, insignias.
**Después del MVP:** arte final, sonido (chiptune + efectos), ventanas de lanzamiento según la fecha, PWA offline, modo docente, decaimiento de los RTG y degradación de la radiación.
