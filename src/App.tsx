import { Routes, Route } from "react-router-dom";

import MapViewerApp from "./mapviewer/MapViewerApp";
import { LandingPage } from "./pages/LandingPage";
import { LegalPage } from "./pages/LegalPage";
import { TokenMakerPage } from "./pages/TokenMakerPage";
import { GuidesLayout } from "./pages/guides/GuidesLayout";
import { GuidesOverview } from "./pages/guides/GuidesOverview";
import { ImportingIntoRoll20 } from "./pages/guides/ImportingIntoRoll20";
import { ImportingIntoFoundry } from "./pages/guides/ImportingIntoFoundry";

function App() {
    return (
        <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/map" element={<MapViewerApp />} />
            <Route path="/token-maker" element={<TokenMakerPage />} />
            <Route path="/legal" element={<LegalPage />} />
            <Route path="/guides" element={<GuidesLayout />}>
                <Route index element={<GuidesOverview />} />
                <Route path="importing-into-roll20" element={<ImportingIntoRoll20 />} />
                <Route path="importing-into-foundry" element={<ImportingIntoFoundry />} />
            </Route>
        </Routes>
    );
}

export default App;
