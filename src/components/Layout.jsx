import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Activity, BarChart3, ChevronLeft, ChevronRight, Folder,
    FolderGit2, Home, LayoutGrid, Library, LogIn, LogOut, Menu,
    Search, Target, User as UserIcon, X,
} from 'lucide-react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { toggleTaskCenter } from '../features/uiSlice';
import { visibleCollections } from '../utils/collectionVisibility';
import SidebarSearch from './SidebarSearch';
import NotificationContainer from './Notification';
import TaskCenter from './TaskCenter';
import './LayoutCollections.css';

const navigation = [
    { icon: Home, label: '收件匣', path: '/' },
    { icon: Search, label: '記憶搜尋', path: '/search' },
    { icon: LayoutGrid, label: '所有貼文', path: '/view-all', matches: (path) => path === '/view-all' || path.startsWith('/collection/') },
    { icon: BarChart3, label: '分析數據', path: '/insight' },
    { icon: Target, label: 'Topics', path: '/topics' },
    { icon: FolderGit2, label: 'Projects', path: '/projects' },
];

const EditorialNavItem = ({ icon: Icon, label, active, collapsed, onClick, trailing }) => (
    <button type="button" className={`editorial-nav-item ${active ? 'is-active' : ''} ${collapsed ? 'is-collapsed' : ''}`} aria-current={active ? 'page' : undefined} title={collapsed ? label : undefined} onClick={onClick}>
        {React.createElement(Icon, { size: 17, strokeWidth: 1.8 })}
        {!collapsed && <span>{label}</span>}
        {!collapsed && trailing}
    </button>
);

const Layout = ({ children }) => {
    const { collections, tasks } = useSelector((state) => state.posts);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [user, setUser] = useState(null);
    const mainRef = React.useRef(null);
    const activeCollections = visibleCollections(collections);
    const isAuthPage = ['/login', '/signup'].includes(location.pathname);

    React.useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
        return () => subscription.unsubscribe();
    }, []);

    React.useLayoutEffect(() => {
        const mainElement = mainRef.current;
        if (!mainElement) return undefined;
        mainElement.scrollTop = 0;
        return undefined;
    }, [location.pathname]);

    const closeMobileMenu = () => setIsMobileMenuOpen(false);
    const go = (path) => { navigate(path); closeMobileMenu(); };
    const handleLogout = async () => { await supabase.auth.signOut(); go('/login'); };

    if (isAuthPage) return <>{children}</>;

    const renderNavigation = (collapsed = false, mobile = false) => (
        <>
            <nav className="editorial-navigation" aria-label="主要導覽">
                {navigation.map(({ icon, label, path, matches }) => (
                    <EditorialNavItem key={path} icon={icon} label={label} collapsed={collapsed} active={matches ? matches(location.pathname) : location.pathname === path} onClick={() => mobile ? go(path) : navigate(path)} />
                ))}
                <EditorialNavItem icon={Library} label="收藏夾管理" collapsed={collapsed} active={location.pathname === '/library'} onClick={() => mobile ? go('/library') : navigate('/library')} />
            </nav>
            {!collapsed && <section className="editorial-collections"><div className="editorial-collections-head"><p className="editorial-section-label">收藏夾清單</p><span>{activeCollections.length}</span></div><div className="editorial-collection-list">{activeCollections.map((collection) => <button key={collection.id} type="button" className={`editorial-folder-link ${location.pathname === `/collection/${collection.id}` ? 'is-active' : ''}`} onClick={() => mobile ? go(`/collection/${collection.id}`) : navigate(`/collection/${collection.id}`)}><Folder size={14} /><span>{collection.name}</span></button>)}{!activeCollections.length && <p className="editorial-empty-folder">尚無收藏夾</p>}</div></section>}
        </>
    );

    return (
        <div className="editorial-app-shell">
            <header className="editorial-mobile-header">
                <button type="button" className="editorial-wordmark" onClick={() => go('/')} aria-label="回到收件匣">M<span>.</span>COLLECT</button>
                <button type="button" className="editorial-mobile-menu-button" onClick={() => setIsMobileMenuOpen((value) => !value)} aria-label={isMobileMenuOpen ? '關閉選單' : '開啟選單'} aria-expanded={isMobileMenuOpen}>{isMobileMenuOpen ? <X size={21} /> : <Menu size={21} />}</button>
            </header>
            <AnimatePresence>
                {isMobileMenuOpen && <><Motion.button type="button" aria-label="關閉選單" className="editorial-mobile-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeMobileMenu} /><Motion.aside className="editorial-mobile-drawer" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}><SidebarSearch collapsed={false} onExpand={() => {}} onSearchSelect={closeMobileMenu} />{renderNavigation(false, true)}<div className="editorial-mobile-account">{user ? user.email : '尚未登入'}</div></Motion.aside></>}
            </AnimatePresence>
            <aside className={`editorial-sidebar ${isSidebarCollapsed ? 'is-collapsed' : ''}`}>
                <div className="editorial-sidebar-head">
                    {!isSidebarCollapsed && <button type="button" className="editorial-wordmark" onClick={() => navigate('/')} aria-label="回到收件匣">M<span>.</span>COLLECT</button>}
                    <button type="button" className="editorial-collapse-button" onClick={() => setIsSidebarCollapsed((value) => !value)} aria-label={isSidebarCollapsed ? '展開側邊欄' : '收合側邊欄'}>{isSidebarCollapsed ? <ChevronRight size={19} /> : <ChevronLeft size={19} />}</button>
                </div>
                {!isSidebarCollapsed && <p className="editorial-workspace-label">Kangjunxuan 的工作區</p>}
                {!isSidebarCollapsed && <div className="editorial-search-wrap"><SidebarSearch collapsed={false} onExpand={() => {}} /></div>}
                {renderNavigation(isSidebarCollapsed)}
                <div className="editorial-account"><div className="editorial-avatar"><UserIcon size={15} /></div>{!isSidebarCollapsed && <div className="editorial-account-copy"><strong>{user?.email?.split('@')[0] || '訪客'}</strong><span>{user?.email || '尚未登入'}</span></div>}{!isSidebarCollapsed && user && <button type="button" className="editorial-logout" onClick={handleLogout} title="登出"><LogOut size={15} /></button>}{!isSidebarCollapsed && !user && <button type="button" className="editorial-login" onClick={() => navigate('/login')}><LogIn size={15} />登入</button>}</div>
            </aside>
            <main ref={mainRef} className="editorial-main">
                <div className="editorial-page-frame">{children}</div>
                <button type="button" className="editorial-task-toggle" onClick={() => dispatch(toggleTaskCenter())} aria-label={tasks.length > 0 ? `${tasks.length} 個任務處理中` : '開啟任務中心'}><Activity size={20} />{tasks.length > 0 && <span>{tasks.length}</span>}</button>
                <TaskCenter />
            </main>
            <NotificationContainer />
        </div>
    );
};

export default Layout;
