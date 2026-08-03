import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { LayoutGrid, Plus, Settings, Library, Search, ChevronDown, ChevronRight, ChevronLeft, Folder, Home, LogOut, LogIn, User as UserIcon, BarChart3, Menu, X, Target } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import SidebarSearch from './SidebarSearch';
import NotificationContainer from './Notification';
import TaskCenter from './TaskCenter';
import { toggleTaskCenter } from '../features/uiSlice';
import { useDispatch } from 'react-redux';
import { Activity } from 'lucide-react';
import { createCollection } from '../features/postsSlice';

const SidebarItem = ({ icon: _Icon, label, active, onClick, hasSubmenu, expanded, collapsed }) => (
    <Motion.button
        type="button"
        layout
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={`relative flex w-full items-center gap-2 px-3 py-2 text-left rounded-md cursor-pointer group ${active
            ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-semibold shadow-[inset_0_0_0_1px_rgba(45,111,115,0.08)]'
            : 'text-[#615d59] hover:bg-black/5 hover:text-[rgba(0,0,0,0.95)]'
            } ${collapsed ? 'justify-center px-1' : ''}`}
        title={collapsed ? label : ''}
    >
        <_Icon size={16} strokeWidth={1.8} className={`transition-colors ${active ? 'text-[var(--accent)]' : 'group-hover:text-[rgba(0,0,0,0.95)]'}`} />
        {!collapsed && (
            <span className="flex-1 whitespace-nowrap overflow-hidden text-sm">{label}</span>
        )}
        {!collapsed && hasSubmenu && (
            <div className="text-[#615d59]/70">
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
        )}
    </Motion.button>
);

