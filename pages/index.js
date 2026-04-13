import { useState, useRef, useCallback } from "react";
import Head from "next/head";

// ─── Constants ────────────────────────────────────────────────────────────────
const INTERESTS = [
  { id: "history",      label: "History & Heritage", icon: "🏛" },
  { id: "art",          label: "Art & Galleries",    icon: "🎨" },
  { id: "nature",       label: "Parks & Nature",     icon: "🌿" },
  { id: "markets",      label: "Local Markets",      icon: "🛍" },
  { id: "music",        label: "Music & Nightlife",  icon: "🎵" },
  { id: "offbeat",      label: "Hidden Gems",        icon: "🗝" },
  { id: "architecture", label: "Architecture",       icon: "🏗" },
  { id: "sport",        label: "Sports & Activities",icon: "⚽" },
];
const FOOD = [
  { id: "street",     label: "Street Food",    icon: "🥙" },
  { id: "local",      label: "Local Cuisine",  icon: "🍲" },
  { id: "cafes",      label: "Cafes & Coffee", icon: "☕" },
  { id: "finedining", label: "Fine Dining",    icon: "🍽" },
  { id: "pubs",       label: "Pubs & Bars",    icon: "🍺" },
  { id: "vegan",      label: "Vegan / Veggie", icon: "🥗" },
];
const TRANSPORT = [
  { id: "walking", label: "Walking",        icon: "🚶" },
  { id: "metro",   label: "Metro / Tube",   icon: "🚇" },
  { id: "bus",     label: "Local Bus",      icon: "🚌" },
  { id: "cycling", label: "Cycling",        icon: "🚲" },
  { id: "tram",    label: "Tram / Cable Car",icon: "🚋" },
  { id: "auto",    label: "Auto / Tuk-tuk", icon: "🛺" },
];
const CATEGORY_META = {
  food:        { color: "#c4856a", bg: "#f0ddd4", label: "Food" },
  drinks:      { color: "#d4a843", bg: "#fdf3d8", label: "Drinks" },
  sightseeing: { color: "#6b8f71", bg: "#ddeadf", label: "Sightseeing" },
  transport:   { color: "#7b9fc4", bg: "#dae8f5", label: "Transport" },
  culture:     { color: "#9b7dbf", bg: "#ede6f7", label: "Culture" },
};
const COMMUTE_META = {
  walking:  { icon: "🚶", color: "#6b8f71", label: "Walk" },
  metro:    { icon: "🚇", color: "#7b9fc4", label: "Metro" },
  bus:      { icon: "🚌", color: "#9b7dbf", label: "Bus" },
  tram:     { icon: "🚋", color: "#7b9fc4", label: "Tram" },
  taxi:     { icon: "🚕", color: "#d4a843", label: "Taxi" },
  cycling:  { icon: "🚲", color: "#6b8f71", label: "Cycle" },
  auto:     { icon: "🛺", color: "#c4856a", label: "Auto" },
};

const WEATHER_ICON = {
  sunny:  { icon: "☀️", bg: "#fff8e1", border: "#f9c74f", text: "#7a5c1e" },
  cloudy: { icon: "☁️", bg: "#f1efea", border: "#c8c4bc", text: "#4a4540" },
  rainy:  { icon: "🌧",  bg: "#e8f0f8", border: "#7b9fc4", text: "#1e3a5f" },
  mixed:  { icon: "⛅", bg: "#f5f0e8", border: "#c4a86a", text: "#5c4010" },
};

// ─── Shared helpers ───────────────────────────────────────────────────────────
function Chip({ selected, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "8px 14px", borderRadius: 24,
      border: selected ? "1.5px solid var(--clay)" : "1px solid var(--border)",
      background: selected ? "var(--clay-light)" : "white",
      color: selected ? "var(--clay-dark)" : "var(--slate)",
      fontSize: 13, fontWeight: selected ? 500 : 400,
      cursor: "pointer", transition: "all .15s",
      fontFamily: "'DM Sans', sans-serif",
    }}>{children}</button>
  );
}

// ─── Model catalogue ─────────────────────────────────────────────────────────
const PROVIDERS = [
  {
    id: "claude",
    label: "Anthropic",
    icon: "◈",
    models: [
      { id: "claude-haiku", label: "Haiku 4.5", sublabel: "Fast · Cheapest", speed: 5 },
      { id: "claude-sonnet", label: "Sonnet 4.6", sublabel: "Balanced · Recommended", speed: 4 },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    icon: "⬡",
    models: [
      { id: "openai-mini",    label: "GPT-4o mini", sublabel: "Fast · Cheap", speed: 5 },
      { id: "openai-4o",      label: "GPT-4o",      sublabel: "Best quality", speed: 3 },
    ],
  },
  {
    id: "openrouter",
    label: "Open Model",
    icon: "⊕",
    sublabel: "",
    models: [
      { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B",       sublabel: "Free · Strong reasoning", speed: 4 },
      { id: "google/gemma-3-27b-it:free",             label: "Gemma 3 27B",         sublabel: "Free · Good instructions", speed: 4 },
      { id: "mistralai/mistral-small-3.1-24b-instruct-2503:free", label: "Mistral Small 3.1", sublabel: "Free · Fast",        speed: 5 },
      
    ],
  },
];

// Flatten to a map for easy lookup
const MODEL_MAP = {};
PROVIDERS.forEach(p => p.models.forEach(m => { MODEL_MAP[m.id] = { ...m, provider: p.id }; }));

function SpeedDots({ speed }) {
  return (
    <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: "50%",
          background: i <= speed ? "var(--sage)" : "var(--mist)",
          display: "inline-block",
        }} />
      ))}
    </span>
  );
}

