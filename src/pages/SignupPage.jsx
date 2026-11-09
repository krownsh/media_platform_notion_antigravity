import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { API_BASE_URL } from '../api/config';

import { motion as Motion } from 'framer-motion';
import { Mail, Lock, User, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import './AuthPages.css';

const SignupPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const success = false;
    const navigate = useNavigate();

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (password !== confirmPassword) {
            setError("密碼不符");
            setLoading(false);
            return;
        }

        if (password.length < 6) {
            setError("密碼長度至少需 6 個字元");
            setLoading(false);
            return;
        }

        try {
            // 1. Create user via backend (bypasses email verification)
            const response = await fetch(`${API_BASE_URL}/api/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || '註冊失敗');
            }

            // 2. Automatically sign in
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) throw signInError;

            // 3. Navigate to home
            navigate('/');

        } catch (err) {
            console.error('Signup error:', err);
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
                        <p className="editorial-auth-kicker">PRIVATE WORKSPACE / NEW</p>
                        <h1>建立你的<br />來源工作台</h1>
                        <p>開始建立可以持續回應你需求的知識脈絡。</p>
                    </div>

                    {error && (
                        <div className="editorial-auth-error">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {success ? (
                        <div className="text-center py-8">
                                <div className="w-16 h-16 bg-[var(--accent-soft)] rounded-[1rem] flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8 text-[var(--accent)]" />
                            </div>
                            <h3 className="text-xl font-semibold text-[rgba(0,0,0,0.95)] mb-2">檢查您的電子郵件</h3>
                            <p className="text-[#615d59] mb-6">
                                我們已發送確認連結至 <span className="text-[rgba(0,0,0,0.95)] font-medium">{email}</span>。
                                請驗證您的電子郵件以繼續。
                            </p>
                            <Link
                                to="/login"
                                className="notion-btn-secondary touch-target-link inline-flex items-center justify-center px-6 py-3 font-medium"
                            >
                                返回登入
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSignup} className="editorial-auth-form">
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
                                        placeholder="建立密碼"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label>確認密碼</label>
                                <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#615d59] group-focus-within:text-[var(--accent)] transition-colors" />
                                    <input className="editorial-auth-input"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="確認您的密碼"
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
                                        建立帳號中...
                                    </>
                                ) : (
                                    '註冊'
                                )}
                            </button>
                        </form>
                    )}

                    {!success && (
                        <div className="editorial-auth-switch">
                            已經有帳號了嗎？{' '}
                            <Link to="/login">
                                登入
                            </Link>
                        </div>
                    )}
                </div>
            </Motion.div>
        </div>
    );
};

export default SignupPage;
