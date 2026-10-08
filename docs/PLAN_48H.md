# Plan de trabajo de 48 h

**Equipo de 4 personas:**
- **A, Líder técnico:** escenas, integración y despliegue.
- **B, Gameplay y datos:** JSON, balance y eventos.
- **C, Arte:** pixel art y animaciones.
- **D, Contenido y pitch:** textos educativos, video, presentación y pruebas con usuarios.

> **Punto de partida:** el MVP jugable ya existe en este repositorio (7 escenas, datos de la NASA con respaldo, móvil). El plan aprovecha las 48 h para **pulirlo, probarlo con estudiantes y presentarlo**, no para empezar desde cero. Si el equipo empieza desde un repositorio vacío, las horas 0–12 de cada persona se usan para rehacer lo que ya existe, en el mismo orden de los commits.

## Reglas del equipo
- Ramas cortas (`feat/...`) y *pull requests* pequeños; **`main` siempre jugable**.
- Antes de cada merge: `npm run typecheck && npm run balance && npm run build`.
- Para balancear se tocan **solo los JSON**. Si `npm run balance` falla, no se hace merge.
- Reunión de 10 minutos en las horas 0, 6, 12, 24, 36 y 44.

## Hora a hora

| Horas | A · Técnico | B · Gameplay/datos | C · Arte | D · Contenido/pitch |
|---|---|---|---|---|
| **0–2** | Clonar, `npm install`, `npm run dev`; crear el proyecto en Vercel y poner `NASA_API_KEY` | Leer el GDD; jugar las 4 misiones y anotar el balance | Estudiar la paleta y las claves de sprites (`src/art/sprites.ts`) | Jugar; esquema del pitch (problema → juego → datos NASA → aprendizaje) |
| **2–6** | **Primer despliegue en Vercel** y probar el proxy en vivo (DONKI, Horizons) | Ajustar los valores de `modules.json` y `rockets.json` contra las fuentes de `docs/DATOS.md` | Arte final: bus, alas solares, RTG, antenas (32×32 o menos) | Revisar todos los textos (eventos, lecciones) para estudiantes de 12–18 años |
| **6–12** | Sonido: efectos (clic, colocar, despegue, explosión) + música de fondo con botón de silencio | 4–6 eventos nuevos (p. ej. ventana de lanzamiento, falla de un instrumento, conjunción solar) | Arte final: motor, tanque, instrumentos, iconos | Prueba con 2–3 estudiantes reales: ¿entienden el Taller sin ayuda? |
| **12–18** | Correcciones de la prueba con usuarios; pantalla de tutorial interactivo en el Taller | Afinar la dificultad según las pruebas (presupuestos, mínimos de ciencia) | Cohetes y planetas finales; animación de despegue | Guion del video (≤ 30 s) y capturas |
| **18–24** | 🛌 **Turnos de descanso** (mínimo 4 h cada uno). Guardia: una persona revisa que `main` siga jugable | | | |
| **24–30** | PWA: `manifest` + *service worker* que guarda los JSON de respaldo | Modo docente: misión con presupuesto editable (opcional) | Fondos: plataforma, sala limpia y órbitas | Página del proyecto en Space Apps: descripción y uso de los datos de la NASA |
| **30–36** | Optimización móvil (Android de gama baja) y accesibilidad (contraste, tamaño del texto) | QA completo: 4 misiones × 3 cohetes; registrar los bugs como *issues* | Pulido: partículas, transiciones, pantalla de título | Grabar el video demostrativo |
| **36–42** | **Congelar funciones.** Solo bugs | Correcciones de balance | Últimos sprites | Ensayar el pitch 3 veces y medir el tiempo |
| **42–46** | Despliegue final y prueba en 3 dispositivos (PC, Android, iPhone) | QA final con internet y sin él | Capturas para la entrega | Enviar el proyecto con video, enlace y repositorio |
| **46–48** | Margen para imprevistos | | | |

## Prioridades si falta tiempo (cortar de abajo hacia arriba)
1. ✅ Jugable de principio a fin en el navegador (hecho)
2. ✅ Datos de la NASA con respaldo offline (hecho)
3. Desplegado en una URL pública (Vercel)
4. Textos revisados para estudiantes
5. Sonido
6. Arte final
7. Tutorial interactivo
8. PWA y modo docente

## Riesgos y mitigación
| Riesgo | Mitigación |
|---|---|
| Sin internet en el evento | El juego usa el respaldo offline automáticamente; se puede probar sin red. |
| Límite de la API de la NASA (DEMO_KEY: 30 peticiones/h) | Clave propia (1 000/h) + caché de 1 h en la CDN de Vercel. |
| El arte final no llega a tiempo | Los placeholders generados por código ya son coherentes; el arte se cambia sprite a sprite. |
| Conflictos de Git | Una escena por persona; los JSON solo los toca B. |
