import { useState } from "react";
import CrsApp from "./CrsApp.js";
import FatcaApp from "./FatcaApp.js";

type Regime = "CRS" | "FATCA";

export default function App() {
  const [regime, setRegime] = useState<Regime>("CRS");
  return (
    <>
      <nav className="regime-switch" aria-label="Reporting regime">
        <button type="button" className={regime === "CRS" ? "active" : ""} onClick={() => setRegime("CRS")}>
          CRS
        </button>
        <button type="button" className={regime === "FATCA" ? "active" : ""} onClick={() => setRegime("FATCA")}>
          FATCA
        </button>
      </nav>
      {regime === "CRS" ? <CrsApp /> : <FatcaApp />}
    </>
  );
}
