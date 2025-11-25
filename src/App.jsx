import React, { useState } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { store } from './store';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ViewAllPage from './pages/ViewAllPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import RemixPanel from './components/RemixPanel';
import PostDetailView from './components/PostDetailView';
import ProtectedRoute from './components/ProtectedRoute';
import { AnimatePresence } from 'framer-motion';

function App() {
  const [remixPost, setRemixPost] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);

  return (
    <Provider store={store}>
      <Router>
        <Layout onPostClick={setSelectedPost}>
          <Routes>
            <Route path="/" element={
              <ProtectedRoute>
                <HomePage onRemix={setRemixPost} onPostClick={setSelectedPost} />
              </ProtectedRoute>
            } />
            <Route path="/view-all" element={
              <ProtectedRoute>
                <ViewAllPage onRemix={setRemixPost} onPostClick={setSelectedPost} />
              </ProtectedRoute>
            } />
            <Route path="/collection/:collectionId" element={
              <ProtectedRoute>
                <ViewAllPage onRemix={setRemixPost} onPostClick={setSelectedPost} />
              </ProtectedRoute>
            } />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
          </Routes>

          <AnimatePresence>
            {remixPost && (
              <RemixPanel post={remixPost} onClose={() => setRemixPost(null)} />
            )}
            {selectedPost && (
              <PostDetailView post={selectedPost} onClose={() => setSelectedPost(null)} />
            )}
          </AnimatePresence>
        </Layout>
      </Router>
    </Provider>
  );
}

export default App;
