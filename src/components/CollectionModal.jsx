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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent backdrop-blur-md p-4">
            <div className="bg-transparent border notion-whisper-border w-full max-w-6xl h-[85vh] rounded-lg flex flex-col shadow-2xl overflow-hidden relative backdrop-blur-xl">

                {/* Header */}
                <div className="p-6 border-b border-[rgba(0,0,0,0.1)]/20 flex items-center justify-between bg-transparent z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-[#0075de]/20 rounded-lg text-[#0075de]">
                            <FolderOpen size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[rgba(0,0,0,0.95)]">{collection.name}</h2>
                            <p className="text-sm text-[#615d59]">{posts.length} 個項目</p>
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
                <div className="flex-1 overflow-y-auto p-8 bg-secondary/5 custom-scrollbar">
                    {posts.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-[#615d59]/60">
                            <p className="text-lg">此資料夾是空的</p>
                        </div>
                    ) : (
                        <SortableContext items={posts.map(p => p.id)} strategy={rectSortingStrategy}>
                            <div className="grid grid-cols-[repeat(auto-fit,360px)] gap-8 justify-center">
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
                        p-6 border-t border-[rgba(0,0,0,0.1)]/10 transition-all duration-300 text-center border-dashed border-2 m-6 rounded-lg
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
