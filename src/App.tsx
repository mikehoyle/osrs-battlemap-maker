import { Routes, Route } from "react-router-dom";

import MapViewerApp from "./mapviewer/MapViewerApp";
import { LandingPage } from "./pages/LandingPage";

function App() {
    return (
        <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/map" element={<MapViewerApp />} />
        </Routes>
    );
}

export default App;
