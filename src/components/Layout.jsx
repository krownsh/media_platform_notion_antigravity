import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { LayoutGrid, Plus, Settings, Library, Search, ChevronDown, ChevronRight, Folder, Home, LogOut, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import SidebarSearch from './SidebarSearch';

const SidebarItem = ({ icon: Icon, label, active, onClick, hasSubmenu, expanded }) => (
    <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 group ${active ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
        onClick={onClick}
    >
        <Icon size={20} className="group-hover:scale-110 transition-transform" />
        <span className="font-medium flex-1">{label}</span>
        {hasSubmenu && (
            <div className="text-gray-500">
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
        <div className="flex h-screen overflow-hidden text-white">
            {/* Sidebar */}
            <aside className="w-64 flex-shrink-0 glass-panel flex flex-col border-r border-white/5 z-50 relative">
                <div className="p-6 cursor-pointer" onClick={() => navigate('/')}>
                    <h1 className="text-2xl font-bold tracking-tight text-gradient">Antigravity</h1>
                    <p className="text-xs text-gray-500 mt-1">Social Knowledge Base</p>
                </div>

                <SidebarSearch onPostClick={onPostClick} />
                <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
                    <SidebarItem
                        icon={Home}
                        label="Home"
                        active={location.pathname === '/'}
                        onClick={() => navigate('/')}
                    />

                    <SidebarItem
                        icon={LayoutGrid}
                        label="All Posts"
                        active={location.pathname === '/view-all'}
                        onClick={() => navigate('/view-all')}
                    />

                    <SidebarItem
                        icon={Library}
                        label="Collections"
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
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <div className="pl-4 space-y-1 mb-2">
                                    {collections.map(collection => {
                                        const isActive = location.pathname === `/collection/${collection.id}`;
                                        return (
                                            <div key={collection.id}>
                                                <div
                                                    className={`flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer text-sm transition-colors ${isActive ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                                    onClick={() => toggleCollection(collection.id)}
                                                >
                                                    <Folder size={14} />
                                                    <span className="truncate flex-1">{collection.name}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {collections.length === 0 && (
                                        <div className="px-4 py-2 text-xs text-gray-600 italic">
                                            No collections created
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>


                </nav>

                <div className="p-4 mt-auto">
                    <div className="mt-4 pt-4 border-t border-white/10 space-y-1">
                        {user ? (
                            <SidebarItem
                                icon={LogOut}
                                label="Sign Out"
                                onClick={handleLogout}
                            />
                        ) : (
                            <SidebarItem
                                icon={LogIn}
                                label="Sign In"
                                onClick={() => navigate('/login')}
                            />
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto relative">
                <div className="w-full p-6">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
