import React, { useState } from 'react';
import { Link2, ArrowRight, Loader2 } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { addPostByUrl } from '../features/postsSlice';
import { motion } from 'framer-motion';

const UrlInput = () => {
    const [url, setUrl] = useState('');
    const dispatch = useDispatch();
    const { loading } = useSelector((state) => state.posts);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (url.trim()) {
            dispatch(addPostByUrl({ url }));
            setUrl('');
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-3xl mx-auto mb-12"
        >
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                <form onSubmit={handleSubmit} className="relative flex items-center bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl">
                    <div className="pl-4 text-gray-400">
                        <Link2 size={20} />
                    </div>
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="Paste Instagram, Twitter, or Facebook link..."
                        className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 px-4 py-3 text-lg"
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        disabled={loading || !url}
                        className="bg-white text-black px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                <span>Processing</span>
                            </>
                        ) : (
                            <>
                                <span>Add</span>
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* Helper Text */}
            <div className="mt-4 flex justify-center gap-6 text-sm text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>Instagram</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>Facebook</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>Twitter / X</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-white"></span>Threads</span>
            </div>
        </motion.div>
    );
};

export default UrlInput;
