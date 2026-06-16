import { Link } from "react-router-dom";

export default function NotFoundPage() {
    return (
        <div style={{ padding: "3rem", textAlign: "center" }}>
            <h1>404</h1>
            <p>The page you're looking for doesn't exist.</p>
            <Link to="/">Back to Dashboard</Link>
        </div>
    );
}