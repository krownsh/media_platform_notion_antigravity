import React from 'react';
import { X, FolderOpen } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import SortablePostCard from './SortablePostCard';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';

const CollectionModal = ({ collection, posts, onClose, onPostClick, onRemix }) => {
    // Drop zone for removing items (optional, or just drag outside)
    // For now, let's just list items. The parent DndContext handles the drag logic.
    // We need to make sure the modal itself is a valid drop zone if we want to reorder inside (future).
    // But the requirement says "drag out to remove".

    // We can define a "Remove Zone" at the bottom or top of the modal, 
    // OR rely on the fact that the main board is "outside" this modal.
    // However, since the modal covers the screen, we might need a specific "Drop here to remove" area 
    // or just handle drops onto the "Uncategorized" area if visible.

    // Simpler approach: Add a "Remove from Folder" drop zone inside the modal.
    const { setNodeRef: setRemoveRef, isOver: isOverRemove } = useDroppable({
        id: 'remove-zone',
        data: { type: 'remove-zone' }
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1A1A1A] border border-white/10 w-full max-w-6xl h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden relative">

                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#1A1A1A] z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                            <FolderOpen size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{collection.name}</h2>
                            <p className="text-sm text-gray-400">{posts.length} items</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X size={24} className="text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-[#0F0F0F]">
                    {posts.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500">
                            <p>This folder is empty</p>
                        </div>
                    ) : (
                        <SortableContext items={posts.map(p => p.id)} strategy={rectSortingStrategy}>
                            <div className="grid grid-cols-[repeat(auto-fit,360px)] gap-6 justify-center">
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
                        p-6 border-t border-white/10 transition-colors text-center border-dashed border-2 m-4 rounded-xl
                        ${isOverRemove ? 'bg-red-500/20 border-red-500 text-red-200' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}
                    `}
                >
                    <p className="font-medium">Drag items here to remove from folder</p>
                </div>
            </div>
        </div>
    );
};

export default CollectionModal;
