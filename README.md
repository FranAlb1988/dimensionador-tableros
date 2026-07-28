# Dimensionador de tableros

Aplicación web para dimensionar tableros eléctricos: CCM, TDG, CDC y MT.
Calcula protecciones, barras, derrateo y genera memorias y planos en PDF.

Hecha con React + TypeScript + Vite. Se publica en GitHub Pages.

## Desarrollo

```bash
npm install
npm run dev
```

| Script | Para qué |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm test` | Tests (Vitest) |
| `npm run lint` | ESLint sobre todo el repo |
| `npm run build` | `tsc -b` + build de producción a `dist/` |

## Despliegue

Cada push a `main` dispara el workflow `.github/workflows/deploy.yml`, que publica
en GitHub Pages. Antes de compilar corre **lint** y **tests**: si alguno falla, no
se publica nada.

## La dependencia `xlsx` (SheetJS) — no moverla al registro npm

En `package.json` la librería apunta a un tarball del CDN de SheetJS, no al
registro de npm:

```json
"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"
```

**Esto es intencional y es el canal oficial de distribución de SheetJS.** El
paquete publicado en el registro de npm quedó congelado en la versión **0.18.5**
(2022) y ya no se actualiza.

Cambiarlo a `"xlsx": "^0.18.5"` parece más ortodoxo, pero **introduce
vulnerabilidades conocidas** que se corrigieron en versiones posteriores:

| Versión | Estado |
| --- | --- |
| 0.18.5 (registro npm) | Prototype pollution y ReDoS sin corregir |
| 0.19.3 | Corrige el prototype pollution (CVE-2023-30533) |
| 0.20.2 | Corrige el ReDoS (CVE-2024-22363) |
| **0.20.3 (la que usamos)** | Ambas corregidas |

Consideraciones prácticas:

- **La integridad está fijada.** `package-lock.json` guarda el hash `sha512` del
  tarball, así que `npm ci` verifica que el archivo descargado sea exactamente el
  esperado. No se puede sustituir por otro sin que falle la instalación.
- **`npm audit` no cubre dependencias por URL.** Un resultado de "0
  vulnerabilidades" no dice nada sobre `xlsx`; hay que seguir los avisos de
  SheetJS a mano.
- **El build depende de que `cdn.sheetjs.com` responda.** Si el CDN se cae, falla
  `npm ci` en CI y no se puede desplegar hasta que vuelva. Si eso llegara a
  molestar, la salida es incluir el tarball en el repositorio y apuntar la
  dependencia a un `file:`, no bajar de versión.

Para actualizar, cambiar la URL a la versión nueva y correr `npm install` para
que se regenere el hash del lock.

La superficie de uso es mínima (`XLSX.read` y `XLSX.utils.sheet_to_json`, en
`src/importers/excel.ts`), así que reemplazarla por otra librería sería acotado
si alguna vez hiciera falta.
