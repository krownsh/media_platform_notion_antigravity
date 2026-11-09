import React, { useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, FolderOpen, MessageSquareText, ShieldCheck, X } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { decideReviewProposal, fetchReviewPackets } from '../features/reviewSlice';
import './ReviewFocusPanel.css';
import './ReviewProposalActions.css';
import './ReviewProposalDependencies.css';

function postId(post) { return post?.dbId || post?.id || null; }
function sourceTitle(post, packet) { const source = packet?.source_revision?.source_payload || {}; return post?.title || post?.analysis?.generated_title || source.title || '未命名貼文'; }
function sourceText(post, packet) { const source = packet?.source_revision?.source_payload || {}; return post?.content || source.content || source.text || '這篇來源沒有可顯示的文字內容。'; }
function sourceImage(post, packet) { if (post?.images?.[0]) return post.images[0]; if (post?.screenshot) return post.screenshot; const media = packet?.source_revision?.source_payload?.media; return Array.isArray(media) ? media.find((item) => item?.type === 'image')?.url || null : null; }
function sourceAuthor(post, packet) { return post?.author || post?.author_name || packet?.source_revision?.source_payload?.author_name || null; }
function proposalLabel(type) { return ({ folder_assignment: '資料夾建議', post_learning_note: '貼文筆記', topic_assignment: 'Topic 指派', topic_knowledge_delta: 'Topic 知識', project_reference: '專案參考', content_review_brief: '內容審核摘要' })[type] || '待討論項目'; }
function topicLabels(payload) { return [payload?.primary_topic, ...(payload?.related_topics || []), ...(payload?.topics || []).map((topic) => topic?.label), ...(payload?.topic_labels || [])].filter(Boolean).filter((label, index, values) => values.indexOf(label) === index); }
function needsDetails(proposal) { return ['post_learning_note', 'topic_knowledge_delta'].includes(proposal.proposal_type); }

function workflowPresentation(packet) {
    if (!packet) return { label: '從一份來源開始', description: '從上方選一篇已保存來源，這裡會呈現它的完整狀態與唯一下一步。' };
    if (packet.status === 'deferred') return { label: '這份來源暫緩中', description: '來源仍安全保存；需要時可在對話中恢復討論。' };
    if (packet.status === 'completed') return { label: '目前討論已結束', description: '這一輪候選已有結果；你仍可在 Agent 對話中延伸它。' };
    if (packet.source_revision?.capture_quality === 'partial') return { label: '來源待補確認', description: '擷取內容不完整；先在 Agent 對話中確認是否以現有內容繼續。' };
    return { label: '確認這份來源的去向', description: '候選仍是草稿。只有你按下接受後，才會成為資料夾、Topic 或專案的正式關聯。' };
}

function SourcePreview({ post, packet }) {
    const image = sourceImage(post, packet); const title = sourceTitle(post, packet); const author = sourceAuthor(post, packet); const platform = post?.platform || packet?.source_revision?.source_payload?.platform || '來源';
    return <article className="review-editorial-source"><div className={`review-editorial-media ${image ? 'has-image' : ''}`}>{image ? <img src={image} alt="貼文媒體預覽" /> : <><span>{platform}</span><p>原始<br />來源</p></>}</div><div className="review-editorial-source-copy"><p className="review-editorial-source-meta">{author || platform}{author && ` · ${platform}`}</p><h3>{title}</h3><p className="review-editorial-source-text">{sourceText(post, packet)}</p>{packet?.post_id && <Link to={`/post/${packet.post_id}`} className="review-editorial-source-link"><ExternalLink size={14} />查看完整貼文</Link>}</div></article>;
}

