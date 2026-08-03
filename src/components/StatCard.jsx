import React from 'react';
import { motion as Motion } from 'framer-motion';

/**
 * StatCard - 可複用的統計卡片元件
 * @param {string} label - 標籤
 * @param {string|number} value - 主要數值
 * @param {string} subtext - 副文字
 * @param {React.ReactNode} icon - 圖示
 * @param {string} colorClass - Tailwind 顏色 class（用於強調色）
 */
const StatCard = ({ label, value, subtext, icon, colorClass = 'text-[var(--accent)]' }) => {
    return (
        <Motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="flow-surface p-4 sm:p-5 flex flex-col gap-3 overflow-hidden"
        >
            <div className="flex items-start justify-between">
                <span className="flow-kicker normal-case tracking-[0.06em]">{label}</span>
                {icon && <span className={`${colorClass} flex h-8 w-8 items-center justify-center rounded-[0.6rem] bg-[var(--accent-soft)]`}>{icon}</span>}
            </div>

            <div className={`text-2xl sm:text-3xl font-bold tracking-[-0.045em] ${colorClass}`}>
                {value !== undefined && value !== null ? value : '無資料'}
            </div>

            {subtext && (
                <p className="text-xs text-[#615d59] leading-relaxed">{subtext}</p>
            )}
        </Motion.div>
    );
};

export default StatCard;
