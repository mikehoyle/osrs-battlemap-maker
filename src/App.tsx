import { Routes, Route } from "react-router-dom";

import MapViewerApp from "./mapviewer/MapViewerApp";
import { LandingPage } from "./pages/LandingPage";
import { LegalPage } from "./pages/LegalPage";
import { TokenMakerPage } from "./pages/TokenMakerPage";

function App() {
    return (
        <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/map" element={<MapViewerApp />} />
            <Route path="/token-maker" element={<TokenMakerPage />} />
            <Route path="/legal" element={<LegalPage />} />
        </Routes>
    );
}

export default App;
