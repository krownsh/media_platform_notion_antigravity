import React from 'react';
import { X, FolderOpen } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import SortablePostCard from './SortablePostCard';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';

const CollectionModal = ({ collection, posts, onClose, onPostClick, onRemix, readOnly = false }) => {
    // Drop zone for removing items
    const { setNodeRef: setRemoveRef, isOver: isOverRemove } = useDroppable({
        id: 'remove-zone',
        disabled: readOnly,
        data: { type: 'remove-zone' }
    });

    return (
        <div className="fixed inset-0 z-[70] flex items-stretch sm:items-center justify-center bg-[#17201d]/25 backdrop-blur-[3px] p-0 sm:p-4">
            <div className="w-full h-[100dvh] sm:h-[90vh] sm:max-w-[95vw] bg-surface-raised border notion-whisper-border rounded-none sm:rounded-[1rem] flex flex-col overflow-hidden shadow-deep">

                {/* Header */}
                <div className="py-3 px-4 sm:py-4 sm:px-6 border-b notion-whisper-border flex items-center justify-between bg-surface-raised z-10 gap-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-2 bg-[var(--accent-soft)] rounded-[0.65rem] text-[var(--accent)]">
                            <FolderOpen size={20} className="sm:w-5 sm:h-5" />
                        </div>
                        <div className="min-w-0 flex flex-row items-baseline gap-2">
                            <h2 className="text-base sm:text-lg font-bold text-[rgba(0,0,0,0.95)] truncate max-w-[56vw] sm:max-w-none">{collection.name}</h2>
                            <p className="text-xs text-[#615d59] flex-shrink-0">{readOnly ? `歷史唯讀 · ${posts.length} 個項目` : `${posts.length} 個項目`}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="flow-icon-button"
                        aria-label="關閉收藏夾"
                    >
                        <X size={20} className="text-[#615d59] hover:text-[rgba(0,0,0,0.95)]" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[var(--surface)] custom-scrollbar">
                    {posts.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center text-[#615d59] px-6">
                            <p className="text-lg font-semibold text-[rgba(0,0,0,0.95)]">此資料夾目前是空的</p>
                            <p className="mt-2 text-sm">{readOnly ? '這是保留的歷史分類紀錄，不接受新的貼文。' : '從收件匣拖曳貼文進來，就能在這裡持續整理。'}</p>
                        </div>
                    ) : (
                        <SortableContext items={posts.map(p => p.id)} strategy={rectSortingStrategy}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                                {posts.map(post => (
                                    <SortablePostCard
                                        key={post.id}
                                        post={post}
                                        onRemix={onRemix}
                                        onClick={() => onPostClick(post)}
                                        // Disable delete/rename from inside modal for simplicity, or keep them
                                        onDelete={() => { }}
                                        onRename={() => { }}
                                        isCompact={true}
                                        disabled={readOnly}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    )}
                </div>

                {/* Remove Zone (Footer) */}
                {!readOnly && <div
                    ref={setRemoveRef}
                    className={`
                        py-3 px-4 sm:py-4 sm:px-6 transition-all duration-300 text-center border-dashed border mx-4 mb-4 mt-2 sm:mx-6 sm:mb-6 sm:mt-2 rounded-[0.75rem]
                        ${isOverRemove
                            ? 'bg-destructive/10 border-destructive text-destructive scale-[1.01] shadow-inner'
                            : 'bg-[var(--surface-muted)] border-[var(--border-subtle)] text-[#615d59] hover:border-[var(--destructive)]'}
                    `}
                >
                    <p className="font-medium text-sm">拖曳項目到此處以從資料夾移除</p>
                </div>}
            </div>
        </div>
    );
};

export default CollectionModal;
