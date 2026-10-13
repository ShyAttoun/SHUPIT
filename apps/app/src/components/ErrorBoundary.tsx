import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { reportError } from '@/lib/errorReporting';
import { ErrorFallback } from './ErrorFallback';

interface State {
  failed: boolean;
}

/** Catches render errors so a bug shows a recovery screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    void reportError('boundary', error);
  }

  private reset = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.reload();
    else this.setState({ failed: false });
  };

  render() {
    return this.state.failed ? <ErrorFallback onRetry={this.reset} /> : this.props.children;
  }
}
