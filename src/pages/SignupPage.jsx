import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { API_BASE_URL } from '../api/config';

import { motion } from 'framer-motion';
import { Mail, Lock, User, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const SignupPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
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
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute inset-0 bg-noise opacity-[0.03] pointer-events-none"></div>
            <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-accent/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-secondary/20 rounded-full blur-[120px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.25, 0.8, 0.3, 1] }}
                className="w-full max-w-md p-6 relative z-10"
            >
                <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-3xl p-10 shadow-xl">
                    <div className="text-center mb-10">
                        <h1 className="text-3xl font-bold text-foreground mb-3 tracking-tight">建立帳號</h1>
                        <p className="text-muted-foreground">加入我們，開始您的旅程</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-destructive/5 border border-destructive/20 rounded-xl flex items-start gap-3 text-destructive text-sm">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {success ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8 text-accent" />
                            </div>
                            <h3 className="text-xl font-semibold text-foreground mb-2">檢查您的電子郵件</h3>
                            <p className="text-muted-foreground mb-6">
                                我們已發送確認連結至 <span className="text-foreground font-medium">{email}</span>。
                                請驗證您的電子郵件以繼續。
                            </p>
                            <Link
                                to="/login"
                                className="inline-flex items-center justify-center px-6 py-3 bg-secondary/20 hover:bg-secondary/30 text-foreground rounded-xl transition-colors font-medium"
                            >
                                返回登入
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSignup} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground/80 ml-1">電子郵件</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-accent transition-colors" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-white/50 border border-border/20 rounded-xl py-3.5 pl-12 pr-4 text-foreground placeholder-muted-foreground/70 focus:outline-none focus:border-accent/50 focus:bg-white/80 transition-all shadow-sm"
                                        placeholder="name@example.com"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground/80 ml-1">密碼</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-accent transition-colors" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-white/50 border border-border/20 rounded-xl py-3.5 pl-12 pr-4 text-foreground placeholder-muted-foreground/70 focus:outline-none focus:border-accent/50 focus:bg-white/80 transition-all shadow-sm"
                                        placeholder="建立密碼"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground/80 ml-1">確認密碼</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-accent transition-colors" />
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-white/50 border border-border/20 rounded-xl py-3.5 pl-12 pr-4 text-foreground placeholder-muted-foreground/70 focus:outline-none focus:border-accent/50 focus:bg-white/80 transition-all shadow-sm"
                                        placeholder="確認您的密碼"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-accent hover:bg-accent/90 text-white font-medium py-3.5 rounded-xl transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-accent/20 mt-4"
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
                        <div className="mt-8 text-center text-muted-foreground text-sm">
                            已經有帳號了嗎？{' '}
                            <Link to="/login" className="text-accent hover:text-accent/80 font-medium transition-colors">
                                登入
                            </Link>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default SignupPage;
