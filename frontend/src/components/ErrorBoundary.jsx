import React from "react";

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error("App crashed:", error, info);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.href = "/";
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: "3rem", textAlign: "center" }}>
                    <h1>Something went wrong</h1>
                    <p>An unexpected error occurred. Please try again.</p>
                    <button onClick={this.handleReset}>Go back home</button>
                </div>
            );
        }
        return this.props.children;
    }
}