import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { error: string | null; }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error: error.message || "Unexpected application error" };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("AEIO application error", { message: error.message, componentStack: info.componentStack });
  }

  render() {
    if (this.state.error) {
      return (
        <main className="shell">
          <section className="card">
            <h1>Something went wrong</h1>
            <p>The current filing was not submitted or saved by this error.</p>
            <div className="diagnostic error">{this.state.error}</div>
            <button type="button" onClick={() => window.location.reload()}>Reload application</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