function ModelPicker({ provider, orModel, onProviderChange, onOrModelChange }) {
  const [open, setOpen] = useState(false);
  const activeProvider = PROVIDERS.find(p => p.id === provider) || PROVIDERS[0];
  const activeOrModel  = PROVIDERS.find(p => p.id === "openrouter")?.models.find(m => m.id === orModel)
                         || PROVIDERS.find(p => p.id === "openrouter")?.models[0];

  const displayLabel = provider === "openrouter"
    ? (activeOrModel?.label || "Pick model")
    : activeProvider.label;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "7px 14px", borderRadius: 20,
          border: "1px solid var(--border)", background: "white",
          fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          color: "var(--ink)", transition: "all .15s",
        }}
      >
        <span style={{ fontSize: 14 }}>{activeProvider.icon}</span>
        <span style={{ fontWeight: 500 }}>{displayLabel}</span>
        <span style={{ opacity: .5, fontSize: 11 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          background: "white", border: "1px solid var(--border)",
          borderRadius: 12, width: 300, zIndex: 200, overflow: "hidden",
          boxShadow: "0 4px 24px rgba(26,22,18,0.12)",
        }}>
          {PROVIDERS.map(prov => (
            <div key={prov.id}>
              {/* Provider header */}
              <div style={{
                padding: "8px 14px 4px",
                fontSize: 10, fontWeight: 500, letterSpacing: ".06em",
                textTransform: "uppercase", color: "var(--slate)",
                background: "var(--paper2)",
                borderTop: "1px solid var(--border)",
              }}>
                <span style={{ marginRight: 6 }}>{prov.icon}</span>{prov.label}
                {prov.sublabel && <span style={{ fontWeight: 400, opacity: .7, marginLeft: 4 }}>· {prov.sublabel}</span>}
              </div>
              {/* Model options */}
              {prov.models.map(m => {
                const isActive = provider === prov.id && (prov.id !== "openrouter" || orModel === m.id);
                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      onProviderChange(prov.id);
                      if (prov.id === "openrouter") onOrModelChange(m.id);
                      setOpen(false);
                    }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "9px 14px", cursor: "pointer",
                      background: isActive ? "var(--clay-light)" : "white",
                      transition: "background .1s",
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--paper2)"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "white"; }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: isActive ? 500 : 400, color: isActive ? "var(--clay-dark)" : "var(--ink)" }}>
                        {m.label}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--slate)", marginTop: 1 }}>{m.sublabel}</div>
                    </div>
                    <SpeedDots speed={m.speed} />
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{ padding: "8px 14px", fontSize: 11, color: "var(--slate)", borderTop: "1px solid var(--border)", background: "var(--paper2)" }}>
            Speed dots = response time (5 = fastest)
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Weather strip ────────────────────────────────────────────────────────────
function WeatherStrip({ weatherSummary }) {
  if (!weatherSummary || weatherSummary.length === 0) return null;
  return (
    <div style={{
      display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20,
    }}>
      {weatherSummary.map((w, i) => {
        const wm = WEATHER_ICON[w.weather] || WEATHER_ICON.cloudy;
        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 12px", borderRadius: 20,
            background: wm.bg, border: `1px solid ${wm.border}`,
            fontSize: 12, color: wm.text, fontWeight: 500,
          }}>
            <span style={{ fontSize: 15 }}>{wm.icon}</span>
            <span>Day {w.day}</span>
            {w.temp && <span style={{ opacity: .7 }}>{w.temp}</span>}
            {w.rain_chance && w.rain_chance !== "0%" && (
              <span style={{ opacity: .65 }}>💧{w.rain_chance}</span>
            )}
            {w.outdoor_suitable === false && (
              <span title="Outdoor activities may be affected" style={{ opacity: .8 }}>⚠</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Drag-and-drop slot card ──────────────────────────────────────────────────
function CommuteBar({ commute }) {
  if (!commute) return null;
  const m = COMMUTE_META[commute.mode] || COMMUTE_META.walking;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "4px 0 4px 76px", // indent to align with slot cards
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "3px 10px", borderRadius: 12,
        background: "var(--paper2)", border: "1px solid var(--border)",
        fontSize: 11, color: "var(--slate)",
      }}>
        <span style={{ fontSize: 13 }}>{m.icon}</span>
        <span style={{ fontWeight: 500, color: m.color }}>{commute.time} min</span>
        <span style={{ opacity: .6 }}>{m.label}</span>
        {commute.label && commute.label !== `${commute.time} min ${commute.mode}` && (
          <span style={{ opacity: .55 }}>· {commute.label.replace(/^\d+ min \w+ /, "").replace(/^to /, "")}</span>
        )}
      </div>
      <div style={{ flex: 1, height: 1, background: "var(--border)", opacity: .4 }} />
    </div>
  );
}

function SlotCard({ slot, dayIndex, slotIndex, onDragStart, onDrop, onDragOver, onDragLeave, isDragOver }) {
  const [open, setOpen] = useState(false);
  const meta = CATEGORY_META[slot.category] || CATEGORY_META.sightseeing;
  const isTransport = slot.category === "transport";

  if (isTransport) {
    return (
      <div
        draggable
        onDragStart={e => onDragStart(e, dayIndex, slotIndex)}
        onDrop={e => onDrop(e, dayIndex, slotIndex)}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "8px 0", margin: "0 0 0 28px",
          cursor: "grab", opacity: isDragOver ? 0.5 : 1,
          borderRadius: 6, transition: "opacity .15s",
        }}
      >
        <span style={{ fontSize: 16, userSelect: "none", color: "var(--slate)", cursor: "grab" }}>⠿</span>
        <div style={{ fontSize: 16 }}>🚇</div>
        <div style={{ flex: 1, height: 1, background: "var(--border)", position: "relative" }}>
          <div style={{
            position: "absolute", left: "50%", top: -10, transform: "translateX(-50%)",
            background: "var(--paper)", padding: "0 8px",
            fontSize: 12, color: "var(--slate)", whiteSpace: "nowrap",
          }}>{slot.title}</div>
        </div>
        <div style={{ fontSize: 12, color: "var(--slate)", whiteSpace: "nowrap" }}>{slot.duration}</div>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, dayIndex, slotIndex)}
      onDrop={e => onDrop(e, dayIndex, slotIndex)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      style={{
        display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start",
        opacity: isDragOver ? 0.4 : 1,
        transition: "opacity .15s, transform .15s",
      }}
    >
      {/* Drag handle + time */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", paddingTop: 6, minWidth: 52 }}>
        <span style={{
          fontSize: 16, color: "var(--slate)", cursor: "grab",
          lineHeight: 1, marginBottom: 4, userSelect: "none", opacity: .5,
        }}>⠿</span>
        <span style={{ fontSize: 11, color: "var(--slate)", fontWeight: 500 }}>{slot.time}</span>
      </div>

      {/* Timeline dot */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{
          width: 10, height: 10, borderRadius: "50%",
          background: meta.color, flexShrink: 0, marginTop: 8,
        }} />
      </div>

      {/* Card */}
      <div
        style={{
          flex: 1, background: "white", border: "1px solid var(--border)",
          borderRadius: 8, padding: "10px 14px", cursor: "pointer",
          borderLeft: `3px solid ${meta.color}`,
          transition: "box-shadow .15s",
        }}
        onClick={() => setOpen(o => !o)}
        onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 12px rgba(26,22,18,0.08)"}
        onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{
                fontSize: 10, fontWeight: 500, padding: "2px 7px",
                borderRadius: 8, background: meta.bg, color: meta.color,
              }}>{meta.label}</span>
              {slot.neighbourhood && (
                <span style={{ fontSize: 11, color: "var(--slate)" }}>📍 {slot.neighbourhood}</span>
              )}
              {slot.cost && <span style={{ fontSize: 11, color: "var(--slate)" }}>{slot.cost}</span>}
              {slot.weather_sensitive && (
                <span title="Weather-sensitive activity" style={{ fontSize: 11 }}>🌤</span>
              )}
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>{slot.title}</div>
          </div>
          <span style={{ fontSize: 11, color: "var(--slate)", flexShrink: 0, opacity: .6 }}>
            {slot.duration} {open ? "▲" : "▼"}
          </span>
        </div>
        {open && (
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 13, color: "var(--slate)", lineHeight: 1.6, marginBottom: 8 }}>
              {slot.description}
            </p>
            {slot.tip && (
              <div style={{
                fontSize: 12, color: "var(--clay-dark)", background: "var(--clay-light)",
                borderRadius: 6, padding: "6px 10px", display: "flex", gap: 6,
              }}>
                <span>💡</span><span>{slot.tip}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Draggable day card ───────────────────────────────────────────────────────
function DayCard({ day, dayIndex, weatherSummary, onDragStart, onDrop, onDragOver, onDragLeave, dragOver,
                   onDayDragStart, onDayDrop, onDayDragOver, onDayDragLeave, isDayDragOver }) {
  const [expanded, setExpanded] = useState(true);
  const w = weatherSummary?.find(ws => ws.day === day.day);
  const wm = w ? (WEATHER_ICON[w.weather] || WEATHER_ICON.cloudy) : null;

  return (
    <div
      draggable
      onDragStart={e => onDayDragStart(e, dayIndex)}
      onDrop={e => onDayDrop(e, dayIndex)}
      onDragOver={onDayDragOver}
      onDragLeave={onDayDragLeave}
      style={{
        background: "white", border: "1px solid var(--border)",
        borderRadius: 12, overflow: "hidden", marginBottom: 16,
        opacity: isDayDragOver ? 0.5 : 1,
        transition: "opacity .15s, box-shadow .15s",
        boxShadow: isDayDragOver ? "0 0 0 2px var(--clay)" : "none",
      }}
    >
      {/* Day header */}
      {/* Pre-compute total commute minutes for this day */}
      {(() => {
        const totalCommute = day.slots.reduce((acc, s) => acc + (s.commute_to_next?.time || 0), 0);
        return null; // just for side-effect-free declaration — we use inline below
      })()}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", cursor: "pointer", background: "var(--paper2)",
          borderBottom: expanded ? "1px solid var(--border)" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Day drag handle */}
          <span style={{ fontSize: 18, color: "var(--slate)", cursor: "grab", userSelect: "none", opacity: .4 }}>⠿</span>
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            background: "var(--clay)", color: "white",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 500, flexShrink: 0,
          }}>{day.day}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, fontFamily: "'Playfair Display', serif" }}>
              {day.theme}
            </div>
            <div style={{ fontSize: 11, color: "var(--slate)" }}>{day.summary}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Commute total badge */}
          {(() => {
            const total = day.slots.reduce((a, s) => a + (s.commute_to_next?.time || 0), 0);
            return total > 0 ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 9px", borderRadius: 16,
                background: "var(--paper)", border: "1px solid var(--border)",
                fontSize: 11, color: "var(--slate)",
              }}>
                <span>🗺</span>
                <span>{total} min travel</span>
              </div>
            ) : null;
          })()}

          {/* Weather badge in header */}
          {wm && (
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "3px 10px", borderRadius: 16,
              background: wm.bg, border: `1px solid ${wm.border}`,
              fontSize: 11, color: wm.text,
            }}>
              <span style={{ fontSize: 13 }}>{wm.icon}</span>
              {w.temp && <span>{w.temp}</span>}
              {w.rain_chance && w.rain_chance !== "0%" && <span style={{ opacity: .7 }}>· 💧{w.rain_chance}</span>}
            </div>
          )}
          <span style={{ fontSize: 12, color: "var(--slate)" }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Drop zone at top of day */}
      {expanded && (
        <div style={{ padding: "12px 16px 4px" }}>
          <DropZone
            dayIndex={dayIndex}
            slotIndex={0}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            isActive={dragOver?.dayIndex === dayIndex && dragOver?.slotIndex === 0}
          />
          {day.slots.map((slot, si) => (
            <div key={slot.id || si}>
              <SlotCard
                slot={slot}
                dayIndex={dayIndex}
                slotIndex={si}
                onDragStart={onDragStart}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                isDragOver={dragOver?.dayIndex === dayIndex && dragOver?.slotIndex === si + 0.5}
              />
              {slot.commute_to_next && si < day.slots.length - 1 && (
                <CommuteBar commute={slot.commute_to_next} />
              )}
              <DropZone
                dayIndex={dayIndex}
                slotIndex={si + 1}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                isActive={dragOver?.dayIndex === dayIndex && dragOver?.slotIndex === si + 1}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Thin drop zone line between slots
function DropZone({ dayIndex, slotIndex, onDrop, onDragOver, onDragLeave, isActive }) {
  return (
    <div
      onDrop={e => onDrop(e, dayIndex, slotIndex, true)}
      onDragOver={e => { e.preventDefault(); onDragOver(e, dayIndex, slotIndex); }}
      onDragLeave={onDragLeave}
      style={{
        height: isActive ? 28 : 6,
        borderRadius: 4,
        margin: "2px 0",
        background: isActive ? "var(--clay-light)" : "transparent",
        border: isActive ? "1.5px dashed var(--clay)" : "1.5px dashed transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all .15s",
        fontSize: 11, color: "var(--clay-dark)",
      }}
    >
      {isActive && "Drop here"}
    </div>
  );
}

// ─── Time recalculation after drag ──────────────────────────────────────────
// Parses "9:30 AM" → total minutes from midnight
function parseTime(str) {
  if (!str) return 540; // default 9:00 AM
  const match = str.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 540;
  let [, h, m, ampm] = match;
  h = parseInt(h); m = parseInt(m);
  if (ampm.toUpperCase() === "PM" && h !== 12) h += 12;
  if (ampm.toUpperCase() === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

// Formats total minutes → "9:30 AM"
function formatTime(mins) {
  const clamped = Math.max(360, Math.min(mins, 1380)); // clamp 6am–11pm
  const h24 = Math.floor(clamped / 60);
  const m   = clamped % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12  = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Parses "45 min" / "1 hr 30 min" / "2 hours" → minutes
function parseDuration(str) {
  if (!str) return 60;
  const hrMatch  = str.match(/(\d+)\s*h/i);
  const minMatch = str.match(/(\d+)\s*m/i);
  return (hrMatch ? parseInt(hrMatch[1]) * 60 : 0) + (minMatch ? parseInt(minMatch[1]) : 0) || 60;
}

// Walks slots in order and assigns new start times based on duration + commute
function recalculateTimes(slots) {
  if (!slots.length) return slots;
  let cursor = parseTime(slots[0].time); // anchor to first slot's original time
  return slots.map((slot, i) => {
    const newSlot = { ...slot, time: formatTime(cursor) };
    const dur     = parseDuration(slot.duration);
    const commute = slot.commute_to_next?.time || 0;
    cursor += dur + commute;
    return newSlot;
  });
}

// ─── Itinerary view with drag state ──────────────────────────────────────────
function ItineraryView({ data, meta, model, isSurprise, usedOrModel, onReset }) {
  const [days, setDays] = useState(data.days.map((d, i) => ({
    ...d,
    slots: d.slots.map((s, j) => ({ ...s, id: s.id || `d${i}s${j}` })),
  })));

  const dragRef = useRef(null);      // { type: 'slot'|'day', dayIndex, slotIndex }
  const [dragOver, setDragOver] = useState(null);
  const [dayDragOver, setDayDragOver] = useState(null);

  // ── Slot drag handlers ──
  const handleSlotDragStart = useCallback((e, dayIndex, slotIndex) => {
    dragRef.current = { type: "slot", dayIndex, slotIndex };
    e.dataTransfer.effectAllowed = "move";
    e.stopPropagation(); // prevent day drag from firing
  }, []);

  const handleSlotDrop = useCallback((e, toDayIndex, toSlotIndex, isZone = false) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
    const src = dragRef.current;
    if (!src || src.type !== "slot") return;
    const { dayIndex: fromDay, slotIndex: fromSlot } = src;

    setDays(prev => {
      const next = prev.map(d => ({ ...d, slots: [...d.slots] }));
      const moving = next[fromDay].slots[fromSlot];
      next[fromDay].slots.splice(fromSlot, 1);

      // Adjust target index if same day and moving down
      let insertAt = toSlotIndex;
      if (fromDay === toDayIndex && fromSlot < toSlotIndex) insertAt = Math.max(0, toSlotIndex - 1);
      next[toDayIndex].slots.splice(insertAt, 0, moving);
      // Recalculate start times for any affected day
      const affectedDays = fromDay === toDayIndex ? [toDayIndex] : [fromDay, toDayIndex];
      affectedDays.forEach(di => {
        next[di].slots = recalculateTimes(next[di].slots);
      });
      return next;
    });
    dragRef.current = null;
  }, []);

  const handleDragOver = useCallback((e, dayIndex, slotIndex) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver({ dayIndex, slotIndex });
    setDayDragOver(null);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(null);
  }, []);

  // ── Day drag handlers ──
  const handleDayDragStart = useCallback((e, dayIndex) => {
    if (dragRef.current?.type === "slot") return; // slot drag takes priority
    dragRef.current = { type: "day", dayIndex };
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDayDrop = useCallback((e, toDayIndex) => {
    e.preventDefault();
    const src = dragRef.current;
    if (!src || src.type !== "day") return;
    const fromDay = src.dayIndex;
    if (fromDay === toDayIndex) return;
    setDays(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromDay, 1);
      next.splice(toDayIndex, 0, moved);
      // Re-number days and recalculate times within each day
      return next.map((d, i) => ({
        ...d,
        day: i + 1,
        date_label: `Day ${i + 1}`,
        slots: recalculateTimes(d.slots),
      }));
    });
    setDayDragOver(null);
    dragRef.current = null;
  }, []);

  const handleDayDragOver = useCallback((e, dayIndex) => {
    e.preventDefault();
    if (dragRef.current?.type === "day") setDayDragOver(dayIndex);
  }, []);

  const handleDayDragLeave = useCallback(() => {
    setDayDragOver(null);
  }, []);

  const modelLabel = (() => {
    if (model === "openrouter") {
      const or = PROVIDERS.find(p => p.id === "openrouter")?.models.find(m => m.id === usedOrModel);
      return or ? `⊕ ${or.label}` : "⊕ OpenRouter";
    }
    return model === "claude" ? "◈ Anthropic" : "⬡ OpenAI";
  })();

  return (
    <div>
      {/* Surprise banner */}
      {isSurprise && (
        <div style={{
          background: "linear-gradient(135deg, #f5e6ff 0%, #fce8d5 100%)",
          border: "1px solid #d4a8f0", borderRadius: 10, padding: "10px 16px",
          marginBottom: 16, display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 22 }}>✨</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#5a2d82" }}>Surprise itinerary</div>
            <div style={{ fontSize: 12, color: "#7a4daa" }}>
              Generated with a unique creative angle — different from your standard plan
            </div>
          </div>
          <button onClick={() => generate(true)} style={{
            marginLeft: "auto", padding: "6px 14px", borderRadius: 8,
            border: "1px solid #d4a8f0", background: "white",
            color: "#5a2d82", fontSize: 12, cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
            whiteSpace: "nowrap",
          }}>✨ Another surprise</button>
        </div>
      )}

      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>

            <span style={{
              fontSize: 11, fontWeight: 500, padding: "2px 10px",
              borderRadius: 12, background: "var(--paper2)", color: "var(--slate)",
              border: "1px solid var(--border)",
            }}>{modelLabel}</span>
            {meta?.weather_loaded && (
              <span style={{
                fontSize: 11, padding: "2px 10px", borderRadius: 12,
                background: "#e8f0f8", color: "#1e3a5f", border: "1px solid #7b9fc4",
              }}>🌤 Weather-adapted</span>
            )}
            {meta?.rag_loaded && (
              <span style={{
                fontSize: 11, padding: "2px 10px", borderRadius: 12,
                background: "#ddeadf", color: "#085041", border: "1px solid #6b8f71",
              }}>📍 Local expert data</span>
            )}
          </div>
          <h1 style={{
            fontSize: 26, lineHeight: 1.2,
            fontFamily: "'Playfair Display', serif", marginBottom: 4,
          }}>{data.title}</h1>
          <p style={{ fontSize: 14, color: "var(--slate)", fontStyle: "italic" }}>{data.tagline}</p>
          {data.weather_note && (
            <p style={{ fontSize: 13, color: "#5c4010", marginTop: 6, background: "#fff8e1", padding: "5px 10px", borderRadius: 6, display: "inline-block" }}>
              ☀ {data.weather_note}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <ShareButton title={data.title} tagline={data.tagline} />
          <button onClick={onReset} style={{
            padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)",
            background: "white", color: "var(--slate)", fontSize: 13,
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          }}>← New plan</button>
        </div>
      </div>

      {/* Highlights */}
      {data.highlights?.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {data.highlights.map((h, i) => (
            <div key={i} style={{
              fontSize: 12, padding: "4px 12px", borderRadius: 16,
              background: "var(--amber-light)", color: "#7a5c1e", border: "1px solid #e8c97a",
            }}>✦ {h}</div>
          ))}
        </div>
      )}

      {/* Weather strip — all days at a glance */}
      {meta?.weather_summary?.length > 0 && (
        <div style={{
          background: "var(--paper2)", borderRadius: 10, padding: "12px 16px",
          marginBottom: 20, border: "1px solid var(--border)",
        }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--slate)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>
            Weather forecast
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {meta.weather_summary.map((w, i) => {
              const wm = WEATHER_ICON[w.weather] || WEATHER_ICON.cloudy;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 12px", borderRadius: 20,
                  background: wm.bg, border: `1px solid ${wm.border}`,
                  fontSize: 12, color: wm.text,
                }}>
                  <span style={{ fontSize: 14 }}>{wm.icon}</span>
                  <span style={{ fontWeight: 500 }}>Day {w.day}</span>
                  {w.summary && <span style={{ opacity: .7 }}>· {w.summary}</span>}
                  {w.temp && <span style={{ opacity: .8 }}>{w.temp}</span>}
                  {w.rain_chance && w.rain_chance !== "0%" && (
                    <span style={{ opacity: .7 }}>💧{w.rain_chance}</span>
                  )}
                  {w.outdoor_suitable === false && (
                    <span title="Some outdoor activities adjusted" style={{ opacity: .9 }}>⚠</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Drag hint */}
      <div style={{
        fontSize: 11, color: "var(--slate)", marginBottom: 12,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{ opacity: .5 }}>⠿</span>
        Drag activities to rearrange within a day · Drag day headers to reorder days
      </div>

      {/* Days */}
      {days.map((day, di) => (
        <DayCard
          key={day.day + "-" + di}
          day={day}
          dayIndex={di}
          weatherSummary={meta?.weather_summary}
          onDragStart={handleSlotDragStart}
          onDrop={handleSlotDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          dragOver={dragOver}
          onDayDragStart={handleDayDragStart}
          onDayDrop={handleDayDrop}
          onDayDragOver={(e) => handleDayDragOver(e, di)}
          onDayDragLeave={handleDayDragLeave}
          isDayDragOver={dayDragOver === di}
        />
      ))}

      <div style={{
        marginTop: 20, padding: "14px 20px", borderRadius: 10,
        background: "var(--paper2)", border: "1px solid var(--border)",
        fontSize: 12, color: "var(--slate)", textAlign: "center",
      }}>
        Itinerary excludes hotels & intercity travel · Costs approximate · Always verify opening hours locally
      </div>
    </div>
  );
}

// ─── URL share helpers ───────────────────────────────────────────────────────
function encodeItinerary(itinerary, meta) {
  try {
    const payload = JSON.stringify({ itinerary, meta });
    return btoa(encodeURIComponent(payload));
  } catch { return null; }
}

function decodeItinerary(hash) {
  try {
    const encoded = hash.replace(/^#data=/, "");
    if (!encoded) return null;
    return JSON.parse(decodeURIComponent(atob(encoded)));
  } catch { return null; }
}

function ShareButton({ title, tagline }) {
  const [state, setState] = useState("idle"); // idle | copied | shared | open
  const url = typeof window !== "undefined" ? window.location.href : "";

  const shareText = title
    ? `${title} — planned with TripPivotal`
    : "Check out this travel itinerary I planned!";

  async function handleShare() {
    // 1. Try Web Share API — triggers native sheet on mobile (WhatsApp, iMessage, etc.)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: shareText, text: tagline || shareText, url });
        setState("shared");
        setTimeout(() => setState("idle"), 2500);
        return;
      } catch (err) {
        if (err.name === "AbortError") return; // user dismissed — do nothing
      }
    }
    // 2. Desktop fallback — show social links panel
    setState(prev => prev === "open" ? "idle" : "open");
  }

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    });
  }

  const encoded = encodeURIComponent(url);
  const encodedText = encodeURIComponent(shareText);
  const SOCIALS = [
    { label: "WhatsApp",  color: "#25D366", href: `https://wa.me/?text=${encodedText}%20${encoded}`,          icon: "W" },
    { label: "X",         color: "#000000", href: `https://x.com/intent/tweet?text=${encodedText}&url=${encoded}`, icon: "𝕏" },
    { label: "Facebook",  color: "#1877F2", href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,  icon: "f" },
    { label: "Telegram",  color: "#2AABEE", href: `https://t.me/share/url?url=${encoded}&text=${encodedText}`, icon: "T" },
    { label: "Email",     color: "#6b8f71", href: `mailto:?subject=${encodedText}&body=${encoded}`,           icon: "✉" },
  ];

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={handleShare}
        style={{
          padding: "8px 16px", borderRadius: 8,
          border: "1px solid var(--border)",
          background: state === "shared" || state === "copied" ? "var(--sage-light)" : "white",
          color: state === "shared" || state === "copied" ? "var(--sage)" : "var(--slate)",
          fontSize: 13, cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif", transition: "all .2s",
          display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
        }}
      >
        {state === "shared" ? "✓ Shared!" : state === "copied" ? "✓ Copied!" : "↗ Share"}
      </button>

      {/* Desktop social panel — shown when Web Share API unavailable */}
      {state === "open" && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          background: "white", border: "1px solid var(--border)",
          borderRadius: 12, padding: "12px 14px", zIndex: 300,
          boxShadow: "0 4px 20px rgba(26,22,18,0.12)",
          minWidth: 220,
        }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--slate)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>
            Share itinerary
          </div>

          {/* Social buttons */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {SOCIALS.map(s => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                title={s.label}
                style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: s.color, color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, textDecoration: "none",
                  flexShrink: 0, transition: "opacity .15s",
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = ".82"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
              >
                {s.icon}
              </a>
            ))}
          </div>

          {/* Copy link row */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "var(--paper2)", borderRadius: 6, padding: "6px 8px",
          }}>
            <span style={{
              flex: 1, fontSize: 11, color: "var(--slate)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{url.length > 42 ? url.slice(0, 42) + "…" : url}</span>
            <button
              onClick={copyLink}
              style={{
                padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)",
                background: "white", fontSize: 11, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif", color: "var(--slate)",
                flexShrink: 0, whiteSpace: "nowrap",
              }}
            >
              {state === "copied" ? "✓" : "Copy"}
            </button>
          </div>

          {/* Close */}
          <button
            onClick={() => setState("idle")}
            style={{
              position: "absolute", top: 8, right: 10,
              background: "none", border: "none", fontSize: 16,
              cursor: "pointer", color: "var(--slate)", lineHeight: 1,
            }}
          >×</button>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Home() {
  const [provider, setProvider]   = useState("claude");
  const [orModel, setOrModel]     = useState("meta-llama/llama-3.3-70b-instruct:free");

  // Restore shared itinerary from URL hash if present (no API call)
  const shared = typeof window !== "undefined"
    ? decodeItinerary(window.location.hash)
    : null;

  const [step, setStep]           = useState(shared ? 3 : 1);
  const [itinerary, setItinerary] = useState(shared?.itinerary || null);
  const [meta, setMeta]           = useState(shared?.meta || null);
  const [error, setError]         = useState("");
  const [usedModel, setUsedModel] = useState(shared ? "claude" : "claude");
  const [usedOrModel, setUsedOrModel] = useState("");
  const [agents, setAgents]       = useState([]);
  const [isSurprise, setIsSurprise] = useState(false);

  const [prefs, setPrefs] = useState({
    city: "", days: 3, group: "Solo",
    pace: "Moderate", budget: "Mid-range",
    interests: ["history", "offbeat"],
    foodStyle: ["local", "street"],
    transport: ["walking", "metro"],
    notes: "",
  });

  const toggle = (field, val) => setPrefs(p => ({
    ...p,
    [field]: p[field].includes(val) ? p[field].filter(x => x !== val) : [...p[field], val],
  }));

  const AGENT_STEPS = [
    { id: "weather",   label: "Fetching weather forecast", icon: "🌤" },
    { id: "rag",       label: "Loading local knowledge",   icon: "📍" },
    { id: "sight",     label: "Sightseeing agent",         icon: "🗺" },
    { id: "food",      label: "Food & drinks agent",       icon: "🍲" },
    { id: "builder",   label: "Itinerary builder",         icon: "📋" },
  ];

  async function generate(surprise = false) {
    if (!prefs.city.trim()) { setError("Please enter a city."); return; }
    setError("");
    setStep(2);
    setUsedModel(provider);
    setUsedOrModel(orModel);
    setIsSurprise(surprise);
    setAgents(AGENT_STEPS.map((a, i) => ({ ...a, status: i === 0 ? "running" : "pending" })));

    for (let i = 0; i < AGENT_STEPS.length; i++) {
      await delay(450 + Math.random() * 350);
      setAgents(prev => prev.map((a, idx) => ({
        ...a,
        status: idx < i + 1 ? "done" : idx === i + 1 ? "running" : "pending",
      })));
    }

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: { ...prefs, openrouter_model: orModel }, model: provider, surprise }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAgents(AGENT_STEPS.map(a => ({ ...a, status: "done" })));
      await delay(300);
      setItinerary(data.itinerary);
      setMeta(data.meta);
      setStep(3);
      // Write shareable URL — recipient lands on result page, no API call made
      const encoded = encodeItinerary(data.itinerary, data.meta);
      if (encoded && typeof window !== "undefined") {
        window.history.replaceState(null, "", `#data=${encoded}`);
      }
    } catch (e) {
      setError(e.message || "Generation failed");
      setStep(1);
    }
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  const labelStyle = {
    fontSize: 11, fontWeight: 500, letterSpacing: ".06em",
    color: "var(--slate)", textTransform: "uppercase", marginBottom: 10, display: "block",
  };
  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 8,
    border: "1px solid var(--border)", fontSize: 14,
    fontFamily: "'DM Sans', sans-serif", color: "var(--ink)",
    background: "white", outline: "none",
  };

  return (
    <>
      <Head>
        <title>TripPiovtal — Smart Itinerary Planner</title>
        <meta name="description" content="AI-powered local city itinerary planner" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧭</text></svg>" />
      </Head>

      <header style={{
        borderBottom: "1px solid var(--border)", padding: "0 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 60, background: "white", position: "sticky", top: 0, zIndex: 100,
      }}>
         <div onClick={() => { setStep(1); setItinerary(null); setMeta(null); setIsSurprise(false); setUsedOrModel(""); }}
  style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
		  <span style={{ fontSize: 22 }}>🧭</span>
		  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600 }}>TripPivotal</span>
		  <span style={{ fontSize: 12, color: "var(--slate)", marginLeft: 4, fontStyle: "italic" }}>Smart planner</span>
	</div>
     
        <ModelPicker provider={provider} orModel={orModel} onProviderChange={setProvider} onOrModelChange={setOrModel} />
      </header>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 64px" }}>

        {/* ── Step 1: Form ── */}
        {step === 1 && (
          <div>
            <div style={{ marginBottom: 36, textAlign: "center" }}>
              <h1 style={{ fontSize: 36, marginBottom: 10, lineHeight: 1.15 }}>
                Plan your perfect<br />
                <em style={{ color: "var(--clay)" }}>local adventure</em>
              </h1>
              <p style={{ fontSize: 15, color: "var(--slate)" }}>
                Sightseeing, food, drinks & getting around — no hotels, no flights.
              </p>
            </div>

            {error && (
              <div style={{
                background: "#fde8e8", border: "1px solid #f5a5a5", borderRadius: 8,
                padding: "10px 14px", fontSize: 13, color: "#b91c1c", marginBottom: 20,
              }}>{error}</div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 16, marginBottom: 28 }}>
              <div>
                <span style={labelStyle}>City / destination</span>
                <input style={inputStyle} placeholder="e.g. London, Tokyo, Lisbon..."
                  value={prefs.city} onChange={e => setPrefs(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div>
                <span style={labelStyle}>Days</span>
                <input type="number" min={1} max={10} style={inputStyle}
                  value={prefs.days}
                  onChange={e => setPrefs(p => ({ ...p, days: Math.max(1, Math.min(10, +e.target.value)) }))} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 28 }}>
              {[
                { label: "Group",  field: "group",  opts: ["Solo", "Couple", "Small group", "Family"] },
                { label: "Pace",   field: "pace",   opts: ["Slow & deep", "Moderate", "Packed"] },
                { label: "Budget", field: "budget", opts: ["Budget", "Mid-range", "Comfort", "Luxury"] },
              ].map(({ label, field, opts }) => (
                <div key={field}>
                  <span style={labelStyle}>{label}</span>
                  <select style={{ ...inputStyle, cursor: "pointer" }}
                    value={prefs[field]} onChange={e => setPrefs(p => ({ ...p, [field]: e.target.value }))}>
                    {opts.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 24 }}>
              <span style={labelStyle}>Interests</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {INTERESTS.map(({ id, label, icon }) => (
                  <Chip key={id} selected={prefs.interests.includes(id)} onClick={() => toggle("interests", id)}>
                    <span style={{ fontSize: 15 }}>{icon}</span> {label}
                  </Chip>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <span style={labelStyle}>Food & drink style</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {FOOD.map(({ id, label, icon }) => (
                  <Chip key={id} selected={prefs.foodStyle.includes(id)} onClick={() => toggle("foodStyle", id)}>
                    <span style={{ fontSize: 15 }}>{icon}</span> {label}
                  </Chip>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <span style={labelStyle}>In-city transport</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {TRANSPORT.map(({ id, label, icon }) => (
                  <Chip key={id} selected={prefs.transport.includes(id)} onClick={() => toggle("transport", id)}>
                    <span style={{ fontSize: 15 }}>{icon}</span> {label}
                  </Chip>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 32 }}>
              <span style={labelStyle}>Anything else? (optional)</span>
              <textarea style={{ ...inputStyle, height: 72, resize: "vertical" }}
                placeholder="e.g. vegetarian only, mobility needs, specific neighbourhoods..."
                value={prefs.notes} onChange={e => setPrefs(p => ({ ...p, notes: e.target.value }))} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => generate(false)} style={{
                  flex: 1, padding: "14px 24px", background: "var(--clay)", color: "white",
                  border: "none", borderRadius: 10, fontSize: 15, fontWeight: 500,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "opacity .15s",
                }}
                  onMouseEnter={e => e.currentTarget.style.opacity = ".88"}
                  onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                >Build my itinerary →</button>
                <button onClick={() => generate(true)} style={{
                  padding: "14px 20px", borderRadius: 10, fontSize: 15,
                  border: "1.5px solid #d4a8f0",
                  background: "linear-gradient(135deg, #f5e6ff 0%, #fce8d5 100%)",
                  color: "#5a2d82", fontWeight: 500, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif", transition: "opacity .15s",
                  whiteSpace: "nowrap",
                }}
                  onMouseEnter={e => e.currentTarget.style.opacity = ".82"}
                  onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                  title="Same preferences, totally different creative angle"
                >✨ Surprise me</button>
              </div>
              <div style={{ fontSize: 12, color: "var(--slate)", textAlign: "center" }}>
                Surprise me generates an unconventional itinerary with the same preferences
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Loading ── */}
        {step === 2 && (
          <div style={{ maxWidth: 440, margin: "64px auto 0", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🧭</div>
            <h2 style={{ fontSize: 22, marginBottom: 6 }}>Building your plan</h2>
            <p style={{ fontSize: 14, color: "var(--slate)", marginBottom: 32 }}>
              {prefs.city} · {prefs.days} day{prefs.days > 1 ? "s" : ""} · {provider === "openrouter" ? "OpenRouter" : provider === "claude" ? "Anthropic" : "OpenAI"}
            </p>
            <div style={{ textAlign: "left" }}>
              {agents.map(a => (
                <div key={a.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 16px", borderRadius: 8, marginBottom: 8,
                  background: a.status === "done" ? "var(--sage-light)" : a.status === "running" ? "var(--amber-light)" : "var(--paper2)",
                  border: `1px solid ${a.status === "done" ? "#b5d4b8" : a.status === "running" ? "#e8c97a" : "var(--border)"}`,
                  transition: "all .3s",
                }}>
                  <span style={{ fontSize: 18 }}>{a.icon}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: a.status === "running" ? 500 : 400 }}>{a.label}</span>
                  <span style={{ fontSize: 14 }}>
                    {a.status === "done" ? "✅" : a.status === "running" ? "⏳" : "○"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3: Result ── */}
        {step === 3 && itinerary && (
          <ItineraryView
            data={itinerary}
            meta={meta}
            model={usedModel}
            isSurprise={isSurprise}
            usedOrModel={usedOrModel}
            onReset={() => {
              setStep(1); setItinerary(null); setMeta(null);
              setIsSurprise(false); setUsedOrModel("");
              if (typeof window !== "undefined")
                window.history.replaceState(null, "", window.location.pathname);
            }}
          />
        )}

      </main>
    </>
  );
}
