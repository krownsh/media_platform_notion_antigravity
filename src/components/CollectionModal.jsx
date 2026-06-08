import React from 'react';
import { X, FolderOpen } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import SortablePostCard from './SortablePostCard';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';

const CollectionModal = ({ collection, posts, onClose, onPostClick, onRemix }) => {
    // Drop zone for removing items
    const { setNodeRef: setRemoveRef, isOver: isOverRemove } = useDroppable({
        id: 'remove-zone',
        data: { type: 'remove-zone' }
    });

    return (
        <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-transparent backdrop-blur-md p-0 sm:p-4">
            <div className="w-full h-[100dvh] sm:h-[90vh] sm:max-w-[95vw] bg-transparent border notion-whisper-border rounded-none sm:rounded-lg flex flex-col overflow-hidden shadow-2xl backdrop-blur-2xl">

                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-[rgba(0,0,0,0.1)]/20 flex items-center justify-between bg-transparent z-10 gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-[#0075de]/20 rounded-lg text-[#0075de]">
                            <FolderOpen size={24} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg sm:text-xl font-bold text-[rgba(0,0,0,0.95)] truncate max-w-[56vw] sm:max-w-none">{collection.name}</h2>
                            <p className="text-xs sm:text-sm text-[#615d59]">{posts.length} 個項目</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-black/5 rounded-full transition-colors"
                    >
                        <X size={24} className="text-[#615d59] hover:text-[rgba(0,0,0,0.95)]" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-secondary/5 custom-scrollbar">
                    {posts.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-[#615d59]/60">
                            <p className="text-lg">此資料夾是空的</p>
                        </div>
                    ) : (
                        <SortableContext items={posts.map(p => p.id)} strategy={rectSortingStrategy}>
                            <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(260px,360px))] gap-4 sm:gap-8 justify-center">
                                {posts.map(post => (
                                    <SortablePostCard
                                        key={post.id}
                                        post={post}
                                        onRemix={onRemix}
                                        onClick={() => onPostClick(post)}
                                        // Disable delete/rename from inside modal for simplicity, or keep them
                                        onDelete={() => { }}
                                        onRename={() => { }}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    )}
                </div>

                {/* Remove Zone (Footer) */}
                <div
                    ref={setRemoveRef}
                    className={`
                        p-4 sm:p-6 border-t border-[rgba(0,0,0,0.1)]/10 transition-all duration-300 text-center border-dashed border-2 m-4 sm:m-6 rounded-lg
                        ${isOverRemove
                            ? 'bg-destructive/10 border-destructive text-destructive scale-[1.02] shadow-inner'
                            : 'bg-transparent border-[rgba(0,0,0,0.1)]/30 text-[#615d59] hover:bg-transparent hover:border-[rgba(0,0,0,0.1)]/50'}
                    `}
                >
                    <p className="font-medium text-sm">拖曳項目到此處以從資料夾移除</p>
                </div>
            </div>
        </div>
    );
};

export default CollectionModal;
