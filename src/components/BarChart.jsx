import React from 'react';
import { motion } from 'framer-motion';

/**
 * BarChart - 純 CSS/SVG 水平長條圖（無需第三方圖表套件）
 * 對齊 fieldtheory-cli 的 CLI Bar Chart 設計邏輯，升級為視覺化 Web 版本
 *
 * @param {Array<{label: string, value: number}>} data
 * @param {number} maxValue - 最大值（預設取 data 最大值）
 * @param {string} colorClass - 主色
 */
const CATEGORY_COLORS = {
    ai: 'bg-violet-400',
    tool: 'bg-blue-400',
    market: 'bg-emerald-400',
    security: 'bg-red-400',
    research: 'bg-amber-400',
    launch: 'bg-cyan-400',
    opinion: 'bg-pink-400',
    other: 'bg-gray-400',
};

const BarChart = ({ data = [], maxValue, showValues = true, colorClass = 'bg-accent' }) => {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-24 text-muted-foreground/50 text-sm">
                暫無資料
            </div>
        );
    }

    const max = maxValue || Math.max(...data.map((d) => d.value), 1);

    return (
        <div className="space-y-3">
            {data.map((item, idx) => {
                const pct = Math.round((item.value / max) * 100);
                const barColor = CATEGORY_COLORS[item.label] || colorClass;

                return (
                    <motion.div
                        key={item.label}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex items-center gap-3"
                    >
                        {/* Label */}
                        <span className="text-xs text-foreground/80 font-medium w-20 shrink-0 text-right truncate capitalize">
                            {item.label}
                        </span>

                        {/* Bar Track */}
                        <div className="flex-1 h-5 bg-black/5 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut', delay: idx * 0.05 }}
                                className={`h-full rounded-full ${barColor}`}
                            />
                        </div>

                        {/* Value */}
                        {showValues && (
                            <span className="text-xs font-bold text-foreground/60 w-8 text-left shrink-0">
                                {item.value}
                            </span>
                        )}
                    </motion.div>
                );
            })}
        </div>
    );
};

export default BarChart;
