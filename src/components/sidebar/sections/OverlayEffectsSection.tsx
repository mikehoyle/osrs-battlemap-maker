import { memo, useCallback, useState } from "react";

import { MapViewer } from "../../../mapviewer/MapViewer";
import { MapViewerRenderer } from "../../../mapviewer/MapViewerRenderer";
import { WebGLMapViewerRenderer } from "../../../mapviewer/webgl/WebGLMapViewerRenderer";
import { SidebarSection } from "../SidebarSection";
import { SidebarColorPicker } from "../controls/SidebarColorPicker";
import { SidebarSlider } from "../controls/SidebarSlider";
import { SidebarToggle } from "../controls/SidebarToggle";

interface OverlayEffectsSectionProps {
    mapViewer: MapViewer;
    renderer: MapViewerRenderer;
}

export const OverlayEffectsSection = memo(function OverlayEffectsSection({
    mapViewer,
    renderer,
}: OverlayEffectsSectionProps): JSX.Element {
    const getFogEnabled = (): boolean => {
        if (renderer instanceof WebGLMapViewerRenderer) {
            return renderer.fogEnabled;
        }
        return false;
    };

    const getFogDensity = (): number => {
        if (renderer instanceof WebGLMapViewerRenderer) {
            return renderer.fogDensity;
        }
        return 0.5;
    };

    const getFogScale = (): number => {
        if (renderer instanceof WebGLMapViewerRenderer) {
            return renderer.fogScale;
        }
        return 1.0;
    };

    const getFogColor = (): { r: number; g: number; b: number } => {
        if (renderer instanceof WebGLMapViewerRenderer) {
            return {
                r: renderer.fogColor[0] * 255,
                g: renderer.fogColor[1] * 255,
                b: renderer.fogColor[2] * 255,
            };
        }
        return { r: 217, g: 217, b: 230 }; // Default light gray-blue
    };

    const [fogEnabled, setFogEnabled] = useState(getFogEnabled());
    const [fogDensity, setFogDensity] = useState(getFogDensity());
    const [fogScale, setFogScale] = useState(getFogScale());
    const [fogColor, setFogColor] = useState(getFogColor());

    const handleFogEnabledChange = useCallback(
        (enabled: boolean) => {
            setFogEnabled(enabled);
            if (renderer instanceof WebGLMapViewerRenderer) {
                renderer.setFogEnabled(enabled);
            }
        },
        [renderer],
    );

    const handleFogDensityChange = useCallback(
        (value: number) => {
            setFogDensity(value);
            if (renderer instanceof WebGLMapViewerRenderer) {
                renderer.setFogDensity(value);
            }
        },
        [renderer],
    );

    const handleFogScaleChange = useCallback(
        (value: number) => {
            setFogScale(value);
            if (renderer instanceof WebGLMapViewerRenderer) {
                renderer.setFogScale(value);
            }
        },
        [renderer],
    );

    const handleFogColorChange = useCallback(
        (color: { r: number; g: number; b: number }) => {
            setFogColor(color);
            if (renderer instanceof WebGLMapViewerRenderer) {
                renderer.setFogColor(color.r, color.g, color.b);
            }
        },
        [renderer],
    );

    return (
        <SidebarSection title="Effects">
            <SidebarToggle
                label="Fog"
                checked={fogEnabled}
                onChange={handleFogEnabledChange}
            />
            {fogEnabled && (
                <>
                    <SidebarSlider
                        label="Density"
                        value={fogDensity}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={handleFogDensityChange}
                        formatValue={(v) => `${Math.round(v * 100)}%`}
                    />
                    <SidebarSlider
                        label="Scale"
                        value={fogScale}
                        min={0.2}
                        max={5}
                        step={0.1}
                        onChange={handleFogScaleChange}
                        formatValue={(v) => `${v.toFixed(1)}x`}
                    />
                    <SidebarColorPicker
                        label="Color"
                        value={fogColor}
                        onChange={handleFogColorChange}
                    />
                </>
            )}
        </SidebarSection>
    );
});
