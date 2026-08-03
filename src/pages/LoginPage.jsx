import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { motion as Motion } from 'framer-motion';
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            navigate('/');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] flex items-start sm:items-center justify-center bg-background relative overflow-hidden px-4 py-8 sm:py-0">
            <div className="absolute top-0 inset-x-0 h-40 bg-[var(--accent-soft)] opacity-50 pointer-events-none" />

            <Motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-md p-0 sm:p-6 relative z-10"
            >
                <div className="flow-surface p-6 sm:p-9 shadow-deep">
                    <div className="mb-8 sm:mb-10">
                        <p className="flow-kicker mb-2">私人工作區</p>
                        <h1 className="text-3xl font-bold text-[rgba(0,0,0,0.95)] tracking-[-0.05em]">歡迎回來</h1>
                        <p className="mt-3 text-sm leading-6 text-[#615d59]">登入後繼續收集、整理與推進你的知識。</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/25 rounded-[0.75rem] flex items-start gap-3 text-destructive text-sm">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[rgba(0,0,0,0.95)]/80 ml-1">電子郵件</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#615d59] group-focus-within:text-[var(--accent)] transition-colors" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="notion-input w-full py-3.5 pl-12 pr-4 text-[rgba(0,0,0,0.95)] placeholder-muted-foreground/70"
                                    placeholder="name@example.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[rgba(0,0,0,0.95)]/80 ml-1">密碼</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#615d59] group-focus-within:text-[var(--accent)] transition-colors" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="notion-input w-full py-3.5 pl-12 pr-4 text-[rgba(0,0,0,0.95)] placeholder-muted-foreground/70"
                                    placeholder="輸入您的密碼"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="notion-btn-primary w-full font-medium py-3.5 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    登入中...
                                </>
                            ) : (
                                '登入'
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center text-[#615d59] text-sm">
                        還沒有帳號？{' '}
                        <Link to="/signup" className="touch-target-link text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium transition-colors">
                            建立帳號
                        </Link>
                    </div>
                </div>
            </Motion.div>
        </div>
    );
};

export default LoginPage;
