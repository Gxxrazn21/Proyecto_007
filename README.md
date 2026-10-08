# Misión Órbita

**Diseña, lanza y opera tu propia nave espacial con datos reales de la NASA.**
Juego educativo en pixel art para el **NASA Space Apps Challenge 2026**, reto *Space Mission Design Game*. Se juega en el navegador, tanto en PC como en móvil.

> Elige un destino → arma la nave módulo a módulo → escoge el cohete → sobrevive a llamaradas solares reales → descubre qué decisión causó cada resultado.

## Inicio rápido
```bash
git clone <url-del-repo> && cd Proyecto_007
npm install
cp .env.example .env          # opcional: pon tu clave de https://api.nasa.gov
npm run dev                   # abre http://localhost:5173
```
Requisitos: **Node.js 20+** (probado con 22 y 24). Para probar en el celular, abre la dirección *Network* que muestra Vite, con el teléfono en la misma red wifi.

## Comandos
| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente y el proxy `/api` de la NASA |
| `npm run build` | Revisa los tipos y genera `dist/` (≈350 KB comprimido) |
| `npm run preview` | Sirve el build localmente |
| `npm run typecheck` | Comprueba TypeScript |
| `npm run balance` | Verifica que los diseños de referencia pasen o fallen como se espera |

## Datos de la NASA y la clave secreta
El navegador **nunca** ve la clave. Llama a `/api/donki`, `/api/apod`, `/api/neows` y `/api/horizons`, y esas rutas, que se ejecutan en el servidor, añaden `NASA_API_KEY`:

```
Navegador ──/api/*──► server/nasa.ts (Vite en dev · funciones de Vercel en producción) ──► api.nasa.gov / JPL Horizons
    └── si falla en 5 s ──► public/data/fallback/*.json + efemérides calculadas offline
```
Sin internet o sin clave, el juego sigue funcionando con datos históricos reales.

## Despliegue (Vercel, gratis)
```bash
npm install -g vercel
vercel                         # primera vez: enlaza el proyecto
vercel env add NASA_API_KEY    # pega tu clave
vercel --prod
```
Vercel detecta Vite y publica las funciones de `api/` automáticamente. Para un hosting estático (GitHub Pages, itch.io), sube `dist/`: todo funciona salvo los datos en vivo, que pasan al respaldo.

## Estructura
```
public/data/          ← BALANCE: misiones, módulos, cohetes y eventos (JSON, sin tocar código)
  fallback/           ← respaldo offline (eventos históricos reales)
src/
  main.ts             ← configuración de Phaser (480×270, pixel art, escalado)
  types.ts            ← interfaces de los JSON
  scenes/             ← Boot, Menu, Briefing, Workshop, Launch, Operations, Results
  systems/            ← lógica pura, sin Phaser: calc (fórmulas), events, ephemeris, slots
  services/nasa.ts    ← cliente con timeout y respaldo
  state/GameState.ts  ← estado de la partida
  ui/                 ← kit de interfaz (botón, panel, medidor) y dibujo de la nave
  art/                ← paleta de 20 colores y sprites generados por código
server/nasa.ts        ← proxy hacia la NASA (compartido entre dev y Vercel)
api/                  ← funciones serverless de Vercel
tools/balance.ts      ← pruebas de balance
docs/                 ← GDD, plan de 48 h y fuentes de datos
```

## Cómo contribuir (equipo)
- **Balancear:** edita `public/data/*.json` y ejecuta `npm run balance`.
- **Nuevo evento:** añade un objeto a `events.json`. Las condiciones usan el mini-lenguaje de `src/systems/events.ts` (p. ej. `"when": "batteryWh>=eclipseNeedWh"`).
- **Arte final:** guarda el PNG en `public/assets/` y cárgalo en `BootScene.preload()` con la **misma clave** que el placeholder (`mod-rtg`, `rk-sls`, `pl-mars`…). Usa la paleta de `src/art/palette.ts`.
- **Nueva escena:** créala en `src/scenes/` y regístrala en `src/main.ts`.
- Commits pequeños; `main` siempre debe ser jugable.

## Documentación
- [GDD de una página](docs/GDD.md): mecánicas, fórmulas, victoria y derrota
- [Plan de 48 h](docs/PLAN_48H.md)
- [Fuentes de datos](docs/DATOS.md)

## Créditos
Datos: NASA DONKI, NeoWs, APOD y JPL Horizons. Fuentes tipográficas: Pixelify Sans y Tiny5 (SIL OFL). Motor: Phaser 3.
