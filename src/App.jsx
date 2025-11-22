import React, { useState } from 'react';
import { Provider } from 'react-redux';
import { store } from './store';
import Layout from './components/Layout';
import UrlInput from './components/UrlInput';
import CollectionBoard from './components/CollectionBoard';
import RemixPanel from './components/RemixPanel';
import PostDetailView from './components/PostDetailView';
import { AnimatePresence } from 'framer-motion';

function App() {
  const [remixPost, setRemixPost] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);

  return (
    <Provider store={store}>
      <Layout>
        <div className="w-full mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Curate your <span className="text-gradient">Digital Mind</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Save, analyze, and remix content from Instagram, Twitter, and Facebook.
              Turn social noise into structured knowledge.
            </p>
          </div>

          <UrlInput />

          <div className="mt-16">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Recent Saves</h3>
              <button className="text-sm text-gray-400 hover:text-white transition-colors">View All</button>
            </div>
            {/* Pass setRemixPost to children via Context or Props */}
            <CollectionBoard onRemix={setRemixPost} onPostClick={setSelectedPost} />
          </div>
        </div>

        <AnimatePresence>
          {remixPost && (
            <RemixPanel post={remixPost} onClose={() => setRemixPost(null)} />
          )}
          {selectedPost && (
            <PostDetailView post={selectedPost} onClose={() => setSelectedPost(null)} />
          )}
        </AnimatePresence>
      </Layout>
    </Provider>
  );
}

export default App;
