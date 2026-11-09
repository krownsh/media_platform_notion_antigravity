import React from 'react';
import { ArrowUpRight, BookOpenText, FolderGit2, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import CaptureReviewQueue from '../components/CaptureReviewQueue';
import ReviewFocusPanel from '../components/ReviewFocusPanel';
import UrlInput from '../components/UrlInput';
import './HomePage.css';

const nextSteps = [
    { to: '/search', icon: Search, index: '01', title: '找回一篇貼文', description: '用記得的詞、作者或情境，從原始與已接受知識中找回來源。' },
    { to: '/topics', icon: BookOpenText, index: '02', title: '整理 Topic', description: '查看獨立累積、帶來源引用的主題知識與討論歷程。' },
    { to: '/projects', icon: FolderGit2, index: '03', title: '查看專案脈絡', description: '把 Topic 與可參考專案連起來；POC 仍需要你的獨立確認。' },
];

const HomePage = () => (
    <div className="home-editorial-page">
        <header className="home-editorial-head">
            <div><p>OWNER COLLECTION / INBOX</p><h1>收件匣</h1></div>
            <div className="home-editorial-head-note"><strong>先保存原始證據</strong><span>再決定哪些理解值得留下。</span></div>
        </header>
        <p className="home-editorial-intro">把公開連結或圖片放進收件匣。來源會先完整保存，候選與正式知識則永遠等你明確決定後才往下走。</p>

        <UrlInput />
        <CaptureReviewQueue />
        <ReviewFocusPanel />

        <section className="home-editorial-next" aria-labelledby="next-steps-title">
            <div className="home-editorial-next-head"><div><p>04 / CONTINUE EXPLORING</p><h2 id="next-steps-title">接下來，你可以往哪裡走？</h2></div><span>不確定時，從一條線索開始就好。</span></div>
            <div className="home-editorial-next-grid">{nextSteps.map(({ to, icon: Icon, index, title, description }) => <Link key={to} to={to} className="home-editorial-next-card"><span>{index}</span>{React.createElement(Icon, { size: 20 })}<h3>{title}</h3><p>{description}</p><b>前往 <ArrowUpRight size={15} /></b></Link>)}</div>
        </section>
    </div>
);

export default HomePage;
