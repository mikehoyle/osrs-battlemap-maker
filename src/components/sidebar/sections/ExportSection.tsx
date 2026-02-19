import { memo, useCallback, useState } from "react";

import { ExportFormat, ExportResolution, MapViewer } from "../../../mapviewer/MapViewer";
import { MapViewerRenderer } from "../../../mapviewer/MapViewerRenderer";
import { downloadBlob } from "../../../util/DownloadUtil";
import { SidebarSection } from "../SidebarSection";
import { SidebarButton } from "../controls/SidebarButton";
import { SidebarSelect } from "../controls/SidebarSelect";

interface ExportSectionProps {
    mapViewer: MapViewer;
    renderer: MapViewerRenderer;
    onExportingChange?: (isExporting: boolean) => void;
}

const RESOLUTION_OPTIONS = [
    { label: "64px / cell", value: "64" },
    { label: "128px / cell", value: "128" },
];

const FORMAT_OPTIONS = [
    { label: "PNG", value: "png" },
    { label: "JPEG", value: "jpeg" },
];

export const ExportSection = memo(function ExportSection({
    mapViewer,
    renderer,
    onExportingChange,
}: ExportSectionProps): JSX.Element {
    const [resolution, setResolution] = useState<ExportResolution>(128);
    const [format, setFormat] = useState<ExportFormat>("png");
    const [isExporting, setIsExporting] = useState(false);

    const setExporting = useCallback(
        (value: boolean) => {
            setIsExporting(value);
            onExportingChange?.(value);
        },
        [onExportingChange],
    );

    const handleResolutionChange = useCallback((value: string) => {
        setResolution(Number(value) as ExportResolution);
    }, []);

    const handleFormatChange = useCallback((value: string) => {
        setFormat(value as ExportFormat);
    }, []);

    const handleExport = useCallback(() => {
        if (isExporting) {
            return;
        }

        setExporting(true);
        mapViewer
            .exportBattlemap(resolution, format)
            .then((blob) => {
                if (!blob) {
                    console.error("No blob returned");
                    return;
                }

                const settings = renderer.gridRenderer.getSettings();
                const ext = format === "jpeg" ? "jpg" : "png";
                const filename = `osrs_battlemap_${settings.widthInCells}x${settings.heightInCells}.${ext}`;
                downloadBlob(blob, filename);
            })
            .finally(() => {
                setExporting(false);
            });
    }, [mapViewer, renderer, resolution, format, isExporting, setExporting]);

    return (
        <SidebarSection title="Export" defaultCollapsed={true}>
            <SidebarSelect
                label="Resolution"
                value={resolution.toString()}
                options={RESOLUTION_OPTIONS}
                onChange={handleResolutionChange}
            />
            <SidebarSelect
                label="Format"
                value={format}
                options={FORMAT_OPTIONS}
                onChange={handleFormatChange}
            />
            <SidebarButton
                label={isExporting ? "Exporting..." : "Export Map"}
                onClick={handleExport}
                disabled={isExporting}
            />
        </SidebarSection>
    );
});
