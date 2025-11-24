import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { LayoutGrid, Plus, Settings, Library, Search, ChevronDown, ChevronRight, Folder } from 'lucide-react';

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

const Layout = ({ children }) => {
    const { items } = useSelector((state) => state.posts);
    const collections = items.filter(item => item.type === 'collection');
    const [isCollectionsExpanded, setIsCollectionsExpanded] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden text-white">
            {/* Sidebar */}
            <aside className="w-64 flex-shrink-0 glass-panel flex flex-col border-r border-white/5">
                <div className="p-6">
                    <h1 className="text-2xl font-bold tracking-tight text-gradient">Antigravity</h1>
                    <p className="text-xs text-gray-500 mt-1">Social Knowledge Base</p>
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto custom-scrollbar">
                    <SidebarItem icon={LayoutGrid} label="All Posts" active />

                    <SidebarItem
                        icon={Library}
                        label="Collections"
                        onClick={() => setIsCollectionsExpanded(!isCollectionsExpanded)}
                        hasSubmenu
                        expanded={isCollectionsExpanded}
                    />

                    {/* Sub-collections */}
                    {isCollectionsExpanded && (
                        <div className="pl-4 space-y-1 mb-2 animate-in slide-in-from-top-2 duration-200">
                            {collections.map(collection => (
                                <div
                                    key={collection.id}
                                    className="flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                                >
                                    <Folder size={14} />
                                    <span className="truncate">{collection.name}</span>
                                </div>
                            ))}
                            {collections.length === 0 && (
                                <div className="px-4 py-2 text-xs text-gray-600 italic">
                                    No collections created
                                </div>
                            )}
                        </div>
                    )}

                    <SidebarItem icon={Search} label="Search" />
                </nav>

                <div className="p-4 mt-auto">
                    <button className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl transition-all font-medium border border-white/10">
                        <Plus size={18} />
                        New Collection
                    </button>
                    <div className="mt-4 pt-4 border-t border-white/10">
                        <SidebarItem icon={Settings} label="Settings" />
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
