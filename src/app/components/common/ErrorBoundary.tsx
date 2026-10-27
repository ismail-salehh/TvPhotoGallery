import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { reportError } from '../../../diagnostics/diagnostics';
import { useI18n } from '../../hooks/useI18n';
import { StatusView } from './StatusView';

type ErrorBoundaryProps = {
  // Prefix for the Retry button's focus id
  id: string;
  variant?: 'screen' | 'inline';
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

type ErrorBoundaryState = { error: Error | null };

// A crash below stays here: this part shows a message with Retry, and the
// rest of the app (Back included) keeps working
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  // `error` is whatever was thrown, not always an Error
  componentDidCatch(error: unknown, info: ErrorInfo) {
    reportError(error, 'contained', this.props.id, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <CrashMessage
          id={this.props.id}
          variant={this.props.variant}
          style={this.props.style}
          onRetry={this.reset}
        />
      );
    }
    return this.props.children;
  }
}

type CrashMessageProps = Omit<ErrorBoundaryProps, 'children'> & {
  onRetry: () => void;
};

function CrashMessage({ id, variant, style, onRetry }: CrashMessageProps) {
  const { t } = useI18n();
  return (
    <StatusView
      id={`${id}-crash`}
      kind="error"
      variant={variant}
      title={t('status.crash.title')}
      message={t('status.crash.message')}
      onRetry={onRetry}
      style={style}
    />
  );
}
