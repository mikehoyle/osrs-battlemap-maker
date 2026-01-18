import { memo, useCallback } from "react";

import "./SidebarControls.css";

interface ColorRgba {
    r: number;
    g: number;
    b: number;
    a?: number;
}

interface SidebarColorPickerProps {
    label: string;
    value: ColorRgba;
    onChange: (value: ColorRgba) => void;
}

function rgbToHex(r: number, g: number, b: number): string {
    return (
        "#" +
        [r, g, b]
            .map((x) => {
                const hex = Math.round(x).toString(16);
                return hex.length === 1 ? "0" + hex : hex;
            })
            .join("")
    );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16),
          }
        : { r: 0, g: 0, b: 0 };
}

export const SidebarColorPicker = memo(function SidebarColorPicker({
    label,
    value,
    onChange,
}: SidebarColorPickerProps): JSX.Element {
    const hexValue = rgbToHex(value.r, value.g, value.b);
    const cssColor = `rgba(${value.r}, ${value.g}, ${value.b}, ${value.a ?? 1})`;

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const rgb = hexToRgb(e.target.value);
            onChange({ ...rgb, a: value.a });
        },
        [onChange, value.a],
    );

    return (
        <div className="sidebar-color-picker-container">
            <span className="sidebar-color-picker-label">{label}</span>
            <div className="sidebar-color-picker-wrapper">
                <input
                    type="color"
                    className="sidebar-color-picker"
                    value={hexValue}
                    onChange={handleChange}
                />
                <div
                    className="sidebar-color-picker-preview"
                    style={{ backgroundColor: cssColor }}
                />
            </div>
        </div>
    );
});
