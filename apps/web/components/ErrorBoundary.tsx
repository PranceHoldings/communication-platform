'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, errorInfo: React.ErrorInfo) => ReactNode);
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * ErrorBoundary - React Error Boundary component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary fallback={<div>Something went wrong</div>}>
 *   <ComponentThatMayError />
 * </ErrorBoundary>
 * ```
 *
 * Or with custom fallback function:
 * ```tsx
 * <ErrorBoundary
 *   fallback={(error, errorInfo) => (
 *     <div>
 *       <h2>Error: {error.message}</h2>
 *       <pre>{errorInfo.componentStack}</pre>
 *     </div>
 *   )}
 * >
 *   <ComponentThatMayError />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to console for debugging
    console.error('[ErrorBoundary] Caught error:', {
      error,
      errorInfo,
      componentStack: errorInfo.componentStack,
    });

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // Render custom fallback UI
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback(this.state.error, this.state.errorInfo!);
        }
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div
          style={{
            padding: '20px',
            border: '1px solid #dc2626',
            borderRadius: '8px',
            background: '#fef2f2',
            color: '#991b1b',
          }}
        >
          <h2 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: 'bold' }}>
            Something went wrong
          </h2>
          <details style={{ cursor: 'pointer' }}>
            <summary>Error details</summary>
            <pre
              style={{
                marginTop: '10px',
                padding: '10px',
                background: '#fee2e2',
                borderRadius: '4px',
                fontSize: '12px',
                overflow: 'auto',
              }}
            >
              {this.state.error.message}
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
        </div>
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}
