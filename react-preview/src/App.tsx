import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { db } from "./lib/db";
import { localAuth, type LocalUser } from "./lib/auth";
import type { AgentRecord, GeoArea, NoticeTone } from "./types";

type AuthStage = "checking" | "locked" | "revealing" | "open" | "closing";
type LeadForm = {
  leadName: string;
  townCounty: string;
  leadType: string;
  countyUsed: string;
  leadSource: string;
};
type Notice = { message: string; tone: NoticeTone } | null;

const INITIAL_LEAD: LeadForm = {
  leadName: "",
  townCounty: "",
  leadType: "",
  countyUsed: "",
  leadSource: ""
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function inferStateCode(value: string): string | null {
  const text = value.toLowerCase();
  const codes = new Set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" "));
  const match = text.match(/(?:^|[,\s])([a-z]{2})(?:$|[,\s])/i);
  if (match && codes.has(match[1].toUpperCase())) return match[1].toUpperCase();
  if (/\b(north carolina|raleigh|durham|chapel hill|cary|apex|wake forest|johnston|harnett|alamance|chatham|morrisville|holly springs|fuquay varina|garner|clayton|knightdale|wendell|zebulon|pittsboro|sanford|mebane|graham|franklinton|youngsville|creedmoor|oxford)\b/i.test(text)) return "NC";
  if (/\b(california|los angeles|irvine|beverly hills|san diego|santa monica|san francisco)\b/i.test(text)) return "CA";
  if (/\b(texas|austin|round rock)\b/i.test(text)) return "TX";
  if (/\b(washington|seattle)\b/i.test(text)) return "WA";
  return null;
}

function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (degrees: number) => degrees * Math.PI / 180;
  const radius = 3958.7613;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(Math.min(1, a)));
}

async function getCountyCenter(area: GeoArea): Promise<{ lat: number; lng: number } | null> {
  const lat = Number(area.latitude);
  const lng = Number(area.longitude);
  if (area.latitude !== null && area.latitude !== undefined &&
      area.longitude !== null && area.longitude !== undefined &&
      Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  if (!area.state_fips || !area.county_fips) return null;

  const geoid = String(area.state_fips).padStart(2, "0") + String(area.county_fips).padStart(3, "0");
  const where = "GEOID='" + geoid + "'";
  const url = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/19/query?where=" +
    encodeURIComponent(where) +
    "&outFields=GEOID,NAME,STATE,COUNTY&returnGeometry=true&returnCentroid=true&outSR=4326&f=json";
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("County location lookup returned HTTP " + response.status);
  const result = await response.json();
  const geometry = result?.features?.[0]?.geometry ?? {};
  const centerLat = Number(geometry.y ?? geometry.centroid?.y);
  const centerLng = Number(geometry.x ?? geometry.centroid?.x);
  return Number.isFinite(centerLat) && Number.isFinite(centerLng)
    ? { lat: centerLat, lng: centerLng }
    : null;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? "").join("").toUpperCase();
}