function ProposalCopy({ proposal }) {
    const payload = proposal.payload || {}; const labels = topicLabels(payload);
    const copy = {
        folder_assignment: payload.suggested_name ? `建議歸入「${payload.suggested_name}」` : '建議先留在 Inbox',
        post_learning_note: '請決定這篇來源是否值得留下自己的學習筆記。',
        topic_assignment: labels.length ? `建議連結到 ${labels.length} 個 Topic` : '這篇來源暫時沒有明確 Topic。',
        topic_knowledge_delta: labels.length ? '請決定它是否為既有 Topic 增加可引用的知識。' : '這篇來源不需要新增 Topic 知識。',
        project_reference: labels.length ? `建議讓 ${labels.join('、')} 參考一個既有專案。` : '建議建立 Topic 與專案的關聯。'
    }[proposal.proposal_type] || '請確認這份候選是否應保留。';
    return <><p className="review-proposal-copy">{copy}</p>{labels.length > 0 && <div className="review-proposal-tags">{labels.map((label) => <span key={label}>{label}</span>)}</div>}{payload.rationale && <p className="review-proposal-rationale">{payload.rationale}</p>}</>;
}

function LearningNoteEditor({ proposal, onCancel, onSubmit, pending }) {
    const [mode, setMode] = useState('recorded'); const [content, setContent] = useState(''); const payload = proposal.payload || {};
    const submit = () => { if (mode === 'recorded' && !content.trim()) return; onSubmit({ ...payload, note_status: mode, content: mode === 'recorded' ? content.trim() : null }); };
    return <div className="review-proposal-editor"><label><span>這篇來源要留下筆記嗎？</span><select value={mode} onChange={(event) => setMode(event.target.value)}><option value="recorded">記錄一則筆記</option><option value="not_needed">不需要筆記</option></select></label>{mode === 'recorded' && <label><span>你的筆記</span><textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="寫下想保留的觀點、判斷或待驗證的問題…" rows="4" /></label>}<div className="review-proposal-editor-actions"><button type="button" onClick={onCancel}>取消</button><button type="button" disabled={pending || (mode === 'recorded' && !content.trim())} onClick={submit}><Check size={15} />確認並接受</button></div></div>;
}

function TopicKnowledgeEditor({ proposal, onCancel, onSubmit, pending }) {
    const payload = proposal.payload || {}; const [mode, setMode] = useState('recorded'); const [topics, setTopics] = useState(() => (payload.topics || []).map((topic) => ({ ...topic, summary: topic.summary || '', claims: (topic.claims || []).join('\n'), open_questions: (topic.open_questions || []).join('\n') })));
    const updateTopic = (index, field, value) => setTopics((current) => current.map((topic, itemIndex) => itemIndex === index ? { ...topic, [field]: value } : topic));
    const canSubmit = mode === 'not_needed' || topics.every((topic) => topic.summary.trim());
    const submit = () => onSubmit({ ...payload, decision: mode, topics: topics.map((topic) => ({ ...topic, summary: topic.summary.trim() || null, claims: String(topic.claims).split('\n').map((item) => item.trim()).filter(Boolean), open_questions: String(topic.open_questions).split('\n').map((item) => item.trim()).filter(Boolean) })) });
    return <div className="review-proposal-editor"><label><span>這份來源是否新增 Topic 知識？</span><select value={mode} onChange={(event) => setMode(event.target.value)}><option value="recorded">記錄成正式知識</option><option value="not_needed">不需要新增知識</option></select></label>{mode === 'recorded' && topics.map((topic, index) => <fieldset key={`${topic.label}-${index}`}><legend>{topic.label || 'Topic'}</legend><label><span>可引用摘要</span><textarea value={topic.summary} onChange={(event) => updateTopic(index, 'summary', event.target.value)} placeholder="用一句到一段文字說明這份來源帶來的新知識…" rows="3" /></label><label><span>要點（每行一項，可選）</span><textarea value={topic.claims} onChange={(event) => updateTopic(index, 'claims', event.target.value)} rows="2" /></label><label><span>待驗證問題（每行一項，可選）</span><textarea value={topic.open_questions} onChange={(event) => updateTopic(index, 'open_questions', event.target.value)} rows="2" /></label></fieldset>)}<div className="review-proposal-editor-actions"><button type="button" onClick={onCancel}>取消</button><button type="button" disabled={pending || !canSubmit} onClick={submit}><Check size={15} />確認並接受</button></div></div>;
}

