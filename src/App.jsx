import React, { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import OwnerTopicsPage from './pages/OwnerTopicsPage';
import ProjectsPage from './pages/ProjectsPage';
import SearchPage from './pages/SearchPage';
import OwnerPostPage from './pages/OwnerPostPage';
import LibraryPage from './pages/LibraryPage';

import { setUser, setLoading } from './features/authSlice';
import { fetchCaptureHistory, fetchPosts } from './features/postsSlice';
import { supabase } from './api/supabaseClient';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useSelector((state) => state.auth);
  const location = useLocation();

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

function App() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const loadedUserId = useRef(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      dispatch(setUser(session?.user ?? null));
      dispatch(setLoading(false));
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      dispatch(setUser(session?.user ?? null));
      dispatch(setLoading(false));
    });

    return () => subscription.unsubscribe();
  }, [dispatch]);

  useEffect(() => {
    if (!user?.id) {
      loadedUserId.current = null;
      return;
    }

    // App owns the initial source load. Route components only consume this
    // shared store, preventing each screen from requesting /api/posts again.
    if (loadedUserId.current === user.id) return;
    loadedUserId.current = user.id;
    dispatch(fetchCaptureHistory());
    dispatch(fetchPosts());
  }, [user?.id, dispatch]);

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          } />
          <Route path="/library" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
          <Route path="/library/:collectionId" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
          <Route path="/view-all" element={<Navigate to="/library" replace />} />
          <Route path="/collection/:collectionId" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />

          <Route path="/post/:postId" element={
            <ProtectedRoute>
              <OwnerPostPage />
            </ProtectedRoute>
          } />
          <Route path="/image-workflow/:postId" element={<Navigate to="/" replace />} />
          <Route path="/insight" element={<Navigate to="/search" replace />} />
          <Route path="/topics" element={
            <ProtectedRoute>
              <OwnerTopicsPage />
            </ProtectedRoute>
          } />
          <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
          <Route path="/search" element={
            <ProtectedRoute>
              <SearchPage />
            </ProtectedRoute>
          } />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
