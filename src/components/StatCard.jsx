import React from 'react';
import { motion } from 'framer-motion';

/**
 * StatCard - 可複用的統計卡片元件
 * @param {string} label - 標籤
 * @param {string|number} value - 主要數值
 * @param {string} subtext - 副文字
 * @param {React.ReactNode} icon - 圖示
 * @param {string} colorClass - Tailwind 顏色 class（用於強調色）
 */
const StatCard = ({ label, value, subtext, icon, colorClass = 'text-violet-400' }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative bg-white/40 backdrop-blur-xl rounded-2xl border border-white/50 shadow-md p-5 flex flex-col gap-2 overflow-hidden"
        >
            {/* 背景裝飾光暈 */}
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-current opacity-5 blur-xl" style={{ color: 'currentColor' }} />

            <div className="flex items-start justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
                {icon && <span className={`${colorClass} opacity-80`}>{icon}</span>}
            </div>

            <div className={`text-3xl font-bold tracking-tight ${colorClass}`}>
                {value !== undefined && value !== null ? value : '—'}
            </div>

            {subtext && (
                <p className="text-xs text-muted-foreground leading-relaxed">{subtext}</p>
            )}
        </motion.div>
    );
};

export default StatCard;