function ProposalCard({ proposal, pending, blocked, onDecide }) {
    const [editing, setEditing] = useState(false); const [confirmReject, setConfirmReject] = useState(false); const needsEditor = needsDetails(proposal);
    const accept = () => needsEditor ? setEditing(true) : onDecide(proposal, 'accept');
    return <article className="review-proposal-card"><header><span>{proposalLabel(proposal.proposal_type)}</span><small>草稿候選</small></header><ProposalCopy proposal={proposal} />{blocked && <p className="review-proposal-blocked">請先接受或建立對應的 Topic，再建立專案參考。</p>}{editing ? proposal.proposal_type === 'post_learning_note' ? <LearningNoteEditor proposal={proposal} pending={pending} onCancel={() => setEditing(false)} onSubmit={(payload) => onDecide(proposal, 'edit_and_accept', payload)} /> : <TopicKnowledgeEditor proposal={proposal} pending={pending} onCancel={() => setEditing(false)} onSubmit={(payload) => onDecide(proposal, 'edit_and_accept', payload)} /> : <footer className="review-proposal-actions"><button type="button" onClick={accept} disabled={pending || blocked}><Check size={15} />{needsEditor ? '補充後接受' : '接受'}</button>{confirmReject ? <span><button type="button" className="is-reject" onClick={() => onDecide(proposal, 'reject')} disabled={pending}>確認拒絕</button><button type="button" onClick={() => setConfirmReject(false)}>取消</button></span> : <button type="button" className="is-reject" onClick={() => setConfirmReject(true)} disabled={pending}><X size={15} />拒絕</button>}</footer>}</article>;
}

export default function ReviewFocusPanel() {
    const dispatch = useDispatch(); const { packets, activePacketId, loading, actionPending, error } = useSelector((state) => state.review); const { items } = useSelector((state) => state.posts);
    useEffect(() => { dispatch(fetchReviewPackets()); }, [dispatch]);
    const packet = packets.find((item) => item.id === activePacketId) || packets[0] || null;
    const post = useMemo(() => items.find((item) => postId(item) === packet?.post_id) || null, [items, packet?.post_id]);
    const state = workflowPresentation(packet); const pendingItems = (packet?.proposals || []).filter((item) => ['pending', 'proposed'].includes(item.status)); const hasPendingTopicAssignment = pendingItems.some((item) => item.proposal_type === 'topic_assignment');
    const decide = (proposal, decision, editedPayload = null) => dispatch(decideReviewProposal({ packetId: packet.id, proposalId: proposal.id, decision, expectedVersion: packet.version, editedPayload }));
    return <section id="review-focus-mode" className="review-editorial-panel" aria-labelledby="review-focus-title"><header className="review-editorial-head"><div><p className="capture-editorial-kicker">03 / REVIEW FOCUS</p><h2 id="review-focus-title">{state.label}</h2><p>{state.description}</p></div>{packet && <span className="review-editorial-revision"><ShieldCheck size={15} />來源版本 {packet.version}</span>}</header>{packet ? <><SourcePreview post={post} packet={packet} /><section className="review-editorial-discussion"><div className="review-editorial-discussion-head"><span><MessageSquareText size={19} /></span><div><h3>候選由你決定，系統只負責保存脈絡。</h3><p>接受後才會寫入正式資料；拒絕不會改動原始來源。</p></div></div>{pendingItems.length > 0 ? <div className="review-proposal-list">{pendingItems.map((item) => <ProposalCard key={item.id} proposal={item} pending={actionPending} blocked={item.proposal_type === 'project_reference' && hasPendingTopicAssignment} onDecide={decide} />)}</div> : <p className="review-editorial-no-candidates">這一輪候選都已處理完成。你仍可針對這篇來源，開始新的討論。</p>}<div className="review-editorial-prompt"><span>仍想先討論？</span><strong>「討論這篇貼文：{sourceTitle(post, packet)}」</strong></div></section><footer className="review-editorial-actions"><Link to={`/post/${packet.post_id}`}><ExternalLink size={16} />查看完整貼文</Link><Link to="/view-all"><FolderOpen size={16} />到收藏庫分類</Link></footer></> : <div className="review-editorial-empty">{loading ? '正在載入來源…' : '從上方選一篇來源後，這裡會呈現完整貼文與目前待確認的整理項目。'}</div>}{error && <p role="alert" className="review-editorial-error">{error}</p>}</section>;
}
