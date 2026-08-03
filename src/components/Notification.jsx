import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { removeNotification } from '../features/uiSlice';

const NotificationItem = ({ notification }) => {
    const dispatch = useDispatch();
    const { id, message, type } = notification;

    useEffect(() => {
        const timer = setTimeout(() => {
            dispatch(removeNotification(id));
        }, 5000);
        return () => clearTimeout(timer);
    }, [id, dispatch]);

    const icons = {
        error: <AlertCircle className="text-destructive" size={20} />,
        success: <CheckCircle className="text-[var(--success)]" size={20} />,
        info: <Info className="text-[var(--accent)]" size={20} />,
    };

    const bgColors = {
        error: 'bg-destructive/10 border-destructive/20',
        success: 'bg-emerald-50 border-emerald-200',
        info: 'bg-[var(--accent-soft)] border-[var(--border)]',
    };

    return (
        <Motion.div
            initial={{ opacity: 0, y: 20, x: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.98, transition: { duration: 0.18 } }}
            className={`
        flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-3.5 rounded-[0.85rem] border shadow-deep w-[calc(100vw-2rem)] sm:w-auto min-w-0 sm:min-w-[320px] max-w-md
        ${bgColors[type] || bgColors.info}
      `}
        >
            <div className="flex-shrink-0">
                {icons[type] || icons.info}
            </div>
            <div className="flex-1 text-sm font-medium text-[var(--foreground)]/90">
                {message}
            </div>
            <button
                onClick={() => dispatch(removeNotification(id))}
                className="flow-icon-button min-h-8 min-w-8 hover:text-[var(--foreground)]"
                aria-label="關閉通知"
            >
                <X size={18} />
            </button>
        </Motion.div>
    );
};

const NotificationContainer = () => {
    const notifications = useSelector((state) => state.ui.notifications);

    return (
        <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-[100] flex flex-col gap-3 sm:gap-4 max-w-[calc(100vw-2rem)]" aria-live="polite">
            <AnimatePresence mode="popLayout">
                {notifications.map((n) => (
                    <NotificationItem key={n.id} notification={n} />
                ))}
            </AnimatePresence>
        </div>
    );
};

export default NotificationContainer;
