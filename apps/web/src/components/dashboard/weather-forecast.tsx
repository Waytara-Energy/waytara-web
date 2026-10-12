"use client";

import * as React from "react";
import { Droplets, Sun } from "lucide-react";
import { CONDITION_TEXT, WEATHER_CREDIT, type Forecast, type ForecastDay } from "@/lib/weather";
import { compass, durationText, solarVerdict, uvLabel } from "@/lib/weather-format";
import { cn } from "@/lib/utils";
import { AboutRows } from "./device-about";
import { DeviceCard } from "./device-card";
import { SolarBars, WEATHER_ICON, clock, dayDate, dayName, hourText, temp } from "./weather-ui";

const kmh = (ms: number | null) => (ms === null ? null : `${Math.round(ms * 3.6)} km/h`);
const mm = (v: number) => `${v < 10 ? v.toFixed(1) : Math.round(v)} mm`;

/** The weather forecast page: the weather now at the site, the days ahead to choose from, and for the chosen day its summary, the sun, the
 *  sunshine for solar hour by hour, and every forecast moment of it. */
export function WeatherForecast({ siteName, city, forecast }: { siteName: string; city: string | null; forecast: Forecast }) {
  const { weather, days } = forecast;
  const [index, setIndex] = React.useState(0);
  const day = days[Math.min(index, days.length - 1)];
  const n = weather.now;
  const Now = WEATHER_ICON[n.condition][n.night ? "night" : "day"];
  const today = days[0];

  return (
    <div className="space-y-5">
      {/* The headline: the weather now, like the other pages' headlines. */}
      <div className="flex min-w-0 items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
          <Now className={cn("size-7", WEATHER_ICON[n.condition].tone)} strokeWidth={1.6} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-theme-muted">
            Weather at {siteName}
            {city ? ` · ${city}` : ""}
          </p>
          <p className="truncate text-3xl font-semibold leading-tight tracking-tight text-theme-primary sm:text-4xl">
            {n.tempC === null ? "·" : `${Math.round(n.tempC)}°C`} <span className="text-lg font-medium text-theme-muted sm:text-xl">{CONDITION_TEXT[n.condition]}</span>
          </p>
        </div>
        {today && (
          <div className="hidden items-center gap-8 pl-6 md:flex">
            {[
              ["High / Low", `${temp(today.maxC)} / ${temp(today.minC)}`],
              ["Sunrise", today.sun.sunrise ? clock(today.sun.sunrise) : "·"],
              ["Sunset", today.sun.sunset ? clock(today.sun.sunset) : "·"],
              ["Solar today", `${today.solar.potentialPct}%`],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-sm font-medium text-theme-muted">{label}</p>
                <p className="text-2xl font-semibold tracking-tight text-theme-primary">{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* The days to choose from. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" role="tablist" aria-label="Days">
        {days.map((d, i) => {
          const Icon = WEATHER_ICON[d.condition].day;
          const selected = i === index;
          return (
            <button
              key={d.date}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setIndex(i)}
              className={cn(
                "rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                selected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/40"
              )}
            >
              <p className="text-sm font-semibold text-foreground">{dayName(d.date, i)}</p>
              <p className="text-xs text-muted-foreground">{dayDate(d.date)}</p>
              <div className="my-2 flex items-center justify-between">
                <Icon className={cn("size-7", WEATHER_ICON[d.condition].tone)} strokeWidth={1.5} />
                <p className="text-right tabular-nums">
                  <span className="text-sm font-semibold text-foreground">{temp(d.maxC)}</span>
                  <span className="text-xs text-muted-foreground"> / {temp(d.minC)}</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground" title={`About ${d.solar.potentialPct}% of a clear day's sunshine`}>
                <Sun className="size-3 shrink-0 text-amber-500" />
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-amber-400" style={{ width: `${d.solar.potentialPct}%` }} />
                </span>
                <span className="w-7 text-right tabular-nums">{d.solar.potentialPct}%</span>
              </div>
              {d.rainMm >= 0.5 && (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400">
                  <Droplets className="size-3" />
                  {mm(d.rainMm)}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {day && <DayDetails day={day} index={index} nowHour={index === 0 ? new Date(Date.parse(weather.now.at) + 19_800_000).getUTCHours() : undefined} />}

      <p className="text-xs text-muted-foreground">
        {WEATHER_CREDIT}. The first two days come hour by hour, the later days every six hours. Sunrise, sunset and sunshine strength are worked out for the site&apos;s position and the cloud forecast; the sunshine is an estimate of what reaches the ground, not a forecast of your
        inverter&apos;s output.
      </p>
    </div>
  );
}

function DayDetails({ day, index, nowHour }: { day: ForecastDay; index: number; nowHour?: number }) {
  const Icon = WEATHER_ICON[day.condition].day;
  const verdict = solarVerdict(day.solar.potentialPct);
  const windFrom = day.hours.find((h) => h.windMs !== null && h.windMs === day.maxWindMs)?.windFromDeg ?? null;
  const windDir = windFrom === null ? null : compass(windFrom);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DeviceCard title={`${dayName(day.date, index)}, ${dayDate(day.date)}`}>
          <div className="mb-3 flex items-center gap-3">
            <Icon className={cn("size-9", WEATHER_ICON[day.condition].tone)} strokeWidth={1.5} />
            <div>
              <p className="text-sm font-medium text-foreground">{CONDITION_TEXT[day.condition]}</p>
              <p className="text-xs text-muted-foreground">
                High {temp(day.maxC)} · Low {temp(day.minC)}
              </p>
            </div>
          </div>
          <AboutRows
            rows={[
              ["Rain", day.rainMm >= 0.5 ? mm(day.rainMm) : "None expected"],
              ["Cloud cover", day.avgCloudPct === null ? null : `${day.avgCloudPct}% on average`],
              ["Wind", day.maxWindMs === null ? null : `Up to ${kmh(day.maxWindMs)}${windDir ? ` from the ${windDir}` : ""}`],
              ["Humidity", day.avgHumidityPct === null ? null : `${day.avgHumidityPct}% on average`],
              ["UV index", day.maxUv === null || day.maxUv <= 0 ? null : `Up to ${day.maxUv.toFixed(1)} (${uvLabel(day.maxUv)})`],
            ]}
          />
        </DeviceCard>

        <DeviceCard title="The sun">
          <AboutRows
            rows={[
              ["Sunrise", day.sun.sunrise ? clock(day.sun.sunrise) : "The sun does not rise"],
              ["Sun at its highest", clock(day.sun.solarNoon)],
              ["Sunset", day.sun.sunset ? clock(day.sun.sunset) : "The sun does not set"],
              ["Daylight", durationText(day.sun.daylightMin)],
              ["Height at noon", `${Math.round(day.sun.maxElevationDeg)}° above the horizon`],
            ]}
          />
        </DeviceCard>

        <DeviceCard title="Sunshine for solar" className="md:col-span-2 xl:col-span-1">
          <SolarBars hours={day.solar.hours} peakHour={day.solar.peakHour} nowHour={nowHour} tall />
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className={cn("rounded-full px-2 py-0.5 font-medium", verdict.tone === "good" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : verdict.tone === "fair" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-slate-500/10 text-slate-600 dark:text-slate-300")}>
              {verdict.text}
            </span>
            <span className="text-muted-foreground">
              About {day.solar.potentialPct}% of a clear day&apos;s sunshine
              {day.solar.peakHour !== null ? ` · strongest near ${hourText(day.solar.peakHour)} (~${day.solar.peakWm2} W/m²)` : ""}
            </span>
          </div>
        </DeviceCard>
      </div>

      <DeviceCard title="Hour by hour" description={day.hours.length > 0 && day.hours[0].spanH === 6 ? "This day is forecast every six hours." : index === 0 ? "From now to the end of the day." : undefined}>
        {day.hours.length === 0 ? (
          <p className="text-sm text-muted-foreground">No forecast for this day yet.</p>
        ) : (
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Time</th>
                  <th className="py-2 pr-3 font-medium">Weather</th>
                  <th className="py-2 pr-3 text-right font-medium">Temp</th>
                  <th className="py-2 pr-3 text-right font-medium">Cloud</th>
                  <th className="py-2 pr-3 text-right font-medium">Rain</th>
                  <th className="py-2 pr-3 text-right font-medium">Wind</th>
                  <th className="py-2 text-right font-medium">Sunshine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {day.hours.map((h) => {
                  const HIcon = WEATHER_ICON[h.condition][h.night ? "night" : "day"];
                  return (
                    <tr key={h.time}>
                      <td className="py-2 pr-3 font-medium text-foreground">{hourText(h.hour)}</td>
                      <td className="py-2 pr-3">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <HIcon className={cn("size-4 shrink-0", WEATHER_ICON[h.condition].tone)} strokeWidth={1.6} />
                          <span className="truncate">{CONDITION_TEXT[h.condition]}</span>
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-foreground">{temp(h.tempC)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{h.cloudPct === null ? "·" : `${Math.round(h.cloudPct)}%`}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground" title={h.rainMm !== null ? `Over the next ${h.spanH} hour${h.spanH === 1 ? "" : "s"}` : undefined}>
                        {h.rainMm === null || h.rainMm < 0.1 ? "·" : mm(h.rainMm)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{h.windMs === null ? "·" : `${kmh(h.windMs)}${h.windFromDeg !== null ? ` ${compass(h.windFromDeg)}` : ""}`}</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">{h.wm2 > 0 ? `${h.wm2} W/m²` : "·"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DeviceCard>
    </div>
  );
}
