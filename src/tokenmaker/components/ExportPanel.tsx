import { useCallback } from "react";
import { ExportResolution } from "../TokenMaker";
import "./ExportPanel.css";

interface ExportPanelProps {
    resolution: ExportResolution;
    borderColor: string;
    borderWidth: number;
    hdEnabled: boolean;
    onResolutionChange: (resolution: ExportResolution) => void;
    onBorderColorChange: (color: string) => void;
    onBorderWidthChange: (width: number) => void;
    onHdChange: (enabled: boolean) => void;
    onExport: () => void;
    canExport: boolean;
}

const RESOLUTIONS: ExportResolution[] = [64, 128, 256];

const BORDER_COLORS = [
    { name: "Gold", value: "#ff981f" },
    { name: "Red", value: "#ff3333" },
    { name: "Blue", value: "#3366ff" },
    { name: "Green", value: "#33cc33" },
    { name: "Purple", value: "#9933ff" },
    { name: "White", value: "#ffffff" },
    { name: "Black", value: "#333333" },
];

export function ExportPanel({
    resolution,
    borderColor,
    borderWidth,
    hdEnabled,
    onResolutionChange,
    onBorderColorChange,
    onBorderWidthChange,
    onHdChange,
    onExport,
    canExport,
}: ExportPanelProps): JSX.Element {
    const handleBorderWidthChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onBorderWidthChange(parseInt(e.target.value));
        },
        [onBorderWidthChange],
    );

    const handleColorChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onBorderColorChange(e.target.value);
        },
        [onBorderColorChange],
    );

    return (
        <div className="control-panel rs-border rs-background export-panel">
            <h3 className="control-panel-title">Export Settings</h3>

            <div className="control-row">
                <label className="control-label">Size</label>
                <div className="button-group">
                    {RESOLUTIONS.map((res) => (
                        <button
                            key={res}
                            className={`control-button rs-border rs-background ${resolution === res ? "active" : ""}`}
                            onClick={() => onResolutionChange(res)}
                        >
                            {res}px
                        </button>
                    ))}
                </div>
            </div>

            <div className="control-row">
                <label className="control-label">HD</label>
                <label className="hd-toggle">
                    <input
                        type="checkbox"
                        checked={hdEnabled}
                        onChange={(e) => onHdChange(e.target.checked)}
                    />
                    <span className="hd-toggle-label">
                        Enable HD lighting
                    </span>
                </label>
            </div>

            <div className="control-row">
                <label className="control-label">Border</label>
                <div className="color-picker-row">
                    {BORDER_COLORS.map((color) => (
                        <button
                            key={color.value}
                            className={`color-swatch ${borderColor === color.value ? "selected" : ""}`}
                            style={{ backgroundColor: color.value }}
                            onClick={() => onBorderColorChange(color.value)}
                            title={color.name}
                        />
                    ))}
                    <input
                        type="color"
                        className="color-input"
                        value={borderColor}
                        onChange={handleColorChange}
                        title="Custom color"
                    />
                </div>
            </div>

            <div className="control-row">
                <label className="control-label">Width</label>
                <input
                    type="range"
                    className="control-slider"
                    min={1}
                    max={16}
                    value={borderWidth}
                    onChange={handleBorderWidthChange}
                />
                <span className="width-value">{borderWidth}px</span>
            </div>

            <div className="control-row export-button-row">
                <button
                    className="control-button rs-border rs-background primary export-button"
                    onClick={onExport}
                    disabled={!canExport}
                >
                    Export Token
                </button>
            </div>
        </div>
    );
}