function LoginOverlay({
  stage,
  reduceMotion,
  onSignedIn,
  onAnimationComplete
}: {
  stage: AuthStage;
  reduceMotion: boolean;
  onSignedIn: (user: LocalUser) => void;
  onAnimationComplete: () => void;
}) {
  const [idKey, setIdKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isClosing = stage === "closing";
  const isRevealing = stage === "revealing";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !idKey.trim()) return;
    setBusy(true);
    setError("");
    try {
      await localAuth.login(idKey);
      const session = await localAuth.me();
      setIdKey("");
      onSignedIn(session.user);
    } catch (reason) {
      localAuth.clear();
      setError(reason instanceof Error ? reason.message : "Sign-in failed. Check your ID KEY and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      className="auth-overlay"
      initial={isClosing ? { opacity: 0 } : false}
      animate={{ opacity: isRevealing ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.74, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={onAnimationComplete}
    >
      <div className="auth-overlay-shade" />
      <motion.section
        className="auth-panel"
        initial={isClosing ? { y: -18, scale: 0.96, opacity: 0 } : false}
        animate={isRevealing
          ? { y: -18, scale: 0.94, opacity: 0, filter: "blur(12px)" }
          : { y: 0, scale: 1, opacity: 1, filter: "blur(0px)" }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 190, damping: 25, mass: 0.9 }}
        aria-labelledby="authTitle"
      >
        <div className="auth-brand">
          <div className="auth-mark">R.</div>
          <div><strong>RPCPH CRM</strong><small>SECURE STAFF ACCESS</small></div>
        </div>
        <div className="auth-eyebrow">WELCOME BACK</div>
        <h1 id="authTitle">Welcome back.</h1>
        <p className="auth-description">Enter the ID KEY issued to you by your CRM administrator.</p>
        <form onSubmit={submit}>
          <label htmlFor="authIdKey">ID KEY</label>
          <input
            id="authIdKey"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your ID KEY"
            value={idKey}
            onChange={event => setIdKey(event.target.value)}
            required
            autoFocus
          />
          <motion.button
            type="submit"
            className="auth-submit"
            disabled={busy}
            whileTap={reduceMotion ? undefined : { scale: 0.985 }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </motion.button>
        </form>
        <AnimatePresence initial={false}>
          {error && (
            <motion.div
              className="auth-status error"
              role="alert"
              initial={{ opacity: 0, y: 7, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -5, height: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.22 }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </motion.div>
  );
}

function AgentCard({ agent, index, reduceMotion }: { agent: AgentRecord; index: number; reduceMotion: boolean }) {
  const area = [
    ...(agent.service_areas ?? []),
    agent.service_area,
    [agent.city, agent.state].filter(Boolean).join(", ")
  ].filter(Boolean).join(" · ");
  const distanceLabel = agent.__distanceLabel ??
    (agent.__distanceMiles != null ? agent.__distanceMiles.toFixed(1) + " mi" : null);

  return (
    <motion.article
      className="agent-card"
      layout
      initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduceMotion ? { duration: 0 } : { delay: Math.min(index * 0.045, 0.24), type: "spring", stiffness: 230, damping: 25 }}
    >
      <div className="agent-card-head">
        <div className="agent-initials">{initials(agent.name || "Agent")}</div>
        <div className="agent-title">
          <strong>{agent.name || "Unnamed agent"}</strong>
          <span>{agent.brokerage || "Brokerage not listed"}</span>
        </div>
      </div>
      <div className="agent-details">
        <div><span>EMAIL</span><strong>{agent.email || "Not listed"}</strong></div>
        <div><span>PHONE</span><strong>{agent.phone || "Not listed"}</strong></div>
        <div><span>SERVICE AREA</span><strong>{area || "Territory assigned"}</strong></div>
        <div><span>SPECIALTY</span><strong>{agent.specialty || "Residential real estate"}</strong></div>
      </div>
      <div className="agent-footer">
        <span className="match-pill">{agent.__matchType === "assignment" ? "Assigned territory" : "Service-area match"}</span>
        <span className={distanceLabel ? "agent-distance" : "agent-distance unknown"}>
          {distanceLabel ? "⌖ " + distanceLabel : "Location not geocoded"}
        </span>
      </div>
    </motion.article>
  );
}

function Dashboard({
  user,
  onSignOut,
  reduceMotion
}: {
  user: LocalUser | null;
  onSignOut: () => void;
  reduceMotion: boolean;
}) {
  const [lead, setLead] = useState<LeadForm>(INITIAL_LEAD);
  const [counties, setCounties] = useState<string[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    db.from("geo_areas")
      .select("name,state_code")
      .eq("area_type", "county")
      .eq("is_active", true)
      .order("name")
      .then(({ data, error }) => {
        if (!alive || error) return;
        const values = (data ?? []).flatMap((row: { name: string; state_code: string | null }) => [
          row.name + (row.state_code ? ", " + row.state_code : ""),
          row.name
        ]);
        setCounties([...new Set(values)]);
      });
    return () => { alive = false; };
  }, [user]);

  const displayName = user?.display_name ?? "Staff";
  const displayInitials = initials(displayName) || "U";

  function changeLead(field: keyof LeadForm, value: string) {
    setLead(current => ({ ...current, [field]: value }));
  }

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (searching) return;
    const leadName = lead.leadName.trim();
    const townCounty = lead.townCounty.trim();
    const countyUsed = lead.countyUsed.trim();
    if (!leadName || !townCounty || !lead.leadType || !countyUsed || !lead.leadSource) {
      setNotice({ message: "Complete all five lead fields before searching for agents.", tone: "warn" });
      return;
    }

    setSearching(true);
    setAgents([]);
    setNotice({ message: "Saving the lead and finding territory matches…", tone: "info" });

    try {
      const countyNorm = normalizeText(countyUsed).replace(/\s+county$/, "").trim();
      const stateCode = inferStateCode(townCounty + " " + countyUsed);
      const [{ data: areaRows, error: areaError }, { data: aliasRows, error: aliasError }] = await Promise.all([
        db.from("geo_areas").select("*").eq("area_type", "county").eq("is_active", true),
        db.from("geo_area_aliases").select("area_id").eq("normalized_alias", normalizeText(countyUsed))
      ]);
      if (areaError) throw areaError;
      if (aliasError) throw aliasError;

      const aliasIds = new Set((aliasRows ?? []).map((row: { area_id: string }) => row.area_id));
      const matchingAreas = ((areaRows ?? []) as GeoArea[]).filter(area => {
        const name = normalizeText(area.name).replace(/\s+county$/, "");
        const countyName = normalizeText(area.county_name ?? "").replace(/\s+county$/, "");
        return name === countyNorm || countyName === countyNorm || aliasIds.has(area.id);
      });
      const stateFiltered = stateCode ? matchingAreas.filter(area => area.state_code === stateCode) : matchingAreas;
      const candidates = stateFiltered.length ? stateFiltered : matchingAreas;
      const matchedArea = candidates.length === 1 ? candidates[0] : null;

      const saved = await localAuth.createLead({
        lead_name: leadName,
        town_or_county: townCounty,
        lead_type: lead.leadType,
        county_used: countyUsed,
        lead_source: lead.leadSource,
        matched_area_id: matchedArea?.id ?? null
      });
      if (!saved.lead?.id) throw new Error("The lead save was not confirmed.");

      if (!matchedArea) {
        const explanation = candidates.length > 1
          ? "Several counties match this name. Add the state to Town or County so the correct county can be identified."
          : "This county is not in the current geography catalog. Verify it in Area Manager before searching assigned territories.";
        setNotice({
          message: "Lead saved and stamped to " + (saved.lead.isa_name || displayName) + ". " + explanation,
          tone: "warn"
        });
        return;
      }

      const countyName = String(matchedArea.county_name || matchedArea.name || countyUsed)
        .replace(/\s+County$/i, "").trim();
      const safeCounty = countyName.replace(/[%_]/g, " ").trim();
      const pattern = "%" + safeCounty + "%";

      const [assignments, serviceText] = await Promise.all([
        db.from("agent_area_assignments")
          .select("agent_id")
          .eq("area_id", matchedArea.id)
          .eq("is_active", true)
          .in("assignment_type", ["coverage", "primary"]),
        db.from("real_estate_agents")
          .select("id,name,brokerage,email,phone,service_area,service_areas,city,state,zip_codes,specialty,active")
          .eq("active", true)
          .ilike("service_area", pattern)
          .limit(100)
      ]);
      if (assignments.error) throw assignments.error;
      if (serviceText.error) throw serviceText.error;

      const assignedIds = [...new Set((assignments.data ?? []).map((row: { agent_id: string }) => row.agent_id))];
      let assignedAgents: AgentRecord[] = [];
      if (assignedIds.length) {
        const assigned = await db.from("real_estate_agents")
          .select("id,name,brokerage,email,phone,service_area,service_areas,city,state,zip_codes,specialty,active")
          .eq("active", true)
          .in("id", assignedIds);
        if (assigned.error) throw assigned.error;
        assignedAgents = (assigned.data ?? []).map((agent: AgentRecord) => ({ ...agent, __matchType: "assignment" }));
      }

      const deduped = new Map<string, AgentRecord>();
      assignedAgents.forEach(agent => deduped.set(agent.id, agent));
      (serviceText.data ?? []).forEach((agent: AgentRecord) => {
        if (!deduped.has(agent.id)) deduped.set(agent.id, { ...agent, __matchType: "service_text" });
      });

      let found = [...deduped.values()];
      if (!found.length) {
        const token = normalizeText(countyName);
        const fallback = await db.from("real_estate_agents")
          .select("id,name,brokerage,email,phone,service_area,service_areas,city,state,zip_codes,specialty,active")
          .eq("active", true)
          .overlaps("service_areas", [token, token + " county"])
          .limit(100);
        if (fallback.error) throw fallback.error;
        found = (fallback.data ?? []).map((agent: AgentRecord) => ({ ...agent, __matchType: "service_text" }));
      }

      if (!found.length) {
        setAgents([]);
        setNotice({
          message: "Lead saved. No active agent currently has this county assigned or listed in the original service-area text. Review the territory in Area Manager.",
          tone: "warn"
        });
        return;
      }

      let center: { lat: number; lng: number } | null = null;
      try { center = await getCountyCenter(matchedArea); } catch (reason) {
        console.info("County centroid is not available yet.", reason);
      }

      let locationRows: Array<{
        agent_id: string; latitude: number | string; longitude: number | string;
        matched_address?: string | null; city?: string | null;
      }> = [];
      try {
        const result = await db.from("agent_locations")
          .select("agent_id,latitude,longitude,matched_address,city")
          .eq("is_current", true)
          .in("agent_id", found.map(agent => agent.id));
        if (!result.error) locationRows = result.data ?? [];
      } catch {
        // Keep territory matches visible even when location records are not readable.
      }

      const byAgent = new Map<string, typeof locationRows>();
      for (const row of locationRows) {
        if (!Number.isFinite(Number(row.latitude)) || !Number.isFinite(Number(row.longitude))) continue;
        const existing = byAgent.get(row.agent_id) ?? [];
        existing.push(row);
        byAgent.set(row.agent_id, existing);
      }

      const ranked = found.map(agent => {
        let closest: number | null = null;
        if (center) {
          for (const location of byAgent.get(agent.id) ?? []) {
            const distance = distanceMiles(center.lat, center.lng, Number(location.latitude), Number(location.longitude));
            if (closest === null || distance < closest) closest = distance;
          }
        }
        return {
          ...agent,
          __distanceMiles: closest,
          __distanceSource: closest === null ? null : "verified_address" as const,
          __distanceLabel: closest === null ? null : closest.toFixed(1) + " mi · geocoded office"
        };
      }).sort((a, b) => {
        if (a.__distanceMiles !== null && b.__distanceMiles !== null) return a.__distanceMiles - b.__distanceMiles;
        if (a.__distanceMiles !== null) return -1;
        if (b.__distanceMiles !== null) return 1;
        if (a.__matchType !== b.__matchType) return a.__matchType === "assignment" ? -1 : 1;
        return String(a.name ?? "").localeCompare(String(b.name ?? ""));
      });

      setAgents(ranked.slice(0, 12));
      const located = ranked.filter(agent => agent.__distanceMiles !== null).length;
      setNotice({
        message: "Lead saved and stamped to " + (saved.lead.isa_name || displayName) +
          ". " + ranked.length + " active agent match(es) found for " +
          (matchedArea.display_name || matchedArea.name) +
          (located ? ". " + located + " have geocoded office locations and are sorted by distance from the county center." :
            ". Territory matches are shown; agent office locations still need geocoding."),
        tone: "good"
      });
    } catch (reason) {
      setNotice({
        message: "The lead search could not be completed: " +
          (reason instanceof Error ? reason.message : "Database request failed") +
          ". Check the fields and retry.",
        tone: "warn"
      });
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="crm-shell">
      <aside className="crm-sidebar">
        <a className="crm-logo" href="/" aria-label="RPCPH CRM home">R.</a>
        <nav aria-label="CRM navigation">
          <a className="side-nav active" href="/" title="Overview" aria-label="Overview">⌘</a>
          <button className="side-nav" type="button" title="Leads" aria-label="Leads" onClick={() => document.getElementById("lead-workflow")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })}>◉</button>
          <a className="side-nav" href="/DB/" title="Agent database" aria-label="Agent database">▤</a>
          <a className="side-nav" href="/Areas/" title="Area Manager" aria-label="Area Manager">⌖</a>
          <a className="side-nav" href="/Admin/" title="Admin" aria-label="Admin">⚙</a>
        </nav>
        <div className="sidebar-bottom"><span className="sidebar-online" /></div>
      </aside>

      <main className="crm-main">
        <header className="crm-topbar">
          <div className="topbar-context">
            <span className="context-dot" />
            <span>Workspace</span>
            <span className="context-divider">/</span>
            <strong>Overview</strong>
          </div>
          <div className="topbar-actions">
            <span className="topbar-icon" aria-hidden="true">⌕</span>
            <span className="topbar-icon notification-icon" aria-hidden="true">♧<i>3</i></span>
            <div className="topbar-user">
              <div className="user-avatar">{displayInitials}</div>
              <div className="user-meta"><strong>{displayName}</strong><span>{user?.role ?? "staff"}</span></div>
            </div>
            <button className="signout-button" type="button" onClick={onSignOut}>Sign out</button>
          </div>
        </header>

        <section className="lead-workflow glass-surface" id="lead-workflow">
          <div className="section-heading">
            <div>
              <div className="section-kicker">LEAD DESK / INCOMING CALL</div>
              <h1>New Lead <span>·</span> Find Available Agents</h1>
              <p>Capture the caller's request, save the lead, then locate agents serving the target county.</p>
            </div>
            <div className="isa-stamp"><span className="stamp-dot" />ISA · {displayName}</div>
          </div>

          <form className="lead-form" onSubmit={submitLead}>
            <div className="lead-fields">
              <div className="field-control">
                <label htmlFor="leadName">LEAD NAME · CLIENT WHO CALLED</label>
                <input id="leadName" value={lead.leadName} onChange={event => changeLead("leadName", event.target.value)} placeholder="Client full name" autoComplete="off" required />
              </div>
              <div className="field-control">
                <label htmlFor="townCounty">TOWN OR COUNTY · CALLER LOCATION</label>
                <input id="townCounty" value={lead.townCounty} onChange={event => changeLead("townCounty", event.target.value)} placeholder="Manually enter town or county" autoComplete="off" required />
              </div>
              <div className="field-control">
                <label htmlFor="leadType">LEAD TYPE</label>
                <select id="leadType" value={lead.leadType} onChange={event => changeLead("leadType", event.target.value)} required>
                  <option value="">Select lead type</option>
                  <option value="buyer">Buyer</option>
                  <option value="seller">Seller</option>
                  <option value="investor">Investor</option>
                  <option value="land">Land</option>
                </select>
              </div>
              <div className="field-control">
                <label htmlFor="countyUsed">COUNTY USED · CLIENT'S TARGET AREA</label>
                <input id="countyUsed" list="countyOptions" value={lead.countyUsed} onChange={event => changeLead("countyUsed", event.target.value)} placeholder="County the client is looking in" autoComplete="off" required />
                <datalist id="countyOptions">{counties.map((county, index) => <option key={county + index} value={county} />)}</datalist>
              </div>
              <div className="field-control">
                <label htmlFor="leadSource">LEAD SOURCE</label>
                <select id="leadSource" value={lead.leadSource} onChange={event => changeLead("leadSource", event.target.value)} required>
                  <option value="">Select lead source</option>
                  <option>MVIP New Prospect</option>
                  <option>MVIP BLA</option>
                  <option>MVIP Prio CB</option>
                  <option>Rocket Mortgage</option>
                  <option>Website</option>
                  <option>Internet Call</option>
                  <option>Cold Call</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="field-control isa-field">
                <label>ISA RECORD STAMP</label>
                <div className="stamp-readonly"><span className="stamp-avatar">{displayInitials}</span><strong>{displayName}</strong><span>Automatically applied</span></div>
              </div>
            </div>
            <div className="lead-submit-row">
              <p>Agent matching is based on <b>County used</b>, not the caller's Town or County field.</p>
              <motion.button className="primary-action" type="submit" disabled={searching} whileTap={reduceMotion ? undefined : { scale: 0.985 }}>
                <span>{searching ? "Saving lead…" : "Save Lead & Find Agents"}</span>
                <span className="action-arrow">↗</span>
              </motion.button>
            </div>
          </form>

          <AnimatePresence initial={false}>
            {notice && (
              <motion.div
                className={"lead-notice " + notice.tone}
                role="status"
                aria-live="polite"
                layout
                initial={{ opacity: 0, y: 8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -5, height: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.24 }}
              >
                <span className="notice-mark">{notice.tone === "good" ? "✓" : notice.tone === "warn" ? "!" : "i"}</span>
                {notice.message}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {agents.length > 0 && (
              <motion.div className="results-section" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="results-heading">
                  <div><strong>Available agent matches</strong><span>Sorted by territory assignment and known office distance</span></div>
                  <span className="result-count">{agents.length} SHOWN</span>
                </div>
                <div className="agent-grid">
                  {agents.map((agent, index) => <AgentCard key={agent.id} agent={agent} index={index} reduceMotion={reduceMotion} />)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section className="dashboard-lower">
          <div className="hero-column">
            <div className="hero-art">
              <div className="hero-copy"><span>PROPERTY INTELLIGENCE</span><strong>Built around<br />the right connection.</strong></div>
              <div className="building-illustration" aria-hidden="true"><div /><div /><div /><div /><div /><div /><div /></div>
              <span className="hero-caption">RPCPH · REAL ESTATE NETWORK</span>
            </div>
            <div className="metric-grid">
              <motion.article className="metric-card" layout><strong>89%</strong><span>Sell-through</span><small>137 of 154 units</small></motion.article>
              <motion.article className="metric-card" layout><strong>589,740</strong><span>Total available</span><small>17 units</small></motion.article>
              <motion.article className="metric-card" layout><strong>3</strong><span>Units sold</span><small>Last 30 days</small></motion.article>
            </div>
          </div>

          <div className="insight-column">
            <motion.article className="insight-card velocity-card" layout>
              <div className="insight-head"><span>Lead Velocity</span><span>•••</span></div>
              <strong className="insight-number">20%</strong>
              <p>20 Leads <span>·</span> 4 Active <span>·</span> 24 Total</p>
              <div className="mini-bars">{Array.from({ length: 24 }, (_, index) => <i key={index} style={{ height: (12 + (index % 6) * 4) + "px" }} />)}</div>
            </motion.article>
            <motion.article className="insight-card" layout>
              <div className="insight-head"><span>Total Portfolio</span><span>•••</span></div>
              <strong className="insight-number portfolio-number">3,589,740 <small>USD</small></strong>
              <p>6 active projects</p>
            </motion.article>
            <motion.article className="insight-card" layout>
              <div className="insight-head"><span>Units Sold</span><span>•••</span></div>
              <strong className="insight-number">545<sup>+12</sup></strong>
              <div className="mini-bars compact-bars">{Array.from({ length: 14 }, (_, index) => <i key={index} style={{ height: (9 + (index % 5) * 6) + "px" }} />)}</div>
            </motion.article>
            <motion.article className="insight-card occupancy-card" layout>
              <div className="insight-head"><span>Total Units</span><span>•••</span></div>
              <div className="occupancy-ring"><div className="occupancy-arc" /><strong>72.7%</strong><span>545 Sold</span><span>93 Available</span></div>
            </motion.article>
          </div>
        </section>

        <footer className="crm-footer"><span>RPCPH CRM</span><span>Connected as {displayName}</span></footer>
      </main>
    </div>
  );
}

export default function App() {
  const reduceMotion = Boolean(useReducedMotion());
  const [stage, setStage] = useState<AuthStage>("checking");
  const [user, setUser] = useState<LocalUser | null>(null);

  useEffect(() => {
    let active = true;
    async function checkSession() {
      if (!localAuth.getToken()) {
        if (active) setStage("locked");
        return;
      }
      try {
        const session = await localAuth.me();
        if (!active) return;
        setUser(session.user);
        setStage("open");
      } catch {
        localAuth.clear();
        if (active) setStage("locked");
      }
    }
    void checkSession();
    return () => { active = false; };
  }, []);

  function handleSignedIn(nextUser: LocalUser) {
    setUser(nextUser);
    setStage(reduceMotion ? "open" : "revealing");
  }

  async function handleSignOut() {
    await localAuth.logout();
    setUser(null);
    setStage(reduceMotion ? "locked" : "closing");
  }

  const showAuth = stage !== "open";
  const dashboardLocked = stage === "checking" || stage === "locked" || stage === "closing";

  const dashboardAnimation = useMemo(() => dashboardLocked
    ? { scale: 1.035, opacity: 0.18, filter: "blur(13px)" }
    : { scale: 1, opacity: 1, filter: "blur(0px)" }, [dashboardLocked]);

  return (
    <div className="app-root">
      <motion.div
        className="app-scene"
        animate={dashboardAnimation}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
        style={{ pointerEvents: dashboardLocked ? "none" : "auto" }}
        aria-hidden={dashboardLocked}
      >
        <Dashboard user={user} onSignOut={() => void handleSignOut()} reduceMotion={reduceMotion} />
      </motion.div>

      <AnimatePresence initial={false}>
        {showAuth && (
          <LoginOverlay
            key="rpcph-login"
            stage={stage}
            reduceMotion={reduceMotion}
            onSignedIn={handleSignedIn}
            onAnimationComplete={() => {
              if (stage === "revealing") setStage("open");
              if (stage === "closing") setStage("locked");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}