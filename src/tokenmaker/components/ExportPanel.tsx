import { useCallback } from "react";
import { ExportResolution, TextureFilterMode } from "../TokenMaker";
import "./ExportPanel.css";

interface ExportPanelProps {
    resolution: ExportResolution;
    borderColor: string;
    borderWidth: number;
    hdEnabled: boolean;
    brightness: number;
    textureFilterMode: TextureFilterMode;
    smoothModel: boolean;
    onResolutionChange: (resolution: ExportResolution) => void;
    onBorderColorChange: (color: string) => void;
    onBorderWidthChange: (width: number) => void;
    onHdChange: (enabled: boolean) => void;
    onBrightnessChange: (value: number) => void;
    onTextureFilterChange: (mode: TextureFilterMode) => void;
    onSmoothModelChange: (enabled: boolean) => void;
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

const TEXTURE_FILTER_OPTIONS = [
    { label: "Disabled", value: TextureFilterMode.DISABLED },
    { label: "Bilinear", value: TextureFilterMode.BILINEAR },
    { label: "Trilinear", value: TextureFilterMode.TRILINEAR },
    { label: "Anisotropic 2x", value: TextureFilterMode.ANISOTROPIC_2X },
    { label: "Anisotropic 4x", value: TextureFilterMode.ANISOTROPIC_4X },
    { label: "Anisotropic 8x", value: TextureFilterMode.ANISOTROPIC_8X },
    { label: "Anisotropic 16x", value: TextureFilterMode.ANISOTROPIC_16X },
];

export function ExportPanel({
    resolution,
    borderColor,
    borderWidth,
    hdEnabled,
    brightness,
    textureFilterMode,
    smoothModel,
    onResolutionChange,
    onBorderColorChange,
    onBorderWidthChange,
    onHdChange,
    onBrightnessChange,
    onTextureFilterChange,
    onSmoothModelChange,
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

    const handleBrightnessChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onBrightnessChange(parseInt(e.target.value));
        },
        [onBrightnessChange],
    );

    const handleTextureFilterChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            onTextureFilterChange(parseInt(e.target.value) as TextureFilterMode);
        },
        [onTextureFilterChange],
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

            <h3 className="control-panel-title section-title">Render Settings</h3>

            <div className="control-row">
                <label className="control-label">Brightness</label>
                <input
                    type="range"
                    className="control-slider"
                    min={0}
                    max={4}
                    step={1}
                    value={brightness}
                    onChange={handleBrightnessChange}
                />
                <span className="width-value">{brightness}</span>
            </div>

            <div className="control-row">
                <label className="control-label">Filtering</label>
                <select
                    className="control-select rs-border rs-background"
                    value={textureFilterMode}
                    onChange={handleTextureFilterChange}
                >
                    {TEXTURE_FILTER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="control-row">
                <label className="control-label">Smooth</label>
                <label className="hd-toggle">
                    <input
                        type="checkbox"
                        checked={smoothModel}
                        onChange={(e) => onSmoothModelChange(e.target.checked)}
                    />
                    <span className="hd-toggle-label">
                        Smooth shading
                    </span>
                </label>
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