const Layout = ({ children }) => {
    const { collections, tasks } = useSelector((state) => state.posts);
    const dispatch = useDispatch();
    const [isCollectionsExpanded, setIsCollectionsExpanded] = useState(true);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
        const mainElement = mainRef.current;
        const positions = scrollPositions.current;
        const pathname = location.pathname;

        // We can't easily hook into "before route change" in pure React Router v6 without unstable_useBlocker
        // So we save on unmount/change via cleanup, but we need the *previous* location.
        // Actually, simpler: Save on every scroll (debounced if needed, but simple assignment is cheap)
        // or just save the current pos for the current path whenever the path changes (cleanup function).

        return () => {
            if (mainElement) {
                positions.set(pathname, mainElement.scrollTop);
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
        <div className="flex flex-col md:flex-row h-[100dvh] overflow-hidden text-[rgba(0,0,0,0.95)] bg-background overflow-x-hidden">
            {/* Mobile Header (Sticky at top) */}
            <header className="md:hidden flex items-center justify-between px-4 sm:px-6 py-3 bg-surface-raised border-b notion-whisper-border z-[60] sticky top-0 shadow-[0_1px_0_rgba(23,31,26,0.03)]">
                <div className="cursor-pointer" onClick={() => { navigate('/'); setIsMobileMenuOpen(false); }}>
                    <h1 className="text-lg font-bold tracking-[-0.03em] text-[rgba(0,0,0,0.95)]">社群筆記</h1>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="flow-icon-button"
                    aria-label={isMobileMenuOpen ? '關閉選單' : '開啟選單'}
                    aria-expanded={isMobileMenuOpen}
                >
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </header>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <Motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                        className="md:hidden fixed inset-x-3 top-[60px] bg-surface-raised z-50 border notion-whisper-border rounded-b-[1rem] shadow-deep overflow-y-auto max-h-[calc(100dvh-72px)] pb-[env(safe-area-inset-bottom)]"
                    >
                        <div className="p-4 space-y-4">
                            <SidebarSearch
                                collapsed={false}
                                onExpand={() => { }}
                                onSearchSelect={() => setIsMobileMenuOpen(false)}
                            />

                            <nav className="space-y-1">
                                <SidebarItem
                                    icon={Home}
                                    label="首頁"
                                    active={location.pathname === '/'}
                                    onClick={() => { navigate('/'); setIsMobileMenuOpen(false); }}
                                />
                                <SidebarItem
                                    icon={LayoutGrid}
                                    label="所有貼文"
                                    active={location.pathname === '/view-all'}
                                    onClick={() => { navigate('/view-all'); setIsMobileMenuOpen(false); }}
                                />
                                <SidebarItem
                                    icon={BarChart3}
                                    label="趨勢看板"
                                    active={location.pathname === '/insight'}
                                    onClick={() => { navigate('/insight'); setIsMobileMenuOpen(false); }}
                                />
                                <SidebarItem
                                    icon={Target}
                                    label="主題工作區"
                                    active={location.pathname === '/topics'}
                                    onClick={() => { navigate('/topics'); setIsMobileMenuOpen(false); }}
                                />
                                <SidebarItem
                                    icon={Library}
                                    label="收藏夾"
                                    onClick={() => setIsCollectionsExpanded(!isCollectionsExpanded)}
                                    hasSubmenu
                                    expanded={isCollectionsExpanded}
                                />

                                {isCollectionsExpanded && (
                                    <div className="pl-4 space-y-1 mt-1">
                                        {collections.map(collection => {
                                            const isActive = location.pathname === `/collection/${collection.id}`;
                                            return (
                                                <div
                                                    key={collection.id}
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-sm cursor-pointer text-sm transition-colors ${isActive
                                                        ? 'bg-black/5 text-[rgba(0,0,0,0.95)] font-medium'
                                                        : 'text-[#615d59] hover:text-[rgba(0,0,0,0.95)] hover:bg-black/5'
                                                        }`}
                                                    onClick={() => { navigate(`/collection/${collection.id}`); setIsMobileMenuOpen(false); }}
                                                >
                                                    <Folder size={14} className={isActive ? 'text-[rgba(0,0,0,0.95)]' : 'opacity-70'} />
                                                    <span className="truncate flex-1">{collection.name}</span>
                                                </div>
                                            );
                                        })}
                                        <div className="mt-2 pt-2 border-t border-[rgba(0,0,0,0.1)]/10">
                                            <button 
                                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#0075de] hover:bg-[#0075de]/5 rounded-sm transition-colors"
                                                onClick={() => {
                                                    const name = window.prompt("請輸入新資料夾名稱：");
                                                    if (name && name.trim()) {
                                                        dispatch(createCollection({ name: name.trim() }));
                                                    }
                                                }}
                                            >
                                                <Plus size={14} /> 新增資料夾
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </nav>

                            <div className="pt-4 border-t border-black/5">
                                {user ? (
                                    <div className="flex items-center justify-between p-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-[#615d59] border border-black/10">
                                                <UserIcon size={16} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-[rgba(0,0,0,0.95)] truncate">
                                                    {user.email?.split('@')[0]}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                                            className="p-2 text-[#615d59] hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                        >
                                            <LogOut size={18} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => { navigate('/login'); setIsMobileMenuOpen(false); }}
                                        className="w-full flex items-center justify-center gap-2 bg-[rgba(0,0,0,0.95)] text-white py-2.5 rounded-md font-medium"
                                    >
                                        <LogIn size={18} />
                                        <span>登入</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </Motion.div>
                )}
            </AnimatePresence>

            {/* Backdrop for Mobile Menu */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="md:hidden fixed inset-0 bg-black/20 z-40 backdrop-blur-[2px]"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar (Tablet & Desktop) */}
            <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-[17.5rem]'} hidden md:flex flex-shrink-0 bg-surface notion-whisper-border flex-col border-r border-[rgba(0,0,0,0.1)]/40 z-50 relative transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]`}>
                <div className={`px-5 pt-6 pb-4 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
                    {!isSidebarCollapsed && (
                        <div className="cursor-pointer overflow-hidden" onClick={() => navigate('/')}>
                            <h1 className="text-xl font-bold tracking-[-0.04em] text-[rgba(0,0,0,0.95)] whitespace-nowrap">社群筆記</h1>
                            <p className="text-[10px] text-[#615d59] mt-1 tracking-[0.12em] uppercase opacity-80 whitespace-nowrap">Knowledge current</p>
                        </div>
                    )}
                    <button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className="flow-icon-button"
                        aria-label={isSidebarCollapsed ? '展開側邊欄' : '收合側邊欄'}
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
                        icon={BarChart3}
                        label="趨勢看板"
                        active={location.pathname === '/insight'}
                        onClick={() => navigate('/insight')}
                        collapsed={isSidebarCollapsed}
                    />

                    <SidebarItem
                        icon={Target}
                        label="主題工作區"
                        active={location.pathname === '/topics'}
                        onClick={() => navigate('/topics')}
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
                            <Motion.div
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
                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-sm cursor-pointer text-sm transition-colors ${isActive
                                                        ? 'bg-black/5 text-[rgba(0,0,0,0.95)] font-medium'
                                                        : 'text-[#615d59] hover:text-[rgba(0,0,0,0.95)] hover:bg-black/5'
                                                        }`}
                                                    onClick={() => toggleCollection(collection.id)}
                                                >
                                                    <Folder size={14} className={isActive ? 'text-[rgba(0,0,0,0.95)]' : 'opacity-70'} />
                                                    <span className="truncate flex-1">{collection.name}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {collections.length === 0 && (
                                        <div className="px-3 py-1.5 text-xs text-[#615d59]/60 italic">
                                            尚無收藏夾
                                        </div>
                                    )}
                                    <div className="px-3 py-1.5 mt-1 border-t border-[rgba(0,0,0,0.1)]/10">
                                        <button 
                                            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-[#0075de] hover:bg-[#0075de]/5 rounded-sm transition-colors cursor-pointer"
                                            onClick={() => {
                                                const name = window.prompt("請輸入新資料夾名稱：");
                                                if (name && name.trim()) {
                                                    dispatch(createCollection({ name: name.trim() }));
                                                }
                                            }}
                                        >
                                            <Plus size={14} /> 新增資料夾
                                        </button>
                                    </div>
                                </div>
                            </Motion.div>
                        )}
                    </AnimatePresence>
                </nav>

                <div className="p-4 mt-auto">
                    {user ? (
                        <div className={`flow-panel p-2 flex items-center gap-2 group ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                            <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-[#615d59] border border-black/10 flex-shrink-0">
                                <UserIcon size={16} />
                            </div>
                            {!isSidebarCollapsed && (
                                <>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-[rgba(0,0,0,0.95)] truncate">
                                            {user.email?.split('@')[0]}
                                        </p>
                                        <p className="text-[10px] text-[#615d59] truncate opacity-70">
                                            {user.email}
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleLogout}
                                        className="p-1 text-[#615d59] hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                        title="登出"
                                    >
                                        <LogOut size={14} />
                                    </button>
                                </>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={() => navigate('/login')}
                            className={`notion-btn-primary w-full flex items-center justify-center gap-2 py-2 ${isSidebarCollapsed ? 'px-0' : ''}`}
                            title={isSidebarCollapsed ? "登入" : ""}
                        >
                            <LogIn size={16} />
                            {!isSidebarCollapsed && <span>登入</span>}
                        </button>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden relative bg-background pb-[env(safe-area-inset-bottom)]">
                <AnimatePresence mode="wait" initial={false}>
                    <Motion.div
                        key={location.pathname}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                        className="w-full p-3 sm:p-5 md:p-8"
                    >
                        {children}
                    </Motion.div>
                </AnimatePresence>

                {/* Floating Task Center Toggle */}
                <button
                    onClick={() => dispatch(toggleTaskCenter())}
                    className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 w-12 h-12 bg-surface-raised text-[rgba(0,0,0,0.95)] border notion-whisper-border rounded-[0.9rem] shadow-deep flex items-center justify-center z-[60] group transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 active:translate-y-0 active:scale-95"
                    aria-label={tasks.length > 0 ? `${tasks.length} 個任務處理中` : '開啟任務中心'}
                >
                    <Activity size={20} className={tasks.length > 0 ? 'animate-pulse text-[#dd5b00]' : 'text-[#615d59]'} />

                    {/* Badge */}
                    <AnimatePresence>
                        {tasks.length > 0 && (
                            <Motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                className="absolute -top-1 -right-1 min-w-[22px] h-[22px] bg-destructive text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center px-1"
                            >
                                {tasks.length}
                            </Motion.div>
                        )}
                    </AnimatePresence>

                    {/* Tooltip */}
                    <div className="absolute right-full mr-4 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-deep hidden sm:block">
                        {tasks.length > 0 ? `${tasks.length} 個任務處理中` : '任務中心'}
                    </div>
                </button>

                <TaskCenter />
            </main>
            <NotificationContainer />
        </div>
    );
};

export default Layout;
