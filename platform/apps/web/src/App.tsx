import { lazy, Suspense, useEffect, useState } from "react";
import CrsApp from "./CrsApp.js";
const FatcaApp = lazy(() => import("./FatcaApp.js"));
import { WorkspaceBar } from "./components/WorkspaceBar.js";
import type {
  BackendSession,
  Organization,
  WorkspaceSelection,
} from "./backend.js";
import { commercialRpc } from "./commercial.js";
const CompanyBillingPanel = lazy(() =>
  import("./components/CommercialPanel.js").then((module) => ({
    default: module.CompanyBillingPanel,
  })),
);
const EvologicsAdminPanel = lazy(() =>
  import("./components/CommercialPanel.js").then((module) => ({
    default: module.EvologicsAdminPanel,
  })),
);

type Regime = "CRS" | "FATCA";

export default function App() {
  const [regime, setRegime] = useState<Regime>("CRS");
  const [workspace, setWorkspace] = useState<WorkspaceSelection | null>(null);
  const [fatcaOpened, setFatcaOpened] = useState(false);
  const [session, setSession] = useState<BackendSession | null>(null);
  const [company, setCompany] = useState<Organization | null>(null);
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [operator, setOperator] = useState(false);
  const [page, setPage] = useState<"filing" | "billing" | "admin">(
    new URLSearchParams(window.location.search).has("billing_request")
      ? "billing"
      : "filing",
  );
  useEffect(() => {
    let current = true;
    setOperator(false);
    if (session)
      void commercialRpc<boolean>("aeoi_commercial_access")
        .then((value) => {
          if (current) setOperator(value === true);
        })
        .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [session?.user.id]);
  const activePage = page === "admin" && !operator ? "filing" : page;

  return (
    <div className="application">
      <a className="skip-link" href="#filing-content">
        Skip to filing
      </a>
      <header className="application-header">
        <div className="brand">
          <strong>Evologics</strong>
          <span>Tax reporting workspace</span>
        </div>
        <span className="environment-label">MRA acceptance pending</span>
      </header>
      <div className="application-layout">
        <aside className="application-sidebar">
          <p className="eyebrow">Reporting regimes</p>
          <nav className="regime-switch" aria-label="Reporting regime">
            <button
              type="button"
              aria-pressed={activePage === "filing" && regime === "CRS"}
              className={
                activePage === "filing" && regime === "CRS" ? "active" : ""
              }
              onClick={() => {
                setPage("filing");
                setRegime("CRS");
              }}
            >
              CRS
            </button>
            <p>Common Reporting Standard</p>
            <button
              type="button"
              aria-pressed={activePage === "filing" && regime === "FATCA"}
              className={
                activePage === "filing" && regime === "FATCA" ? "active" : ""
              }
              onClick={() => {
                setPage("filing");
                setFatcaOpened(true);
                setRegime("FATCA");
              }}
            >
              FATCA
            </button>
            <p>US account reporting</p>
          </nav>
          {session ? (
            <nav
              className="regime-switch commercial-nav"
              aria-label="Workspace administration"
            >
              <button
                type="button"
                aria-pressed={activePage === "billing"}
                className={activePage === "billing" ? "active" : ""}
                onClick={() => setPage("billing")}
              >
                Company and billing
              </button>
              {operator ? (
                <button
                  type="button"
                  aria-pressed={activePage === "admin"}
                  className={activePage === "admin" ? "active" : ""}
                  onClick={() => setPage("admin")}
                >
                  Evologics administration
                </button>
              ) : null}
            </nav>
          ) : null}
          <div className="sidebar-note">
            <strong>Prepare. Check. Record.</strong>
            <p>
              Generate XML and maintain filing history. Submit separately
              through your authority's portal.
            </p>
          </div>
          <p className="sidebar-footnote">
            Drafts remain in memory while you switch regimes. Reloading clears
            unfinished work.
          </p>
        </aside>
        <main id="filing-content" className="application-content" tabIndex={-1}>
          <WorkspaceBar
            value={workspace}
            onChange={setWorkspace}
            onIdentityChange={setSession}
            onCompanyChange={setCompany}
            revision={workspaceRevision}
          />
          <div
            data-regime-panel="CRS"
            hidden={activePage !== "filing" || regime !== "CRS"}
          >
            <CrsApp workspace={workspace} />
          </div>
          {fatcaOpened ? (
            <div
              data-regime-panel="FATCA"
              hidden={activePage !== "filing" || regime !== "FATCA"}
            >
              <Suspense
                fallback={<p role="status">Loading FATCA workspace…</p>}
              >
                <FatcaApp workspace={workspace} />
              </Suspense>
            </div>
          ) : null}
          {activePage === "billing" ? (
            <Suspense fallback={<p role="status">Loading company billing…</p>}>
              <CompanyBillingPanel
                key={company?.id || "none"}
                organization={company}
                onInstitutionsChanged={() => setWorkspaceRevision((x) => x + 1)}
              />
            </Suspense>
          ) : null}
          {activePage === "admin" && operator ? (
            <Suspense
              fallback={<p role="status">Loading Evologics administration…</p>}
            >
              <EvologicsAdminPanel />
            </Suspense>
          ) : null}
        </main>
      </div>
    </div>
  );
}
