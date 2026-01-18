import { memo, useEffect } from "react";

import { MapViewer } from "../../mapviewer/MapViewer";
import { MapViewerRenderer } from "../../mapviewer/MapViewerRenderer";
import "./Sidebar.css";
import { EffectsSection } from "./sections/EffectsSection";
import { ExportSection } from "./sections/ExportSection";
import { GridSection } from "./sections/GridSection";
import { NavigationSection } from "./sections/NavigationSection";
import { ViewSection } from "./sections/ViewSection";

interface SidebarProps {
    mapViewer: MapViewer;
    renderer: MapViewerRenderer;
    setHideUi: (hideUi: boolean | ((hideUi: boolean) => boolean)) => void;
    onBackClick: () => void;
    onWorldMapClick: () => void;
    onPlacesOfInterestClick: () => void;
}

export const Sidebar = memo(function Sidebar({
    mapViewer,
    renderer,
    setHideUi,
    onBackClick,
    onWorldMapClick,
    onPlacesOfInterestClick,
}: SidebarProps): JSX.Element {
    // Handle F1 key to toggle UI visibility
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.repeat) {
                return;
            }

            if (e.key === "F1") {
                setHideUi((v) => !v);
            }
        }

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [setHideUi]);

    return (
        <div className="sidebar">
            <NavigationSection
                onBackClick={onBackClick}
                onWorldMapClick={onWorldMapClick}
                onPlacesOfInterestClick={onPlacesOfInterestClick}
            />
            <ViewSection mapViewer={mapViewer} renderer={renderer} />
            <EffectsSection mapViewer={mapViewer} renderer={renderer} />
            <GridSection mapViewer={mapViewer} renderer={renderer} />
            <ExportSection mapViewer={mapViewer} renderer={renderer} />
        </div>
    );
});
