import { memo, useCallback, useState } from "react";

import { MapViewer } from "../../../mapviewer/MapViewer";
import { MapViewerRenderer } from "../../../mapviewer/MapViewerRenderer";
import {
    PostProcessingEffect,
    WebGLMapViewerRenderer,
} from "../../../mapviewer/webgl/WebGLMapViewerRenderer";
import { SidebarSection } from "../SidebarSection";
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

    const [activeEffect, setActiveEffect] = useState(getActiveEffect());

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
        <SidebarSection title="Effects">
            <SidebarToggle
                label="Parchment"
                checked={activeEffect === PostProcessingEffect.PARCHMENT}
                onChange={(enabled) => handleEffectChange(PostProcessingEffect.PARCHMENT, enabled)}
            />
            <SidebarToggle
                label="Eldritch Horror"
                checked={activeEffect === PostProcessingEffect.ELDRITCH}
                onChange={(enabled) => handleEffectChange(PostProcessingEffect.ELDRITCH, enabled)}
            />
        </SidebarSection>
    );
});
