import React from 'react';
import UrlInput from '../components/UrlInput';
import CaptureReviewQueue from '../components/CaptureReviewQueue';
import ReviewFocusPanel from '../components/ReviewFocusPanel';
import { Link } from 'react-router-dom';
import { BookOpenText, FolderGit2, Search } from 'lucide-react';

const HomePage = () => {
    return (
        <div className="flow-page px-1 sm:px-2">
            <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.38fr)] lg:items-end pt-5 sm:pt-8 md:pt-12 mb-8 sm:mb-10">
                <div className="max-w-3xl">
                    <p className="flow-kicker mb-3">收件匣</p>
                    <h1 className="text-[2rem] sm:text-4xl md:text-[2.8rem] font-bold tracking-[-0.055em] leading-[1.08] text-[rgba(0,0,0,0.95)]">
                        把來源帶進可行動的知識流
                    </h1>
                    <p className="mt-4 max-w-2xl text-sm sm:text-base leading-7 text-[#615d59]">
                        貼上連結或上傳圖片。系統先保存原始證據，再把需要你決定的候選清楚呈現；未接受前，不會寫進正式知識。
                    </p>
                </div>
                <aside className="flow-panel px-4 py-4 sm:px-5 sm:py-5">
                    <p className="text-sm font-semibold text-[rgba(0,0,0,0.95)]">先收下，再決定下一步</p>
                    <p className="mt-2 text-xs sm:text-sm leading-6 text-[#615d59]">
                        新增後可繼續工作。回到這裡時，直接看「目前階段」與「下一步」；不需要記住流程。
                    </p>
                </aside>
            </section>

            <UrlInput />

            <CaptureReviewQueue />

            <section className="mt-8 sm:mt-10">
                <ReviewFocusPanel />
            </section>

            <section className="mt-10 sm:mt-14"><p className="flow-kicker mb-2">接下來你可以做什麼</p><div className="grid gap-3 sm:grid-cols-3">
                <Link to="/search" className="flow-surface p-5 hover:border-[var(--accent)]"><Search size={18} className="text-[var(--accent)]" /><h2 className="mt-3 font-semibold">找回一篇貼文</h2><p className="mt-2 text-sm leading-6 text-[#615d59]">用印象中的詞、作者或情境，從原始與已接受知識中找。</p></Link>
                <Link to="/topics" className="flow-surface p-5 hover:border-[var(--accent)]"><BookOpenText size={18} className="text-[var(--accent)]" /><h2 className="mt-3 font-semibold">整理 Topic</h2><p className="mt-2 text-sm leading-6 text-[#615d59]">查看獨立累積、帶來源引用的主題知識。</p></Link>
                <Link to="/projects" className="flow-surface p-5 hover:border-[var(--accent)]"><FolderGit2 size={18} className="text-[var(--accent)]" /><h2 className="mt-3 font-semibold">查看可參考的專案</h2><p className="mt-2 text-sm leading-6 text-[#615d59]">把 Topic 與既有專案連起來；POC 仍需要獨立確認。</p></Link>
            </div></section>
        </div>
    );
};

export default HomePage;
