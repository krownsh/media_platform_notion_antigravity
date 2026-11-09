import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import './AppErrorBoundary.css';

export default class AppErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        // Keep the diagnostic in DevTools while presenting a recoverable screen
        // instead of losing the entire workspace to a blank page.
        console.error('Route rendering failed', error, info);
    }

    componentDidUpdate(previousProps) {
        if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
            this.setState({ error: null });
        }
    }

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;

        return (
            <section className="app-error-boundary" role="alert">
                <AlertTriangle size={28} />
                <p>頁面暫時無法顯示</p>
                <h1>這個畫面遇到資料或呈現錯誤。</h1>
                <span>{error.message || '未知錯誤'}</span>
                <button type="button" onClick={() => this.setState({ error: null })}>
                    <RefreshCw size={16} />重新嘗試
                </button>
            </section>
        );
    }
}
