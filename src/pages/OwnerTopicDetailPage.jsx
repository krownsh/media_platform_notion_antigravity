import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpenText, ExternalLink, FileText, FolderKanban, Link2, RefreshCw } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { listOwnerTopics } from '../api/ownerKnowledgeApi';
import './OwnerTopicDetailPage.css';

const first = (value) => Array.isArray(value) ? value[0] : value;
const sourcePost = (item) => first(first(item.collection_source_revisions)?.collection_posts);

function sourceDate(post) {
    const date = new Date(post?.created_at || 0);
    return Number.isNaN(date.getTime()) || date.getTime() === 0 ? null : date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'short', day: 'numeric' });
}

function sourceHost(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

function SourceCard({ item, label = '查看來源' }) {
    const post = sourcePost(item);
    const title = post?.title || post?.author_name || '已接受來源';
    const id = post?.id || first(item.collection_source_revisions)?.post_id;
    const host = sourceHost(post?.original_url);
    const meta = [post?.platform?.toUpperCase(), post?.author_name, sourceDate(post)].filter(Boolean).join(' · ');
    return <article className="topic-source-card"><div className="topic-source-card-copy"><p>{meta || '已接受的原始來源'}</p><h3>{title}</h3>{host && <span>{host}</span>}</div><div className="topic-source-card-actions">{id && <Link to={`/post/${id}`}>{label}<ArrowUpRight size={14} /></Link>}{post?.original_url && <a href={post.original_url} target="_blank" rel="noreferrer" aria-label="開啟原始來源"><ExternalLink size={14} /></a>}</div></article>;
}

function RevisionCard({ revision }) {
    const claims = Array.isArray(revision.claims) ? revision.claims.filter(Boolean) : [];
    const questions = Array.isArray(revision.open_questions) ? revision.open_questions.filter(Boolean) : [];
    return <article className="topic-detail-revision"><div className="topic-detail-revision-head"><span>REV. {revision.revision_number}</span><time>{sourceDate(sourcePost(revision)) || ''}</time></div><p>{revision.summary}</p>{claims.length > 0 && <ul>{claims.map((claim, index) => <li key={`${claim}-${index}`}>{claim}</li>)}</ul>}{questions.length > 0 && <div className="topic-open-questions"><b>待確認</b>{questions.map((question, index) => <span key={`${question}-${index}`}>{question}</span>)}</div>}<SourceCard item={revision} label="對照來源" /></article>;
}

export default function OwnerTopicDetailPage() {
    const { topicId } = useParams(); const [topic, setTopic] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
    const load = useCallback(async () => { setLoading(true); setError(''); try { const payload = await listOwnerTopics(topicId); setTopic(payload.topic || null); } catch (e) { setError(e.message); } finally { setLoading(false); } }, [topicId]);
    useEffect(() => { load(); }, [load]);
    if (loading) return <div className="topic-detail-page"><p className="topic-detail-loading">正在載入 Topic…</p></div>;
    if (error || !topic) return <div className="topic-detail-page"><Link to="/topics" className="topic-detail-back"><ArrowLeft size={16} />返回 Topics</Link><p className="topic-detail-error">無法讀取這個 Topic：{error || '找不到資料'}</p></div>;
    const links = topic.owner_topic_source_links || []; const revisions = topic.owner_topic_revisions || []; const references = topic.owner_topic_project_references || [];
    return <div className="topic-detail-page"><header className="topic-detail-header"><Link to="/topics" className="topic-detail-back"><ArrowLeft size={16} />返回 Topics</Link><div><p>TOPIC / OWNER-ACCEPTED</p><h1>{topic.label}</h1><span>{topic.status || 'active'}</span></div><button type="button" onClick={load} aria-label="重新整理 Topic"><RefreshCw size={16} /></button></header><section className="topic-detail-stats"><span><b>{links.length}</b>來源連結</span><span><b>{revisions.length}</b>知識 revision</span><span><b>{references.length}</b>專案參考</span></section><div className="topic-detail-grid"><section><header><Link2 size={17} /><h2>來源連結</h2></header>{links.length ? <div className="topic-source-card-list">{links.map((item) => <SourceCard key={item.id} item={item} />)}</div> : <p className="topic-detail-muted">尚無接受後的來源連結。</p>}</section><section><header><BookOpenText size={17} /><h2>知識 Revision</h2></header>{revisions.length ? revisions.map((item) => <RevisionCard key={item.id} revision={item} />) : <p className="topic-detail-muted">尚無已接受的知識摘要。</p>}</section><section><header><FolderKanban size={17} /><h2>專案參考</h2></header>{references.length ? references.map((item) => <article key={item.id} className="topic-detail-reference"><strong>{first(item.owner_project_catalog)?.title || '未命名專案'}</strong><p>{item.rationale}</p><SourceCard item={item} label="查看依據" /></article>) : <p className="topic-detail-muted">尚無已接受的專案參考。</p>}</section></div><footer><FileText size={15} />這裡只呈現 Owner 接受後所建立的關聯；建立 Topic 本身不會自動將舊資料或候選納入。</footer></div>;
}
