"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-6" dir="rtl">
          <div className="max-w-lg w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 text-center">
            <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={40} />
            </div>

            <h1 className="text-2xl font-black text-white mb-3">حدث خطأ غير متوقع</h1>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              نعتذر عن هذا الخطأ. يرجى المحاولة مرة أخرى أو العودة للصفحة الرئيسية.
            </p>

            {this.state.error && (
              <div className="bg-black/30 rounded-xl p-4 mb-6 border border-white/5 text-left">
                <p className="text-red-400 text-xs font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-sm border border-white/10 transition-all"
              >
                <RefreshCw size={16} />
                إعادة التحميل
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all"
              >
                <Home size={16} />
                الصفحة الرئيسية
              </button>
            </div>

            <button
              onClick={this.handleReset}
              className="mt-4 text-gray-500 hover:text-gray-300 text-xs font-bold transition-colors"
            >
              محاولة مرة أخرى
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ─── Inline Error Fallback Component ───────────────────────────
export const ErrorFallback: React.FC<{
  error?: string;
  onRetry?: () => void;
  className?: string;
}> = ({ error, onRetry, className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-4 p-8 ${className}`}>
    <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-2xl flex items-center justify-center">
      <AlertTriangle size={32} />
    </div>
    <div className="text-center">
      <h3 className="text-white font-bold mb-1">حدث خطأ</h3>
      <p className="text-gray-400 text-sm">{error || 'فشل تحميل البيانات'}</p>
    </div>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold border border-white/10 transition-all flex items-center gap-2"
      >
        <RefreshCw size={14} />
        إعادة المحاولة
      </button>
    )}
  </div>
);

// ─── Async Error Handler Utility ───────────────────────────────
export async function safeAsync<T>(
  fn: () => Promise<T>,
  fallback: T,
  errorHandler?: (error: Error) => void
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('SafeAsync error:', err);
    errorHandler?.(err);
    return fallback;
  }
}
