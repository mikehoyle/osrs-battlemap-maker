import { memo, useCallback, useEffect, useState } from "react";

import { MapViewer } from "../../../mapviewer/MapViewer";
import { MapViewerRenderer } from "../../../mapviewer/MapViewerRenderer";
import { MAXIMUM_GRID_SIZE, MINIMUM_GRID_SIZE } from "../../renderer/GridRenderer2D";
import { SidebarSection, SidebarSubsection } from "../SidebarSection";
import { SidebarButton } from "../controls/SidebarButton";
import { SidebarColorPicker } from "../controls/SidebarColorPicker";
import { SidebarSlider } from "../controls/SidebarSlider";
import { SidebarToggle } from "../controls/SidebarToggle";

interface GridSectionProps {
    mapViewer: MapViewer;
    renderer: MapViewerRenderer;
}

export const GridSection = memo(function GridSection({
    mapViewer,
    renderer,
}: GridSectionProps): JSX.Element {
    const settings = renderer.gridRenderer.getSettings();

    // Appearance state
    const [enabled, setEnabled] = useState(settings.enabled);
    const [lineWidth, setLineWidth] = useState(settings.widthPx);
    const [dashedLine, setDashedLine] = useState(settings.dashedLine);
    const [dashLength, setDashLength] = useState(settings.dashLengthPx);
    const [gapLength, setGapLength] = useState(settings.gapLengthPx);
    const [color, setColor] = useState(settings.color);

    // Position state
    const [width, setWidth] = useState(settings.widthInCells);
    const [height, setHeight] = useState(settings.heightInCells);

    // Sync local state when grid settings change externally (e.g., drag resize)
    useEffect(() => {
        return renderer.gridRenderer.onSettingsChange((newSettings) => {
            setWidth(newSettings.widthInCells);
            setHeight(newSettings.heightInCells);
        });
    }, [renderer]);

    // Appearance handlers
    const handleEnabledChange = useCallback(
        (value: boolean) => {
            setEnabled(value);
            renderer.gridRenderer.setSettings({ enabled: value });
        },
        [renderer],
    );

    const handleLineWidthChange = useCallback(
        (value: number) => {
            setLineWidth(value);
            renderer.gridRenderer.setSettings({ widthPx: value });
        },
        [renderer],
    );

    const handleDashedLineChange = useCallback(
        (value: boolean) => {
            setDashedLine(value);
            renderer.gridRenderer.setSettings({ dashedLine: value });
        },
        [renderer],
    );

    const handleDashLengthChange = useCallback(
        (value: number) => {
            setDashLength(value);
            renderer.gridRenderer.setSettings({ dashLengthPx: value });
        },
        [renderer],
    );

    const handleGapLengthChange = useCallback(
        (value: number) => {
            setGapLength(value);
            renderer.gridRenderer.setSettings({ gapLengthPx: value });
        },
        [renderer],
    );

    const handleColorChange = useCallback(
        (value: { r: number; g: number; b: number; a?: number }) => {
            setColor(value);
            renderer.gridRenderer.setSettings({ color: value });
        },
        [renderer],
    );

    // Position handlers
    const handleWidthChange = useCallback(
        (value: number) => {
            setWidth(value);
            renderer.gridRenderer.setSettings({ widthInCells: value });
        },
        [renderer],
    );

    const handleHeightChange = useCallback(
        (value: number) => {
            setHeight(value);
            renderer.gridRenderer.setSettings({ heightInCells: value });
        },
        [renderer],
    );

    const handleCenterOnCamera = useCallback(() => {
        const camX = mapViewer.camera.getPosX();
        const camZ = mapViewer.camera.getPosZ();
        renderer.gridRenderer.centerGridOnPosition(camX, camZ);
        // Update local state to reflect the new settings
        const newSettings = renderer.gridRenderer.getSettings();
        setWidth(newSettings.widthInCells);
        setHeight(newSettings.heightInCells);
    }, [mapViewer, renderer]);

    return (
        <SidebarSection title="Grid">
            <SidebarSubsection title="Appearance">
                <SidebarToggle label="Enabled" checked={enabled} onChange={handleEnabledChange} />
                <SidebarSlider
                    label="Line Width"
                    value={lineWidth}
                    min={0.5}
                    max={5}
                    step={0.5}
                    onChange={handleLineWidthChange}
                />
                <SidebarToggle
                    label="Dashed Line"
                    checked={dashedLine}
                    onChange={handleDashedLineChange}
                />
                {dashedLine && (
                    <>
                        <SidebarSlider
                            label="Dash Length"
                            value={dashLength}
                            min={1}
                            max={25}
                            step={1}
                            onChange={handleDashLengthChange}
                        />
                        <SidebarSlider
                            label="Gap Length"
                            value={gapLength}
                            min={1}
                            max={25}
                            step={1}
                            onChange={handleGapLengthChange}
                        />
                    </>
                )}
                <SidebarColorPicker label="Color" value={color} onChange={handleColorChange} />
            </SidebarSubsection>

            <SidebarSubsection title="Position">
                <SidebarSlider
                    label="Width"
                    value={width}
                    min={MINIMUM_GRID_SIZE}
                    max={MAXIMUM_GRID_SIZE}
                    step={1}
                    onChange={handleWidthChange}
                />
                <SidebarSlider
                    label="Height"
                    value={height}
                    min={MINIMUM_GRID_SIZE}
                    max={MAXIMUM_GRID_SIZE}
                    step={1}
                    onChange={handleHeightChange}
                />
                <SidebarButton label="Center on Camera" onClick={handleCenterOnCamera} />
            </SidebarSubsection>
        </SidebarSection>
    );
});
