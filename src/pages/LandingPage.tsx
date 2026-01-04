import { Link } from "react-router-dom";

import "./LandingPage.css";

export function LandingPage() {
    return (
        <div className="landing-page">
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
