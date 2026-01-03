import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./LegalPage.css";

export function LegalPage() {
    const [content, setContent] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch("/NOTICE")
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Failed to load NOTICE file");
                }
                return response.text();
            })
            .then((text) => {
                setContent(text);
                setLoading(false);
            })
            .catch((err) => {
                setError(err.message);
                setLoading(false);
            });
    }, []);

    return (
        <div className="legal-page">
            <header className="legal-header">
                <Link to="/" className="legal-back-link">
                    Back
                </Link>
                <h1 className="legal-title">Legal Notice</h1>
            </header>
            <div className="legal-content">
                {loading && <p>Loading...</p>}
                {error && <p className="legal-error">{error}</p>}
                {content && <pre className="legal-notice">{content}</pre>}
            </div>
        </div>
    );
}
