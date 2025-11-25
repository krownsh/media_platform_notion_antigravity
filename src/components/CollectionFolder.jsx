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
        if (window.confirm('Are you sure you want to delete this folder? Posts inside will be moved to Uncategorized.')) {
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
                relative w-full aspect-[4/3] transition-all duration-200
                ${isOver ? 'scale-110' : 'hover:scale-105'}
            `}>
                {/* Folder Tab */}
                <div className={`
                    absolute top-0 left-0 w-1/2 h-4 rounded-t-lg border-t border-l border-r
                    ${isOver ? 'bg-blue-500/20 border-blue-400' : 'bg-[#2A2A2A] border-white/10'}
                `} />

                {/* Folder Body */}
                <div className={`
                    absolute top-3 inset-x-0 bottom-0 rounded-b-xl rounded-tr-xl border
                    ${isOver ? 'bg-blue-500/20 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-[#1A1A1A] border-white/10 group-hover:border-white/30'}
                    flex items-center justify-center overflow-hidden
                `}>
                    {/* Content Previews */}
                    {previewImages.length > 0 ? (
                        <div className="grid grid-cols-2 gap-1 p-2 w-full h-full">
                            {previewImages.slice(0, 4).map((img, idx) => (
                                <div key={idx} className="relative w-full h-full overflow-hidden rounded-sm bg-black/50">
                                    <img
                                        src={proxyImage(img)}
                                        alt=""
                                        className="w-full h-full object-cover opacity-80"
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        // Empty State
                        <div className="flex flex-col items-center justify-center text-gray-600">
                            <div className="w-12 h-1 bg-gray-700/50 rounded-full mb-1" />
                            <div className="w-8 h-1 bg-gray-700/50 rounded-full" />
                        </div>
                    )}
                </div>

                {/* Menu Button */}
                <button
                    onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                    className="absolute top-5 right-2 p-1 rounded-full text-gray-400 hover:text-white hover:bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                    <MoreVertical size={14} />
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
                        className="bg-black/50 border border-blue-500 rounded px-2 py-0.5 text-xs text-center w-full outline-none text-white"
                    />
                </form>
            ) : (
                <div className="flex flex-col items-center w-full">
                    <span className="text-sm text-gray-300 font-medium truncate w-full text-center px-1">
                        {collection.name}
                    </span>
                    <span className="text-[10px] text-gray-500">
                        {postCount} items
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
                    <div className="absolute top-8 right-[-10px] bg-[#222] border border-white/10 rounded-lg shadow-xl z-50 w-32 py-1 overflow-hidden">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(true);
                                setShowMenu(false);
                            }}
                            className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-white/10 flex items-center gap-2"
                        >
                            <Edit2 size={12} /> Rename
                        </button>
                        <button
                            onClick={(e) => {
                                handleDelete(e);
                                setShowMenu(false);
                            }}
                            className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                        >
                            <Trash2 size={12} /> Delete
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default CollectionFolder;
