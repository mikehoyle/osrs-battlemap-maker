import { memo, useCallback, useState } from "react";

import { MapViewer } from "../../../mapviewer/MapViewer";
import { MapViewerRenderer } from "../../../mapviewer/MapViewerRenderer";
import {
    PostProcessingEffect,
    WebGLMapViewerRenderer,
} from "../../../mapviewer/webgl/WebGLMapViewerRenderer";
import { SidebarSection } from "../SidebarSection";
import { SidebarSlider } from "../controls/SidebarSlider";
import { SidebarToggle } from "../controls/SidebarToggle";

interface EffectsSectionProps {
    mapViewer: MapViewer;
    renderer: MapViewerRenderer;
}

export const EffectsSection = memo(function EffectsSection({
    mapViewer,
    renderer,
}: EffectsSectionProps): JSX.Element {
    const getActiveEffect = (): PostProcessingEffect => {
        if (renderer instanceof WebGLMapViewerRenderer) {
            return renderer.activeEffect;
        }
        return PostProcessingEffect.NONE;
    };

    const getParchmentDetail = (): number => {
        if (renderer instanceof WebGLMapViewerRenderer) {
            return renderer.parchmentDetailLevel;
        }
        return 0.5;
    };

    const getGrimdarkShadows = (): number => {
        if (renderer instanceof WebGLMapViewerRenderer) {
            return renderer.grimdarkShadowIntensity;
        }
        return 0.5;
    };

    const [activeEffect, setActiveEffect] = useState(getActiveEffect());
    const [parchmentDetail, setParchmentDetail] = useState(getParchmentDetail());
    const [grimdarkShadows, setGrimdarkShadows] = useState(getGrimdarkShadows());

    const handleParchmentDetailChange = useCallback(
        (value: number) => {
            setParchmentDetail(value);
            if (renderer instanceof WebGLMapViewerRenderer) {
                renderer.setParchmentDetailLevel(value);
            }
        },
        [renderer],
    );

    const handleGrimdarkShadowsChange = useCallback(
        (value: number) => {
            setGrimdarkShadows(value);
            if (renderer instanceof WebGLMapViewerRenderer) {
                renderer.setGrimdarkShadowIntensity(value);
            }
        },
        [renderer],
    );

    const handleEffectChange = useCallback(
        (effect: PostProcessingEffect, enabled: boolean) => {
            const newEffect = enabled ? effect : PostProcessingEffect.NONE;
            setActiveEffect(newEffect);
            if (renderer instanceof WebGLMapViewerRenderer) {
                renderer.setActiveEffect(newEffect);
            }
        },
        [renderer],
    );

    return (
        <SidebarSection title="Filters">
            <SidebarToggle
                label="Parchment"
                checked={activeEffect === PostProcessingEffect.PARCHMENT}
                onChange={(enabled) => handleEffectChange(PostProcessingEffect.PARCHMENT, enabled)}
            />
            {activeEffect === PostProcessingEffect.PARCHMENT && (
                <SidebarSlider
                    label="Thickness"
                    value={parchmentDetail}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={handleParchmentDetailChange}
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                />
            )}
            <SidebarToggle
                label="Eldritch Horror"
                checked={activeEffect === PostProcessingEffect.ELDRITCH}
                onChange={(enabled) => handleEffectChange(PostProcessingEffect.ELDRITCH, enabled)}
            />
            <SidebarToggle
                label="Grimdark"
                checked={activeEffect === PostProcessingEffect.GRIMDARK}
                onChange={(enabled) => handleEffectChange(PostProcessingEffect.GRIMDARK, enabled)}
            />
            {activeEffect === PostProcessingEffect.GRIMDARK && (
                <SidebarSlider
                    label="Shadows"
                    value={grimdarkShadows}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={handleGrimdarkShadowsChange}
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                />
            )}
        </SidebarSection>
    );
});
