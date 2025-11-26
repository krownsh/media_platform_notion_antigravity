import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { MoreVertical, Trash2, Edit2 } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { deleteCollection, updateCollectionName } from '../features/postsSlice';

const CollectionFolder = ({ collection, onClick, postCount = 0, previewImages = [] }) => {
    const dispatch = useDispatch();
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(collection.name);
    const [showMenu, setShowMenu] = useState(false);

    const { setNodeRef, isOver } = useDroppable({
        id: collection.id,
        data: { type: 'collection', collection }
    });

    const handleDelete = (e) => {
        e.stopPropagation();
        if (window.confirm('確定要刪除此資料夾嗎？裡面的貼文將會移動到未分類。')) {
            dispatch(deleteCollection(collection.id));
        }
    };

    const handleRename = (e) => {
        e.preventDefault();
        if (newName.trim()) {
            dispatch(updateCollectionName({ collectionId: collection.id, name: newName }));
            setIsEditing(false);
        }
    };

    // Helper to proxy images
    const proxyImage = (imageUrl) => {
        if (!imageUrl) return null;
        if (imageUrl.includes('instagram.') || imageUrl.includes('fbcdn.net')) {
            return `http://localhost:3001/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
        }
        return imageUrl;
    };

    return (
        <div
            ref={setNodeRef}
            onClick={onClick}
            className="group relative flex flex-col items-center gap-2 w-[140px]"
        >
            {/* Folder Icon Container */}
            <div className={`
                relative w-full aspect-[4/3] transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.3,1)]
                ${isOver ? 'scale-110' : 'hover:scale-105'}
            `}>
                {/* Folder Tab */}
                <div className={`
                    absolute top-0 left-0 w-1/2 h-4 rounded-t-xl border-t border-l border-r transition-colors duration-300
                    ${isOver ? 'bg-accent/30 border-accent' : 'bg-secondary/30 border-white/20'}
                `} />

                {/* Folder Body */}
                <div className={`
                    absolute top-3 inset-x-0 bottom-0 rounded-b-2xl rounded-tr-2xl border transition-all duration-300
                    ${isOver ? 'bg-accent/20 border-accent shadow-[0_0_20px_rgba(127,155,137,0.3)]' : 'bg-secondary/20 border-white/20 group-hover:bg-secondary/30 group-hover:border-white/40'}
                    flex items-center justify-center overflow-hidden backdrop-blur-sm
                `}>
                    {/* Content Previews */}
                    {previewImages.length > 0 ? (
                        <div className="grid grid-cols-2 gap-1 p-2 w-full h-full">
                            {previewImages.slice(0, 4).map((img, idx) => (
                                <div key={idx} className="relative w-full h-full overflow-hidden rounded-lg bg-white/10">
                                    <img
                                        src={proxyImage(img)}
                                        alt=""
                                        className="w-full h-full object-cover opacity-90"
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        // Empty State
                        <div className="flex flex-col items-center justify-center text-muted-foreground/50">
                            <div className="w-12 h-1 bg-current rounded-full mb-1 opacity-50" />
                            <div className="w-8 h-1 bg-current rounded-full opacity-50" />
                        </div>
                    )}
                </div>

                {/* Menu Button */}
                <button
                    onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                    className="absolute top-5 right-2 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/60 opacity-0 group-hover:opacity-100 transition-all z-10"
                >
                    <MoreVertical size={16} />
                </button>
            </div>

            {/* Folder Name */}
            {isEditing ? (
                <form onSubmit={handleRename} onClick={e => e.stopPropagation()} className="w-full">
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onBlur={() => setIsEditing(false)}
                        autoFocus
                        className="bg-white/50 border border-accent rounded-lg px-2 py-1 text-xs text-center w-full outline-none text-foreground"
                    />
                </form>
            ) : (
                <div className="flex flex-col items-center w-full">
                    <span className="text-sm text-foreground/80 font-medium truncate w-full text-center px-1 group-hover:text-foreground transition-colors">
                        {collection.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                        {postCount} 個項目
                    </span>
                </div>
            )}

            {/* Context Menu */}
            {showMenu && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}
                    />
                    <div className="absolute top-8 right-[-10px] bg-white/90 border border-white/50 rounded-xl shadow-xl z-50 w-36 py-1 overflow-hidden backdrop-blur-xl">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(true);
                                setShowMenu(false);
                            }}
                            className="w-full px-4 py-2.5 text-left text-xs text-foreground hover:bg-secondary/20 flex items-center gap-2 transition-colors"
                        >
                            <Edit2 size={14} /> 重新命名
                        </button>
                        <button
                            onClick={(e) => {
                                handleDelete(e);
                                setShowMenu(false);
                            }}
                            className="w-full px-4 py-2.5 text-left text-xs text-destructive hover:bg-destructive/5 flex items-center gap-2 transition-colors"
                        >
                            <Trash2 size={14} /> 刪除
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default CollectionFolder;
