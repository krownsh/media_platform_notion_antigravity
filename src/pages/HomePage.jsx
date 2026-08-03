import React from 'react';
import UrlInput from '../components/UrlInput';
import CollectionBoard from '../components/CollectionBoard';
import { useNavigate } from 'react-router-dom';

const HomePage = ({ onRemix }) => {
    const navigate = useNavigate();

    return (
        <div className="flow-page px-1 sm:px-2">
            <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.38fr)] lg:items-end pt-5 sm:pt-8 md:pt-12 mb-8 sm:mb-10">
                <div className="max-w-3xl">
                    <p className="flow-kicker mb-3">收件匣</p>
                    <h1 className="text-[2rem] sm:text-4xl md:text-[2.8rem] font-bold tracking-[-0.055em] leading-[1.08] text-[rgba(0,0,0,0.95)]">
                        把來源帶進可行動的知識流
                    </h1>
                    <p className="mt-4 max-w-2xl text-sm sm:text-base leading-7 text-[#615d59]">
                        貼上連結或上傳圖片。系統會在背景擷取與分析，讓每一筆收藏都能延伸成研究、內容或實作。
                    </p>
                </div>
                <aside className="flow-panel px-4 py-4 sm:px-5 sm:py-5">
                    <p className="text-sm font-semibold text-[rgba(0,0,0,0.95)]">先收下，再決定下一步</p>
                    <p className="mt-2 text-xs sm:text-sm leading-6 text-[#615d59]">
                        新增後可繼續工作。處理進度與重試入口會留在任務中心。
                    </p>
                </aside>
            </section>

            <UrlInput />

            <section className="mt-10 sm:mt-14">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 sm:mb-6 px-1">
                    <div>
                        <p className="flow-kicker mb-1.5">持續整理</p>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-[-0.035em] text-[rgba(0,0,0,0.95)]">最近儲存</h2>
                    </div>
                    <button
                        onClick={() => navigate('/view-all')}
                        className="notion-btn-secondary touch-target-link self-start sm:self-auto"
                    >
                        查看全部
                    </button>
                </div>
                <CollectionBoard onRemix={onRemix} />
            </section>
        </div>
    );
};

export default HomePage;
