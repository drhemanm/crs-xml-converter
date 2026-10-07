import { useState } from "react";
import CrsApp from "./CrsApp.js";
import FatcaApp from "./FatcaApp.js";
import { WorkspaceBar } from "./components/WorkspaceBar.js";
import type { WorkspaceSelection } from "./backend.js";

type Regime = "CRS" | "FATCA";

export default function App() {
  const [regime, setRegime] = useState<Regime>("CRS");
  const [workspace, setWorkspace] = useState<WorkspaceSelection | null>(null);

  return (
    <>
      <WorkspaceBar value={workspace} onChange={setWorkspace} />
      <nav className="regime-switch" aria-label="Reporting regime">
        <button type="button" className={regime === "CRS" ? "active" : ""} onClick={() => setRegime("CRS")}>
          CRS
        </button>
        <button type="button" className={regime === "FATCA" ? "active" : ""} onClick={() => setRegime("FATCA")}>
          FATCA
        </button>
      </nav>
      {regime === "CRS" ? <CrsApp workspace={workspace} /> : <FatcaApp workspace={workspace} />}
    </>
  );
}
