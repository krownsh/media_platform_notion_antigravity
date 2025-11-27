import React from 'react';
import UrlInput from '../components/UrlInput';
import CollectionBoard from '../components/CollectionBoard';
import { useNavigate } from 'react-router-dom';

const HomePage = ({ onRemix }) => {
    const navigate = useNavigate();

    return (
        <div className="w-full mx-auto px-4">
            <div className="text-center mb-16 pt-8">
                <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6 tracking-tight">
                    整理您的 <span className="text-gradient">數位思維</span>
                </h2>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
                    儲存、分析並改寫來自 Instagram、Twitter 和 Facebook 的內容。
                    將社群雜訊轉化為結構化知識。
                </p>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
                    (目前只有Threads/Twitter可以用，因為ig跟fb比較沒有知識性的文章)
                </p>
            </div>

            <UrlInput />

            <div className="mt-20">
                <div className="flex items-center justify-between mb-8 px-2">
                    <h3 className="text-xl font-semibold text-foreground/90">最近儲存</h3>
                    <button
                        onClick={() => navigate('/view-all')}
                        className="text-sm text-muted-foreground hover:text-accent transition-colors font-medium"
                    >
                        查看全部
                    </button>
                </div>
                <CollectionBoard onRemix={onRemix} />
            </div>
        </div>
    );
};

export default HomePage;
