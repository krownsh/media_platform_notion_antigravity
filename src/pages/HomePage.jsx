import React from 'react';
import UrlInput from '../components/UrlInput';
import CollectionBoard from '../components/CollectionBoard';
import { useNavigate } from 'react-router-dom';

const HomePage = ({ onRemix }) => {
    const navigate = useNavigate();

    return (
        <div className="w-full mx-auto px-2 sm:px-4">
            <div className="text-center mb-8 md:mb-16 pt-[40px] md:pt-[80px]">
                <p className="notion-text-body-large text-[#615d59] max-w-2xl mx-auto mb-2 px-2">
                    儲存、分析並改寫來自 Instagram、Twitter 和 Facebook 的內容。
                    將社群雜訊轉化為結構化知識。
                </p>
                <p className="notion-text-body text-[#a39e98] max-w-2xl mx-auto">
                    (目前只有Threads/Twitter可以用，因為ig跟fb比較沒有知識性的文章)
                </p>
            </div>

            <UrlInput />

            <div className="mt-12">
                <div className="flex items-center justify-between mb-8 px-2">
                    <h3 className="notion-text-card-title text-[rgba(0,0,0,0.95)]">最近儲存</h3>
                    <button
                        onClick={() => navigate('/view-all')}
                        className="notion-btn-ghost"
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
