import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { motion as Motion } from 'framer-motion';
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import './AuthPages.css';

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
        <div className="editorial-auth-page">
            <div className="editorial-auth-mark" aria-hidden="true">M<span>.</span>COLLECT</div>

            <Motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                className="editorial-auth-motion"
            >
                <div className="editorial-auth-panel">
                    <div className="mb-8 sm:mb-10">
                        <p className="editorial-auth-kicker">PRIVATE WORKSPACE / 01</p>
                        <h1>回到你的<br />來源工作台</h1>
                        <p>登入後繼續收集、整理與推進你的知識。</p>
                    </div>

                    {error && (
                        <div className="editorial-auth-error">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="editorial-auth-form">
                        <div className="space-y-2">
                            <label>電子郵件</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#615d59] group-focus-within:text-[var(--accent)] transition-colors" />
                                <input className="editorial-auth-input"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@example.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label>密碼</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#615d59] group-focus-within:text-[var(--accent)] transition-colors" />
                                <input className="editorial-auth-input"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="輸入您的密碼"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="editorial-auth-submit"
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

                    <div className="editorial-auth-switch">
                        還沒有帳號？{' '}
                        <Link to="/signup">
                            建立帳號
                        </Link>
                    </div>
                </div>
            </Motion.div>
        </div>
    );
};

export default LoginPage;
