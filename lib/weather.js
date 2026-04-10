/**
 * weather.js — fetches forecast from WeatherAPI.com
 * Docs: https://www.weatherapi.com/docs/
 *
 * Returns a compact weather summary the LLM can use to:
 * - Move outdoor activities to covered alternatives on rainy days
 * - Suggest lighter/heavier clothing
 * - Flag extreme heat / cold
 * - Highlight great weather windows for rooftop bars, parks etc.
 */

const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const BASE = "https://api.weatherapi.com/v1";

// WeatherAPI free plan: 3 days forecast. Paid plan: up to 14 days.
const MAX_FORECAST_DAYS = 3;

/**
 * Fetch weather forecast for a city over the trip duration.
 * @param {string} city
 * @param {number} days  - number of trip days (capped at MAX_FORECAST_DAYS)
 * @returns {object}     - structured weather context for the LLM prompt
 */
export async function fetchWeather(city, days) {
  if (!WEATHER_API_KEY) {
    console.warn("WEATHER_API_KEY not set — skipping weather enrichment");
    return null;
  }

  const forecastDays = Math.min(days, MAX_FORECAST_DAYS);

  try {
    const url =
      `${BASE}/forecast.json` +
      `?key=${WEATHER_API_KEY}` +
      `&q=${encodeURIComponent(city)}` +
      `&days=${forecastDays}` +
      `&aqi=no&alerts=yes`;

    const res = await fetch(url);
    if (!res.ok) {
      console.error("WeatherAPI error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    return parseWeather(data, days);
  } catch (err) {
    console.error("Weather fetch failed:", err.message);
    return null; // graceful degradation — itinerary still generates without weather
  }
}

/**
 * Parse WeatherAPI response into a compact LLM-friendly summary.
 */
function parseWeather(data, totalDays) {
  const location = data.location;
  const forecasts = data.forecast?.forecastday ?? [];
  const alerts = data.alerts?.alert ?? [];

  const days = forecasts.map((day, i) => {
    const d = day.day;
    const condition = d.condition.text;
    const rainChance = d.daily_chance_of_rain;
    const maxTempC = Math.round(d.maxtemp_c);
    const minTempC = Math.round(d.mintemp_c);
    const uvIndex = d.uv;
    const willRain = rainChance > 50;
    const isHot = maxTempC > 32;
    const isCold = maxTempC < 8;
    const isWindy = d.maxwind_kph > 40;

    // Derive planning flags
    const flags = [];
    if (willRain) flags.push("RAIN_LIKELY — prefer indoor/covered venues, avoid open-air markets");
    if (isHot) flags.push("HEAT WARNING — schedule outdoor sightseeing before 11am or after 4pm, push midday to shade/AC");
    if (isCold) flags.push("COLD — prioritise warm indoor venues, cafes, museums in mornings");
    if (isWindy) flags.push("WINDY — avoid exposed hilltops, rooftop bars, cycling");
    if (uvIndex >= 8) flags.push("HIGH UV — outdoor slots before 11am or with shade");

    return {
      day: i + 1,
      date: day.date,
      summary: condition,
      temp: `${minTempC}–${maxTempC}°C`,
      rain_chance: `${rainChance}%`,
      outdoor_suitable: !willRain && !isHot && !isCold,
      planning_flags: flags,
    };
  });

  // For days beyond forecast window, add a note
  const extraDays = [];
  for (let i = forecasts.length; i < totalDays; i++) {
    extraDays.push({
      day: i + 1,
      summary: "Forecast not available — plan flexibly",
      planning_flags: [],
    });
  }

  // Summarise alerts
  const alertSummaries = alerts.slice(0, 2).map((a) => a.headline);

  return {
    city: location.name,
    country: location.country,
    local_time: location.localtime,
    days: [...days, ...extraDays],
    alerts: alertSummaries,
    // Compact text block injected directly into LLM prompt
    prompt_block: buildWeatherPromptBlock([...days, ...extraDays], alertSummaries),
  };
}

/**
 * Build the text block that gets injected into the LLM user prompt.
 * Concise — we don't want to waste tokens.
 */
function buildWeatherPromptBlock(days, alerts) {
  const lines = ["--- WEATHER FORECAST (use this to adapt the itinerary) ---"];

  for (const day of days) {
    lines.push(`Day ${day.day}: ${day.summary}, ${day.temp || ""}, rain ${day.rain_chance || "unknown"}`);
    if (day.planning_flags?.length > 0) {
      lines.push(`  → ${day.planning_flags.join(" | ")}`);
    }
  }

  if (alerts.length > 0) {
    lines.push(`WEATHER ALERTS: ${alerts.join("; ")}`);
  }

  lines.push("--- END WEATHER ---");
  return lines.join("\n");
}
