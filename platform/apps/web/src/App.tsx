import { lazy, Suspense, useState } from "react";
import CrsApp from "./CrsApp.js";
const FatcaApp = lazy(() => import("./FatcaApp.js"));
import { WorkspaceBar } from "./components/WorkspaceBar.js";
import type { WorkspaceSelection } from "./backend.js";

type Regime = "CRS" | "FATCA";

export default function App() {
  const [regime, setRegime] = useState<Regime>("CRS");
  const [workspace, setWorkspace] = useState<WorkspaceSelection | null>(null);
  const [fatcaOpened, setFatcaOpened] = useState(false);

  return (
    <div className="application">
      <a className="skip-link" href="#filing-content">Skip to filing</a>
      <header className="application-header">
        <div className="brand"><strong>Evologics</strong><span>Tax reporting workspace</span></div>
        <span className="environment-label">MRA acceptance pending</span>
      </header>
      <div className="application-layout">
        <aside className="application-sidebar">
          <p className="eyebrow">Reporting regimes</p>
          <nav className="regime-switch" aria-label="Reporting regime">
            <button type="button" aria-pressed={regime === "CRS"} className={regime === "CRS" ? "active" : ""} onClick={() => setRegime("CRS")}>CRS</button>
            <p>Common Reporting Standard</p>
            <button type="button" aria-pressed={regime === "FATCA"} className={regime === "FATCA" ? "active" : ""} onClick={() => { setFatcaOpened(true); setRegime("FATCA"); }}>FATCA</button>
            <p>US account reporting</p>
          </nav>
          <div className="sidebar-note"><strong>Prepare. Check. Record.</strong><p>Generate XML and maintain filing history. Submit separately through your authority's portal.</p></div>
          <p className="sidebar-footnote">Drafts remain in memory while you switch regimes. Reloading clears unfinished work.</p>
        </aside>
        <main id="filing-content" className="application-content" tabIndex={-1}>
          <WorkspaceBar value={workspace} onChange={setWorkspace} />
          <div data-regime-panel="CRS" hidden={regime !== "CRS"}><CrsApp workspace={workspace} /></div>
          {fatcaOpened ? <div data-regime-panel="FATCA" hidden={regime !== "FATCA"}><Suspense fallback={<p role="status">Loading FATCA workspace…</p>}><FatcaApp workspace={workspace} /></Suspense></div> : null}
        </main>
      </div>
    </div>
  );
}
