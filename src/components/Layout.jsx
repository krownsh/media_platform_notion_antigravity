import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { LayoutGrid, Plus, Settings, Library, Search, ChevronDown, ChevronRight, Folder, Home, LogOut, LogIn, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import SidebarSearch from './SidebarSearch';

const SidebarItem = ({ icon: Icon, label, active, onClick, hasSubmenu, expanded }) => (
    <div
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.3,1)] group ${active
            ? 'bg-secondary/40 text-foreground font-medium shadow-sm'
            : 'text-muted-foreground hover:bg-secondary/20 hover:text-foreground hover:translate-x-1'
            }`}
        onClick={onClick}
    >
        <Icon size={20} className={`transition-transform duration-500 ${active ? 'text-accent' : 'group-hover:text-accent'}`} />
        <span className="flex-1">{label}</span>
        {hasSubmenu && (
            <div className="text-muted-foreground/70">
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
        )}
    </div>
);

const Layout = ({ children, onPostClick }) => {
    const { items, collections } = useSelector((state) => state.posts);
    const [isCollectionsExpanded, setIsCollectionsExpanded] = useState(true);
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
            <aside className="w-72 flex-shrink-0 glass-panel flex flex-col border-r border-border/40 z-50 relative">
                <div className="p-8 cursor-pointer" onClick={() => navigate('/')}>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground/80 font-serif">社群媒體筆記本</h1>
                    <p className="text-xs text-muted-foreground mt-1 tracking-widest uppercase opacity-70">Social Knowledge Base</p>
                </div>

                <SidebarSearch onPostClick={onPostClick} />
                <nav className="flex-1 px-6 space-y-2 overflow-y-auto custom-scrollbar py-4">
                    <SidebarItem
                        icon={Home}
                        label="首頁"
                        active={location.pathname === '/'}
                        onClick={() => navigate('/')}
                    />

                    <SidebarItem
                        icon={LayoutGrid}
                        label="所有貼文"
                        active={location.pathname === '/view-all'}
                        onClick={() => navigate('/view-all')}
                    />

                    <SidebarItem
                        icon={Library}
                        label="收藏夾"
                        onClick={() => setIsCollectionsExpanded(!isCollectionsExpanded)}
                        hasSubmenu
                        expanded={isCollectionsExpanded}
                    />

                    {/* Sub-collections */}
                    <AnimatePresence>
                        {isCollectionsExpanded && (
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

                <div className="p-6 mt-auto">
                    {user ? (
                        <div className="bg-white/40 border border-white/20 rounded-2xl p-4 shadow-sm backdrop-blur-md flex items-center gap-3 group hover:bg-white/60 transition-all duration-300">
                            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent border border-accent/20">
                                <UserIcon size={20} />
                            </div>
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
                                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                                title="登出"
                            >
                                <LogOut size={18} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full flex items-center justify-center gap-2 bg-accent text-white py-3 rounded-2xl font-medium hover:bg-accent/90 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                        >
                            <LogIn size={18} />
                            <span>登入</span>
                        </button>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto relative bg-gradient-to-br from-background via-background to-secondary/10">
                <div className="w-full p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
