import { Link } from "react-router-dom";
import "./LandingPage.css";

export function LandingPage() {
    return (
        <div className="landing-page">
            <div className="landing-content">
                <h1 className="landing-title">OSRS Battlemap Maker</h1>
                <div className="landing-buttons">
                    <Link to="/map" className="landing-button rs-border rs-background">
                        Open Map Maker
                    </Link>
                    <Link to="/token-maker" className="landing-button rs-border rs-background">
                        Open Token Maker
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
