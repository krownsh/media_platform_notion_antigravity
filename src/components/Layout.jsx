import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { LayoutGrid, Plus, Settings, Library, Search, ChevronDown, ChevronRight, ChevronLeft, Folder, Home, LogOut, LogIn, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import SidebarSearch from './SidebarSearch';
import NotificationContainer from './Notification';
import TaskCenter from './TaskCenter';
import { toggleTaskCenter } from '../features/uiSlice';
import { useDispatch } from 'react-redux';
import { Activity } from 'lucide-react';

const SidebarItem = ({ icon: Icon, label, active, onClick, hasSubmenu, expanded, collapsed }) => (
    <div
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.3,1)] group ${active
            ? 'bg-secondary/40 text-foreground font-medium shadow-sm'
            : 'text-muted-foreground hover:bg-secondary/20 hover:text-foreground hover:translate-x-1'
            } ${collapsed ? 'justify-center px-2' : ''}`}
        onClick={onClick}
        title={collapsed ? label : ''}
    >
        <Icon size={20} className={`transition-transform duration-500 ${active ? 'text-accent' : 'group-hover:text-accent'}`} />
        {!collapsed && (
            <span className="flex-1 whitespace-nowrap overflow-hidden transition-all duration-300">{label}</span>
        )}
        {!collapsed && hasSubmenu && (
            <div className="text-muted-foreground/70">
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
        )}
    </div>
);

const Layout = ({ children }) => {
    const { items, collections, tasks } = useSelector((state) => state.posts);
    const dispatch = useDispatch();
    const [isCollectionsExpanded, setIsCollectionsExpanded] = useState(true);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [expandedCollections, setExpandedCollections] = useState(new Set());
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState(null);

    React.useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    const mainRef = React.useRef(null);
    const scrollPositions = React.useRef(new Map());

    // Save scroll position before location changes
    React.useLayoutEffect(() => {
        const handleScroll = () => {
            if (mainRef.current) {
                scrollPositions.current.set(location.pathname, mainRef.current.scrollTop);
            }
        };

        // We can't easily hook into "before route change" in pure React Router v6 without unstable_useBlocker
        // So we save on unmount/change via cleanup, but we need the *previous* location.
        // Actually, simpler: Save on every scroll (debounced if needed, but simple assignment is cheap)
        // or just save the current pos for the current path whenever the path changes (cleanup function).

        return () => {
            if (mainRef.current) {
                scrollPositions.current.set(location.pathname, mainRef.current.scrollTop);
            }
        };
    }, [location.pathname]);

    // Restore scroll position on location change
    React.useLayoutEffect(() => {
        if (mainRef.current) {
            const savedPosition = scrollPositions.current.get(location.pathname);
            if (savedPosition !== undefined) {
                mainRef.current.scrollTop = savedPosition;
            } else {
                mainRef.current.scrollTop = 0;
            }
        }
    }, [location.pathname]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const toggleCollection = (id) => {
        // Navigate to collection on click
        navigate(`/collection/${id}`);
    };

    const isAuthPage = ['/login', '/signup'].includes(location.pathname);

    if (isAuthPage) {
        return <>{children}</>;
    }

    return (
        <div className="flex h-screen overflow-hidden text-foreground bg-background">
            {/* Sidebar */}
            <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-72'} flex-shrink-0 glass-panel flex flex-col border-r border-border/40 z-50 relative transition-all duration-300 ease-in-out`}>
                <div className={`p-6 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
                    {!isSidebarCollapsed && (
                        <div className="cursor-pointer overflow-hidden" onClick={() => navigate('/')}>
                            <h1 className="text-xl font-bold tracking-tight text-foreground/80 font-serif whitespace-nowrap">社群筆記</h1>
                            <p className="text-[10px] text-muted-foreground mt-0.5 tracking-widest uppercase opacity-70 whitespace-nowrap">Social Knowledge</p>
                        </div>
                    )}
                    <button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/20 transition-colors"
                    >
                        {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                    </button>
                </div>

                <SidebarSearch collapsed={isSidebarCollapsed} onExpand={() => setIsSidebarCollapsed(false)} />

                <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar py-4">
                    <SidebarItem
                        icon={Home}
                        label="首頁"
                        active={location.pathname === '/'}
                        onClick={() => navigate('/')}
                        collapsed={isSidebarCollapsed}
                    />

                    <SidebarItem
                        icon={LayoutGrid}
                        label="所有貼文"
                        active={location.pathname === '/view-all'}
                        onClick={() => navigate('/view-all')}
                        collapsed={isSidebarCollapsed}
                    />

                    <SidebarItem
                        icon={Library}
                        label="收藏夾"
                        onClick={() => setIsCollectionsExpanded(!isCollectionsExpanded)}
                        hasSubmenu
                        expanded={isCollectionsExpanded}
                        collapsed={isSidebarCollapsed}
                    />

                    {/* Sub-collections */}
                    <AnimatePresence>
                        {isCollectionsExpanded && !isSidebarCollapsed && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.4, ease: [0.25, 0.8, 0.3, 1] }}
                                className="overflow-hidden"
                            >
                                <div className="pl-4 space-y-1 mb-2 mt-1">
                                    {collections.map(collection => {
                                        const isActive = location.pathname === `/collection/${collection.id}`;
                                        return (
                                            <div key={collection.id}>
                                                <div
                                                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer text-sm transition-all duration-300 ${isActive
                                                        ? 'bg-secondary/30 text-foreground font-medium'
                                                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/10 hover:translate-x-1'
                                                        }`}
                                                    onClick={() => toggleCollection(collection.id)}
                                                >
                                                    <Folder size={14} className={isActive ? 'text-accent' : 'opacity-70'} />
                                                    <span className="truncate flex-1">{collection.name}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {collections.length === 0 && (
                                        <div className="px-4 py-2 text-xs text-muted-foreground/60 italic">
                                            尚無收藏夾
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </nav>

                <div className="p-4 mt-auto">
                    {user ? (
                        <div className={`bg-white/40 border border-white/20 rounded-2xl p-3 shadow-sm backdrop-blur-md flex items-center gap-3 group hover:bg-white/60 transition-all duration-300 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                            <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-accent border border-accent/20 flex-shrink-0">
                                <UserIcon size={18} />
                            </div>
                            {!isSidebarCollapsed && (
                                <>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">
                                            {user.email?.split('@')[0]}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground truncate opacity-70">
                                            {user.email}
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleLogout}
                                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                        title="登出"
                                    >
                                        <LogOut size={16} />
                                    </button>
                                </>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={() => navigate('/login')}
                            className={`w-full flex items-center justify-center gap-2 bg-accent text-white py-3 rounded-2xl font-medium hover:bg-accent/90 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 ${isSidebarCollapsed ? 'px-0' : ''}`}
                            title={isSidebarCollapsed ? "登入" : ""}
                        >
                            <LogIn size={18} />
                            {!isSidebarCollapsed && <span>登入</span>}
                        </button>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main ref={mainRef} className="flex-1 overflow-y-auto relative bg-gradient-to-br from-background via-background to-secondary/10">
                <div className="w-full p-8 max-w-full">
                    {children}
                </div>

                {/* Floating Task Center Toggle */}
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => dispatch(toggleTaskCenter())}
                    className="fixed bottom-8 right-8 w-14 h-14 bg-accent text-white rounded-full shadow-lg flex items-center justify-center z-[60] hover:shadow-xl transition-shadow group"
                >
                    <Activity size={24} className={tasks.length > 0 ? 'animate-pulse' : ''} />

                    {/* Badge */}
                    <AnimatePresence>
                        {tasks.length > 0 && (
                            <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                className="absolute -top-1 -right-1 min-w-[22px] h-[22px] bg-destructive text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center px-1"
                            >
                                {tasks.length}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Tooltip */}
                    <div className="absolute right-full mr-4 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl">
                        {tasks.length > 0 ? `${tasks.length} 個任務處理中` : '任務中心'}
                    </div>
                </motion.button>

                <TaskCenter />
            </main>
            <NotificationContainer />
        </div>
    );
};

export default Layout;
