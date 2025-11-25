import React from 'react';
import UrlInput from '../components/UrlInput';
import CollectionBoard from '../components/CollectionBoard';
import { useNavigate } from 'react-router-dom';

const HomePage = ({ onRemix, onPostClick }) => {
    const navigate = useNavigate();

    return (
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
                    <button
                        onClick={() => navigate('/view-all')}
                        className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        View All
                    </button>
                </div>
                <CollectionBoard onRemix={onRemix} onPostClick={onPostClick} />
            </div>
        </div>
    );
};

export default HomePage;
