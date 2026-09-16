# Weather icons

Sourced from [Meteocons](https://meteocons.com/) ([basmilius/meteocons](https://github.com/basmilius/meteocons)) — Fill style, MIT licensed. Copied here from `@meteocons/svg` (see `apps/web/package.json`) rather than imported at build time, so the exact set in use is explicit and stable.

To add/update an icon: `cp node_modules/@meteocons/svg/fill/<name>.svg apps/web/public/images/weather/`.

Mapping from Open-Meteo's WMO weather codes to these files lives in `apps/web/src/lib/weather.ts`.
