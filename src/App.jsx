import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ViewAllPage from './pages/ViewAllPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import RemixPanel from './components/RemixPanel';
import PostDetailView from './components/PostDetailView';
import ImageWorkflowPage from './pages/ImageWorkflowPage';
import InsightPage from './pages/InsightPage';
import TopicsPage from './pages/TopicsPage';
import { AnimatePresence } from 'framer-motion';
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
  const [remixPost, setRemixPost] = useState(null);
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

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
    if (user?.id) {
      dispatch(fetchPosts());
      dispatch(fetchCaptureHistory());
    }
  }, [user?.id, dispatch]);

  // Hermes runs outside the browser. Refresh compact workflow state while the
  // user is signed in so image analysis and later triage do not require a
  // manual page refresh.
  useEffect(() => {
    if (!user?.id) return undefined;
    const intervalId = window.setInterval(() => {
      dispatch(fetchPosts());
      dispatch(fetchCaptureHistory());
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [user?.id, dispatch]);

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={
            <ProtectedRoute>
              <HomePage onRemix={setRemixPost} />
            </ProtectedRoute>
          } />
          <Route path="/view-all" element={
            <ProtectedRoute>
              <ViewAllPage onRemix={setRemixPost} />
            </ProtectedRoute>
          } />
          <Route path="/collection/:collectionId" element={
            <ProtectedRoute>
              <ViewAllPage onRemix={setRemixPost} />
            </ProtectedRoute>
          } />
          <Route path="/post/:postId" element={
            <ProtectedRoute>
              <PostDetailView onRemix={setRemixPost} />
            </ProtectedRoute>
          } />
          <Route path="/image-workflow/:postId" element={
            <ProtectedRoute>
              <ImageWorkflowPage />
            </ProtectedRoute>
          } />
          <Route path="/insight" element={
            <ProtectedRoute>
              <InsightPage />
            </ProtectedRoute>
          } />
          <Route path="/topics" element={
            <ProtectedRoute>
              <TopicsPage />
            </ProtectedRoute>
          } />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Routes>

        <AnimatePresence>
          {remixPost && (
            <RemixPanel post={remixPost} onClose={() => setRemixPost(null)} />
          )}
        </AnimatePresence>
      </Layout>
    </Router>
  );
}

export default App;
