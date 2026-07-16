import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, MapPin, Wallet, ExternalLink, Bookmark, Layers, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

// ---- Point this at your running FastAPI server ----
// Local dev: leave as-is. Once deployed, change to your real domain,
// e.g. "https://api.yourdomain.com"
const API_BASE = "http://localhost:8001";

const SOURCE_STYLE = {
  "104": { bg: "#FDF3E3", border: "#E0A93C", text: "#7A4E10", label: "104" },
  Cake: { bg: "#E7F3EC", border: "#3F9764", text: "#1F5C3B", label: "Cake" },
};

const PAGE_SIZE = 20;

function fmtSalary(min, max, note) {
  if (min == null && max == null) {
    return note ? note.charAt(0).toUpperCase() + note.slice(1) : "Not disclosed";
  }
  const fmt = (n) => `NT$${Math.round(n).toLocaleString()}`;
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)} / mo`;
  return `${fmt(min ?? max)} / mo`;
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-CA"); // YYYY-MM-DD, unambiguous either language
  } catch {
    return iso;
  }
}

export default function JobHunterApp() {
  // ---- filter state ----
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sources, setSources] = useState({ "104": true, Cake: true });
  const [selectedCityIds, setSelectedCityIds] = useState([]);
  const [salaryMin, setSalaryMin] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);

  // ---- data from the API ----
  const [cities, setCities] = useState([]);
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState({});

  // debounce the search box so we're not firing a request on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  // reset to page 1 whenever a filter (other than page itself) changes
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, sources, selectedCityIds, salaryMin, sort]);

  // load the city list + stats once — these barely change, no need to refetch per filter
  useEffect(() => {
    fetch(`${API_BASE}/api/cities`)
      .then((r) => r.json())
      .then(setCities)
      .catch(() => {}); // non-critical — filters just won't show if this fails

    fetch(`${API_BASE}/api/stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  // the actual job search — refires whenever any filter or the page changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());

    const activeSources = Object.entries(sources).filter(([, on]) => on).map(([s]) => s);
    // only send `source` when exactly ONE is selected — sending it when both
    // (or neither) are on means "don't filter by source at all"
    if (activeSources.length === 1) params.set("source", activeSources[0]);

    selectedCityIds.forEach((id) => params.append("city_id", id));
    if (salaryMin) params.set("salary_min", salaryMin);
    params.set("sort", sort);
    params.set("page", page);
    params.set("page_size", PAGE_SIZE);

    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/api/jobs?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`API returned ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setJobs(data.results);
        setTotal(data.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [debouncedQuery, sources, selectedCityIds, salaryMin, sort, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggleCity = (id) => {
    setSelectedCityIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const taiwanCities = useMemo(() => cities.filter((c) => !c.is_overseas), [cities]);
  const overseasCity = useMemo(() => cities.find((c) => c.is_overseas), [cities]);

  return (
    <div style={{ fontFamily: "'Inter', 'Noto Sans TC', sans-serif", background: "#F7F5F0", minHeight: "100%", padding: "32px 20px", color: "#2B2A27" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <h1 style={{ fontFamily: "'Noto Serif TC', Georgia, serif", fontSize: 30, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>
              下一站
            </h1>
            <span style={{ fontFamily: "'Noto Serif TC', Georgia, serif", fontSize: 30, fontWeight: 600, color: "#B0562E" }}>Next Stop</span>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#6B6A64" }}>
            Live listings merged from 104 and Cake
            {stats && (
              <>
                {" · "}
                {stats.total_jobs.toLocaleString()} jobs total
                {stats.by_source.map((s) => (
                  <span key={s.source}>
                    {" · "}
                    {s.source}: {s.total_jobs.toLocaleString()}
                    {s.last_scraped_at && ` (updated ${fmtDate(s.last_scraped_at)})`}
                  </span>
                ))}
              </>
            )}
          </p>
        </div>

        {/* Search + top-level controls */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 260px" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: 11, color: "#9C9A91" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search job title or company"
              style={{ width: "100%", padding: "9px 12px 9px 34px", borderRadius: 8, border: "1px solid #DEDBD0", fontSize: 14, background: "#FFFFFF", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            {Object.keys(sources).map((s) => {
              const style = SOURCE_STYLE[s];
              const active = sources[s];
              return (
                <button
                  key={s}
                  onClick={() => setSources((p) => ({ ...p, [s]: !p[s] }))}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8,
                    border: `1px solid ${active ? style.border : "#DEDBD0"}`,
                    background: active ? style.bg : "#FFFFFF",
                    color: active ? style.text : "#9C9A91",
                    fontSize: 13, fontWeight: 500, cursor: "pointer",
                  }}
                >
                  <Layers size={13} />
                  {style.label}
                </button>
              );
            })}
          </div>

          <input
            type="number"
            value={salaryMin}
            onChange={(e) => setSalaryMin(e.target.value)}
            placeholder="Min salary (NT$/mo)"
            style={{ width: 150, padding: "9px 10px", borderRadius: 8, border: "1px solid #DEDBD0", fontSize: 13, background: "#FFFFFF" }}
          />

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid #DEDBD0", fontSize: 13, background: "#FFFFFF" }}
          >
            <option value="recent">Most recent</option>
            <option value="salary">Highest salary</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 20 }}>
          {/* City filter sidebar */}
          <div style={{ width: 160, flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#6B6A64", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.03em" }}>
              City
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto" }}>
              {taiwanCities.map((c) => (
                <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={selectedCityIds.includes(c.id)} onChange={() => toggleCity(c.id)} />
                  {c.city_en}
                </label>
              ))}
              {overseasCity && (
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", marginTop: 6, paddingTop: 6, borderTop: "1px solid #E7E4DB" }}>
                  <input type="checkbox" checked={selectedCityIds.includes(overseasCity.id)} onChange={() => toggleCity(overseasCity.id)} />
                  {overseasCity.city_en}
                </label>
              )}
              {selectedCityIds.length > 0 && (
                <button
                  onClick={() => setSelectedCityIds([])}
                  style={{ marginTop: 8, fontSize: 12, color: "#B0562E", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}
                >
                  Clear cities
                </button>
              )}
            </div>
          </div>

          {/* Results */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {error && (
              <div style={{ padding: 16, borderRadius: 10, background: "#FDECE7", color: "#A0402A", fontSize: 14, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <RefreshCw size={14} />
                Couldn't reach the API at {API_BASE} — make sure your FastAPI server is running ({error})
              </div>
            )}

            {!error && (
              <div style={{ fontSize: 13, color: "#9C9A91", marginBottom: 12 }}>
                {loading ? "Loading…" : `${total.toLocaleString()} result${total === 1 ? "" : "s"}`}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {!loading && !error && jobs.length === 0 && (
                <div style={{ textAlign: "center", padding: "48px 0", color: "#9C9A91", fontSize: 14 }}>
                  No listings match. Try clearing a filter.
                </div>
              )}

              {jobs.map((job) => {
                const style = SOURCE_STYLE[job.source];
                return (
                  <div key={job.job_uid} style={{ display: "flex", background: "#FFFFFF", border: "1px solid #E7E4DB", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ flex: 1, padding: "16px 18px", minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, fontFamily: "'Noto Serif TC', Georgia, serif" }}>
                            {job.job_name}
                          </h3>
                          <div style={{ fontSize: 13, color: "#6B6A64", marginTop: 3 }}>{job.company}</div>
                        </div>
                        <button
                          onClick={() => setSaved((p) => ({ ...p, [job.job_uid]: !p[job.job_uid] }))}
                          style={{ background: "none", border: "none", cursor: "pointer", color: saved[job.job_uid] ? "#B0562E" : "#C7C4B8", flexShrink: 0 }}
                          aria-label="Save job"
                        >
                          <Bookmark size={18} fill={saved[job.job_uid] ? "#B0562E" : "none"} />
                        </button>
                      </div>

                      <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 13, color: "#4B4A45", flexWrap: "wrap" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <MapPin size={13} />
                          {job.cities.length > 0 ? job.cities.map((c) => c.city_en).join(", ") : job.location_display || "Location unclear"}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "'IBM Plex Mono', monospace" }}>
                          <Wallet size={13} />
                          {fmtSalary(job.salary_min, job.salary_max, job.salary_note)}
                        </span>
                      </div>

                      {job.salary_note && job.salary_min != null && (
                        <div style={{ fontSize: 11, color: "#B0562E", marginTop: 4 }}>({job.salary_note})</div>
                      )}
                    </div>

                    <div style={{ width: 0, borderLeft: "2px dashed #DEDBD0", margin: "10px 0" }} />

                    <div style={{ width: 108, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: style.bg, padding: "12px 8px" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", color: style.text, fontFamily: "'IBM Plex Mono', monospace" }}>
                        {style.label.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 11, color: style.text, opacity: 0.75 }}>{fmtDate(job.posted_at)}</span>
                      <a href={job.link} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: style.text, textDecoration: "none", fontWeight: 500 }}>
                        View <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {total > PAGE_SIZE && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 24 }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8, border: "1px solid #DEDBD0", background: "#FFFFFF", cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.4 : 1, fontSize: 13 }}
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <span style={{ fontSize: 13, color: "#6B6A64" }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8, border: "1px solid #DEDBD0", background: "#FFFFFF", cursor: page >= totalPages ? "default" : "pointer", opacity: page >= totalPages ? 0.4 : 1, fontSize: 13 }}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}