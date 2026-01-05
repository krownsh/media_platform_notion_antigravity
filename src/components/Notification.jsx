import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
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
        success: <CheckCircle className="text-emerald-500" size={20} />,
        info: <Info className="text-accent" size={20} />,
    };

    const bgColors = {
        error: 'bg-destructive/10 border-destructive/20',
        success: 'bg-emerald-500/10 border-emerald-500/20',
        info: 'bg-accent/10 border-accent/20',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 50, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            className={`
        flex items-center gap-4 px-6 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl min-w-[320px] max-w-md
        ${bgColors[type] || bgColors.info}
      `}
        >
            <div className="flex-shrink-0">
                {icons[type] || icons.info}
            </div>
            <div className="flex-1 text-sm font-medium text-foreground/90">
                {message}
            </div>
            <button
                onClick={() => dispatch(removeNotification(id))}
                className="text-muted-foreground hover:text-foreground transition-colors"
            >
                <X size={18} />
            </button>
        </motion.div>
    );
};

const NotificationContainer = () => {
    const notifications = useSelector((state) => state.ui.notifications);

    return (
        <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-4">
            <AnimatePresence mode="popLayout">
                {notifications.map((n) => (
                    <NotificationItem key={n.id} notification={n} />
                ))}
            </AnimatePresence>
        </div>
    );
};

export default NotificationContainer;
