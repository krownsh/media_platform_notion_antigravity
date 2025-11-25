import React, { useState } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { store } from './store';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ViewAllPage from './pages/ViewAllPage';
import RemixPanel from './components/RemixPanel';
import PostDetailView from './components/PostDetailView';
import { AnimatePresence } from 'framer-motion';

function App() {
  const [remixPost, setRemixPost] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);

  return (
    <Provider store={store}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage onRemix={setRemixPost} onPostClick={setSelectedPost} />} />
            <Route path="/view-all" element={<ViewAllPage onRemix={setRemixPost} onPostClick={setSelectedPost} />} />
            <Route path="/collection/:collectionId" element={<ViewAllPage onRemix={setRemixPost} onPostClick={setSelectedPost} />} />
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
