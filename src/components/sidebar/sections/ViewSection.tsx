import { memo, useCallback, useState } from "react";

import { MapViewer } from "../../../mapviewer/MapViewer";
import { MapViewerRenderer } from "../../../mapviewer/MapViewerRenderer";
import { WebGLMapViewerRenderer } from "../../../mapviewer/webgl/WebGLMapViewerRenderer";
import { SidebarSection } from "../SidebarSection";
import { SidebarButton } from "../controls/SidebarButton";
import { SidebarSlider } from "../controls/SidebarSlider";

interface ViewSectionProps {
    mapViewer: MapViewer;
    renderer: MapViewerRenderer;
}

export const ViewSection = memo(function ViewSection({
    mapViewer,
    renderer,
}: ViewSectionProps): JSX.Element {
    // Get initial maxLevel from renderer if it's a WebGLMapViewerRenderer
    const getMaxLevel = (): number => {
        if (renderer instanceof WebGLMapViewerRenderer) {
            return renderer.maxLevel;
        }
        return 0;
    };

    const [maxLevel, setMaxLevel] = useState(getMaxLevel());

    const handleRotateLeft = useCallback(() => {
        const currentYaw = mapViewer.camera.getYaw();
        mapViewer.camera.animateToYaw((currentYaw + 512) & 2047);
    }, [mapViewer]);

    const handleRotateRight = useCallback(() => {
        const currentYaw = mapViewer.camera.getYaw();
        mapViewer.camera.animateToYaw((currentYaw - 512 + 2048) & 2047);
    }, [mapViewer]);

    const handleMaxLevelChange = useCallback(
        (value: number) => {
            setMaxLevel(value);
            if (renderer instanceof WebGLMapViewerRenderer) {
                renderer.setMaxLevel(value);
            }
        },
        [renderer],
    );

    return (
        <SidebarSection title="View">
            <div className="sidebar-button-row">
                <SidebarButton label="Rotate Left" onClick={handleRotateLeft} />
                <SidebarButton label="Rotate Right" onClick={handleRotateRight} />
            </div>
            <SidebarSlider
                label="Floor Level"
                value={maxLevel}
                min={0}
                max={3}
                step={1}
                onChange={handleMaxLevelChange}
            />
        </SidebarSection>
    );
});
