import { useCallback, useState } from "react";
import { Link } from "react-router-dom";

import "./LandingPage.css";

export function LandingPage() {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        setMousePos({ x: e.clientX, y: e.clientY });
    }, []);

    return (
        <div className="landing-page" onMouseMove={handleMouseMove}>
            {/* Base grid - always visible */}
            <svg className="landing-grid-pattern" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern
                        id="grid-pattern-base"
                        width="40"
                        height="40"
                        patternUnits="userSpaceOnUse"
                    >
                        <path
                            d="M 40 0 L 0 0 0 40"
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.04)"
                            strokeWidth="1"
                        />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid-pattern-base)" />
            </svg>
            {/* Highlighted grid - masked by mouse position */}
            <svg className="landing-grid-pattern landing-grid-highlight" xmlns="http://www.w3.org/2000/svg"
                style={{
                    maskImage: `radial-gradient(circle 250px at ${mousePos.x}px ${mousePos.y}px, black 0%, transparent 100%)`,
                    WebkitMaskImage: `radial-gradient(circle 250px at ${mousePos.x}px ${mousePos.y}px, black 0%, transparent 100%)`,
                }}
            >
                <defs>
                    <pattern
                        id="grid-pattern-highlight"
                        width="40"
                        height="40"
                        patternUnits="userSpaceOnUse"
                    >
                        <path
                            d="M 40 0 L 0 0 0 40"
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.12)"
                            strokeWidth="1"
                        />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid-pattern-highlight)" />
            </svg>
            <div className="landing-content">
                <img src="/osrs-logo.png" alt="OSRS Logo" className="landing-logo" />
                <h1 className="landing-title">Old School Runescape Tabletop Tools</h1>
                <p className="landing-subtitle">
                    Create assets for your Virtual Tabletop (Roll20, Foundry, and more), straight
                    from the world of Old School Runescape
                </p>
                <div className="landing-cards">
                    <Link to="/map" className="landing-card">
                        <div
                            className="landing-card-background"
                            style={{ backgroundImage: "url('/preview_battlemap.png')" }}
                        />
                        <div className="landing-card-overlay" />
                        <span className="landing-card-title">Battlemap Maker</span>
                    </Link>
                    <Link to="/token-maker" className="landing-card">
                        <div
                            className="landing-card-background"
                            style={{ backgroundImage: "url('/preview_token_maker.png')" }}
                        />
                        <div className="landing-card-overlay" />
                        <span className="landing-card-title">Token Maker</span>
                    </Link>
                </div>
            </div>
            <footer className="landing-footer">
                <Link to="/legal" className="landing-footer-link">
                    Legal
                </Link>
            </footer>
        </div>
    );
}
