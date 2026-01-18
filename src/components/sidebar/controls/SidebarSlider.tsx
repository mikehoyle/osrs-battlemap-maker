import { memo } from "react";

import "./SidebarControls.css";

interface SidebarSliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
    formatValue?: (value: number) => string;
}

export const SidebarSlider = memo(function SidebarSlider({
    label,
    value,
    min,
    max,
    step = 1,
    onChange,
    formatValue,
}: SidebarSliderProps): JSX.Element {
    const displayValue = formatValue ? formatValue(value) : value.toString();

    return (
        <div className="sidebar-slider-container">
            <div className="sidebar-slider-header">
                <span className="sidebar-slider-label">{label}</span>
                <span className="sidebar-slider-value">{displayValue}</span>
            </div>
            <input
                type="range"
                className="sidebar-slider"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
            />
        </div>
    );
});
