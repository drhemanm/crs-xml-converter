import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { failed: boolean; reference: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, reference: "" };

  static getDerivedStateFromError(): State {
    return {
      failed: true,
      reference: crypto.randomUUID().slice(0, 8).toUpperCase(),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("AEOI UI failure", {
      name: error.name,
      message: error.message,
      componentStack: info.componentStack,
      reference: this.state.reference,
    });
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="shell">
          <section className="card" role="alert">
            <h1>Something went wrong</h1>
            <p>
              No filing was submitted. Reload the application and retry the last action.
              If the problem repeats, provide support reference <strong>{this.state.reference}</strong>.
            </p>
            <button type="button" onClick={() => window.location.reload()}>Reload application</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
