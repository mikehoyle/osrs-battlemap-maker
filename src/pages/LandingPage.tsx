import { Link } from "react-router-dom";
import "./LandingPage.css";

export function LandingPage() {
    return (
        <div className="landing-page">
            <div className="landing-content">
                <h1 className="landing-title">OSRS Battlemap Maker</h1>
                <Link to="/map" className="landing-button rs-border rs-background">
                    Open Map Maker
                </Link>
            </div>
        </div>
    );
}
