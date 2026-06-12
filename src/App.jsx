import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5001";
const CHART_WIDTH = 560;
const CHART_HEIGHT = 240;
const PLOT = {
  left: 58,
  right: 18,
  top: 18,
  bottom: 48,
};

function formatValue(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "--";
}

function formatTime(value) {
  if (!value) {
    return "No data yet";
  }

  return new Date(value).toLocaleString();
}

function formatShortTime(value) {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getTdsStatus(tds) {
  const value = Number(tds);

  if (!Number.isFinite(value)) {
    return { label: "No data", className: "tds-status-empty" };
  }

  if (value > 900) {
    return { label: "Dangerous", className: "tds-status-dangerous" };
  }

  if (value >= 500) {
    return { label: "Warning", className: "tds-status-warning" };
  }

  if (value >= 300) {
    return { label: "Moderate", className: "tds-status-moderate" };
  }

  return { label: "Good", className: "tds-status-good" };
}

function buildChartData(readings, key, digits, unit) {
  if (!readings.length) {
    return {
      points: "",
      markers: [],
      yTicks: [],
      rangeLabel: `-- ${unit}`,
      startLabel: "--",
      endLabel: "--",
    };
  }

  const values = readings.map((reading) => Number(reading[key] ?? 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const isFlat = range === 0;
  const visualPadding = isFlat ? Math.max(Math.abs(max) * 0.02, 0.5) : range * 0.08;
  const domainMin = min >= 0 ? Math.max(0, min - visualPadding) : min - visualPadding;
  const domainMax = max + visualPadding;
  const domainRange = domainMax - domainMin || 1;
  const plotWidth = CHART_WIDTH - PLOT.left - PLOT.right;
  const plotHeight = CHART_HEIGHT - PLOT.top - PLOT.bottom;

  const markers = values.map((value, index) => {
    const x = PLOT.left + (index * plotWidth) / Math.max(values.length - 1, 1);
    const y = PLOT.top + ((domainMax - value) * plotHeight) / domainRange;
    return { x, y };
  });

  return {
    points: markers.map(({ x, y }) => `${x},${y}`).join(" "),
    markers,
    yTicks: [
      { value: domainMax, y: PLOT.top },
      { value: (domainMin + domainMax) / 2, y: PLOT.top + plotHeight / 2 },
      { value: domainMin, y: PLOT.top + plotHeight },
    ],
    rangeLabel: `${formatValue(min, digits)} - ${formatValue(max, digits)} ${unit}`,
    startLabel: formatShortTime(readings[0]?.receivedAt),
    endLabel: formatShortTime(readings[readings.length - 1]?.receivedAt),
  };
}

function MetricCard({ label, value, unit, accent, subtitle }) {
  return (
    <article className="metric-card">
      <span className="metric-accent" style={{ background: accent }} />
      <p className="metric-label">{label}</p>
      <div className="metric-value-row">
        <strong className="metric-value">{value}</strong>
        <span className="metric-unit">{unit}</span>
      </div>
      <p className="metric-subtitle">{subtitle}</p>
    </article>
  );
}

function TrendChart({ readings, field, digits, unit, gradientId, stops, ariaLabel }) {
  const chart = useMemo(
    () => buildChartData(readings, field, digits, unit),
    [readings, field, digits, unit]
  );
  const plotWidth = CHART_WIDTH - PLOT.left - PLOT.right;
  const plotHeight = CHART_HEIGHT - PLOT.top - PLOT.bottom;

  return (
    <div className="chart-frame">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="trend-chart"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            {stops.map((color, index) => (
              <stop key={color} offset={`${index * 100}%`} stopColor={color} />
            ))}
          </linearGradient>
        </defs>

        <g className="chart-grid">
          {chart.yTicks.map((tick) => (
            <line key={tick.y} x1={PLOT.left} x2={PLOT.left + plotWidth} y1={tick.y} y2={tick.y} />
          ))}
        </g>

        <line
          className="chart-axis"
          x1={PLOT.left}
          x2={PLOT.left}
          y1={PLOT.top}
          y2={PLOT.top + plotHeight}
        />
        <line
          className="chart-axis"
          x1={PLOT.left}
          x2={PLOT.left + plotWidth}
          y1={PLOT.top + plotHeight}
          y2={PLOT.top + plotHeight}
        />

        <g className="chart-axis-labels">
          {chart.yTicks.map((tick) => (
            <text key={tick.y} x={PLOT.left - 10} y={tick.y + 4} textAnchor="end">
              {formatValue(tick.value, digits)}
            </text>
          ))}
          <text x={PLOT.left} y={CHART_HEIGHT - 16} textAnchor="start">
            {chart.startLabel}
          </text>
          <text x={PLOT.left + plotWidth} y={CHART_HEIGHT - 16} textAnchor="end">
            {chart.endLabel}
          </text>
        </g>

        <polyline
          className="chart-line"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="4"
          points={chart.points}
        />
        <g className="chart-points">
          {chart.markers.map(({ x, y }, index) => (
            <circle key={`${x}-${y}-${index}`} cx={x} cy={y} r="3.5" />
          ))}
        </g>
      </svg>
      <div className="chart-range">
        <span>Range</span>
        <strong>{chart.rangeLabel}</strong>
      </div>
    </div>
  );
}

function App() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // UI state for reading selection and pagination
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [preset, setPreset] = useState("latest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20); // default show last 20

  useEffect(() => {
    let active = true;

    async function loadOverview() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/overview?limit=24`);
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || `Failed to load dashboard data from ${API_BASE_URL}.`);
        }

        if (active) {
          setOverview(payload);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadOverview();
    const timer = setInterval(loadOverview, 15000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const latest = overview?.latest;
  const readings = overview?.readings ?? [];
  const latestStatus = getTdsStatus(latest?.tds);
  // Limit chart data to latest 20 samples
  const chartReadings = readings.slice(-20);

  // Helper: paginate an array (1-based page)
  function paginate(array, pageNumber, size) {
    const cappedSize = Math.min(size, 50); // never more than 50 per page
    const start = (Math.max(1, pageNumber) - 1) * cappedSize;
    return array.slice(start, start + cappedSize);
  }

  // Returns filtered readings (ascending by time) based on current range/preset
  function getFilteredReadings() {
    if (!readings.length) return [];

    let filtered = readings.slice();

    // If user has selected a preset range
    if (preset && preset !== "latest") {
      const now = Date.now();
      let startTs = null;

      if (preset === "7d") startTs = now - 7 * 24 * 60 * 60 * 1000;
      if (preset === "14d") startTs = now - 14 * 24 * 60 * 60 * 1000;
      if (preset === "1m") startTs = now - 30 * 24 * 60 * 60 * 1000;
      if (preset === "3m") startTs = now - 90 * 24 * 60 * 60 * 1000;

      if (startTs) {
        filtered = filtered.filter((r) => new Date(r.receivedAt).getTime() >= startTs);
      }
    }

    // If user set explicit range
    if (rangeStart) {
      const s = new Date(rangeStart).getTime();
      filtered = filtered.filter((r) => new Date(r.receivedAt).getTime() >= s);
    }
    if (rangeEnd) {
      const e = new Date(rangeEnd).getTime();
      filtered = filtered.filter((r) => new Date(r.receivedAt).getTime() <= e);
    }

    // Sort ascending by receivedAt so earliest first; UI shows reversed later for newest-first
    filtered.sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt));

    // Default state: latest only, show last N (pageSize default 20)
    if (preset === "latest" && !rangeStart && !rangeEnd) {
      const lastN = Math.min(pageSize, 20);
      return filtered.slice(-lastN);
    }

    return filtered;
  }

  const filteredReadings = getFilteredReadings();
  const totalPages = Math.max(1, Math.ceil(filteredReadings.length / Math.min(pageSize, 50)));
  const pagedReadings = paginate(filteredReadings, page, pageSize);

  return (
    <main className="dashboard-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Aquaculture Telemetry</p>
          <h1>Salinity live station.</h1>
          <p className="hero-text">
            A monitoring surface for temperature, TDS, EC, and salinity data flowing through the
            database.
          </p>
        </div>

        <div className="hero-status">
          <span className={`status-pill ${error ? "status-error" : "status-live"}`}>
            {error ? "Connection issue" : "Live feed active"}
          </span>
          <p className="status-time">Last update: {formatTime(latest?.receivedAt)}</p>
          <p className="status-trend">
            Trend: <strong>{overview?.trend ?? "stable"}</strong>
          </p>
          <p className="status-state">
            Status:
            <span className={`tds-status-badge ${latestStatus.className}`}>
              {latestStatus.label}
            </span>
          </p>
        </div>
      </section>

      {loading ? <section className="panel">Loading dashboard...</section> : null}
      {error ? <section className="panel error-panel">{error}</section> : null}

      <section className="metrics-grid">
        <MetricCard
          label="Temperature"
          value={formatValue(latest?.temperature, 1)}
          unit="C"
          accent="linear-gradient(180deg, #ff9b71, #ff5d5d)"
          subtitle={`24-sample avg ${formatValue(overview?.stats?.avgTemperature, 1)} C`}
        />
        <MetricCard
          label="TDS"
          value={formatValue(latest?.tds, 0)}
          unit="ppm"
          accent="linear-gradient(180deg, #6dd3ce, #2f80ed)"
          subtitle={`24-sample avg ${formatValue(overview?.stats?.avgTds, 0)} ppm`}
        />
        <MetricCard
          label="Electrical Conductivity"
          value={formatValue(latest?.ec, 0)}
          unit="uS/cm"
          accent="linear-gradient(180deg, #fbd786, #f7797d)"
          subtitle={`24-sample avg ${formatValue(overview?.stats?.avgEc, 0)} uS/cm`}
        />
        <MetricCard
          label="Salinity"
          value={formatValue(latest?.salinity, 2)}
          unit="ppt"
          accent="linear-gradient(180deg, #89f7fe, #66a6ff)"
          subtitle={`24-sample avg ${formatValue(overview?.stats?.avgSalinity, 2)} ppt`}
        />
      </section>

      <section className="content-grid">
        <article className="panel chart-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Salinity curve</p>
              <h2>Recent salinity movement</h2>
            </div>
            <p className="panel-note">Latest 20 samples</p>
          </div>
          <TrendChart
            readings={chartReadings}
            field="salinity"
            digits={2}
            unit="ppt"
            gradientId="salinityStroke"
            stops={["#ffd166", "#ef476f"]}
            ariaLabel="Salinity trend chart with range axes"
          />
        </article>

        <article className="panel chart-panel secondary-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Temperature curve</p>
              <h2>Thermal stability</h2>
            </div>
            <p className="panel-note">Latest 20 samples</p>
          </div>
          <TrendChart
            readings={chartReadings}
            field="temperature"
            digits={1}
            unit="C"
            gradientId="tempStroke"
            stops={["#ffd166", "#ef476f"]}
            ariaLabel="Temperature trend chart with range axes"
          />
        </article>
      </section>

      <section className="panel table-panel">
          <div className="panel-header">
          <div>
            <p className="panel-kicker">Telemetry ledger</p>
            <h2>Latest readings</h2>
          </div>
          <div className="panel-controls">
            <div className="controls-row">
              <label>
                Preset:
                <select
                  value={preset}
                  onChange={(e) => {
                    setPreset(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="latest">Latest</option>
                  <option value="7d">Last 7 days</option>
                  <option value="14d">Last 14 days</option>
                  <option value="1m">Last 1 month</option>
                  <option value="3m">Last 3 months</option>
                  <option value="custom">Time range</option>
                </select>
              </label>

              <label>
                Per page:
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setPageSize(Math.min(50, Math.max(1, v)));
                    setPage(1);
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </label>

              <p className="panel-note">{overview?.stats?.samples ?? 0} samples loaded</p>
            </div>

            <div className="controls-row range-row">
              {preset === "custom" ? (
                <>
                  <label className="range-input">
                    From:
                    <input
                      type="datetime-local"
                      value={rangeStart}
                      onChange={(e) => {
                        setRangeStart(e.target.value);
                        setPreset("custom");
                        setPage(1);
                      }}
                    />
                  </label>

                  <label className="range-input">
                    To:
                    <input
                      type="datetime-local"
                      value={rangeEnd}
                      onChange={(e) => {
                        setRangeEnd(e.target.value);
                        setPreset("custom");
                        setPage(1);
                      }}
                    />
                  </label>
                </>
              ) : (
                // keep the layout stable even when not showing inputs
                <div style={{ height: 0 }} />
              )}
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Device</th>
                <th>Temp</th>
                <th>Salinity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pagedReadings.length === 0 ? (
                <tr>
                  <td colSpan="5">No readings available yet.</td>
                </tr>
              ) : (
                pagedReadings
                  .slice()
                  .reverse()
                  .map((reading) => (
                    <tr key={reading.id}>
                      <td>{formatTime(reading.receivedAt)}</td>
                      <td>{reading.deviceId}</td>
                      <td>{formatValue(reading.temperature, 1)} C</td>
                      <td>{formatValue(reading.salinity, 2)} ppt</td>
                      <td>
                        {(() => {
                          const status = getTdsStatus(reading.tds);
                          return (
                            <span className={`tds-status-badge ${status.className}`}>
                              {status.label}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <div className="pagination">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              Prev
            </button>
            <span>
              Page {page} / {totalPages}
            </span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              Next
            </button>
          </div>
          <div className="table-summary">
            Showing {pagedReadings.length} of {filteredReadings.length} matching readings
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
