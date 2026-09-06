import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useDroppable } from '@dnd-kit/core';
import { MoreVertical, Trash2, Edit2, Folder } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { deleteCollection, updateCollectionName } from '../features/postsSlice';
import { API_BASE_URL } from '../api/config';


const CollectionFolder = ({ collection, onClick, postCount = 0, previewImages = [], isMenuOpen = false, onMenuToggle, readOnly = false }) => {
    const dispatch = useDispatch();
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(collection.name);

    const { setNodeRef, isOver } = useDroppable({
        id: collection.id,
        disabled: readOnly,
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
            return `${API_BASE_URL}/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
        }
        return imageUrl;
    };

    const buttonRef = React.useRef(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

    const handleMenuClick = (e) => {
        e.stopPropagation();
        if (!isMenuOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            // Calculate position to align right edge of menu with right edge of button
            setMenuPos({ top: rect.bottom + 4, left: rect.right - 144 }); // 144 is approximately w-36
        }
        if (onMenuToggle) onMenuToggle();
    };

    return (
        <div
            ref={setNodeRef}
            onClick={onClick}
            className="group relative flex flex-col items-center w-[112px] gap-2"
        >
            {/* Folder Icon Container */}
            <div className={`
                relative w-full aspect-[16/9] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]
                ${isOver ? 'scale-[1.04]' : 'hover:scale-[1.02]'}
            `}>
                {/* Folder Tab */}
                <div className={`
                    absolute top-0 left-0 w-2/5 h-3.5 rounded-t-md border-t border-l border-r transition-colors duration-200 ease-out
                    ${isOver ? 'bg-[var(--accent-soft)] border-[var(--accent)]' : 'bg-[var(--surface-muted)] notion-whisper-border'}
                `} />

                {/* Folder Body */}
                <div className={`
                    absolute top-3 inset-x-0 bottom-0 rounded-b-[0.9rem] rounded-tr-[0.9rem] border transition-[background-color,border-color,box-shadow] duration-200 ease-out
                    ${isOver ? 'bg-[var(--accent-soft)] border-[var(--accent)] shadow-[inset_0_0_0_1px_rgba(45,111,115,0.12)]' : 'bg-[var(--surface-muted)] border-[var(--border-subtle)] group-hover:bg-[var(--surface)] group-hover:border-[var(--accent)]'}
                    flex items-center justify-center overflow-hidden
                `}>
                    {/* Content Previews */}
                    {previewImages.length > 0 ? (
                        <div className="grid grid-cols-2 gap-1 p-2 w-full h-full">
                            {previewImages.slice(0, 4).map((img, idx) => (
                                <div key={idx} className="relative w-full h-full overflow-hidden rounded-lg bg-transparent">
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
                        <div className="flex flex-col items-center justify-center text-[#615d59]/55">
                            <Folder size={22} strokeWidth={1.6} />
                        </div>
                    )}
                </div>

                {/* Menu Button - Placed in the top right empty space */}
                {!readOnly && <button
                    ref={buttonRef}
                    onClick={handleMenuClick}
                    className={`flow-icon-button absolute -top-1 -right-1 min-h-7 min-w-7 z-20 bg-surface-raised shadow-[0_1px_3px_rgba(23,31,26,0.1)] ${isMenuOpen ? 'text-[var(--accent)] border-[var(--accent)]' : ''}`}
                    aria-label={`開啟「${collection.name}」選項`}
                    aria-expanded={isMenuOpen}
                >
                    <MoreVertical size={14} />
                </button>}
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
                        className="notion-input bg-surface-raised border-[var(--accent)] px-2 py-1 text-xs text-center w-full outline-none text-[rgba(0,0,0,0.95)]"
                    />
                </form>
            ) : (
                <div className="flex flex-col items-center w-full">
                    <span className="text-[rgba(0,0,0,0.95)]/80 font-medium truncate w-full text-center px-1 group-hover:text-[rgba(0,0,0,0.95)] text-xs">
                        {collection.name}
                    </span>
                    <span className="text-[10px] text-[#615d59]">
                        {readOnly ? `歷史 · ${postCount} 個項目` : `${postCount} 個項目`}
                    </span>
                </div>
            )}

            {/* Context Menu using React Portal to escape z-index stacking context completely */}
            {!readOnly && isMenuOpen && createPortal(
                <>
                    <div
                        className="fixed inset-0 z-[9999]"
                        onClick={(e) => { e.stopPropagation(); onMenuToggle(); }}
                    />
                    <div 
                        className="fixed bg-surface-raised border notion-whisper-border rounded-[0.75rem] shadow-deep z-[10000] w-36 py-1 overflow-hidden"
                        style={{ top: menuPos.top, left: menuPos.left }}
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(true);
                                if (onMenuToggle) onMenuToggle();
                            }}
                            className="w-full px-4 py-2.5 text-left text-xs text-[rgba(0,0,0,0.95)] hover:bg-black/5 flex items-center gap-2 transition-colors"
                        >
                            <Edit2 size={14} /> 重新命名
                        </button>
                        <button
                            onClick={(e) => {
                                handleDelete(e);
                                if (onMenuToggle) onMenuToggle();
                            }}
                            className="w-full px-4 py-2.5 text-left text-xs text-destructive hover:bg-destructive/5 flex items-center gap-2 transition-colors"
                        >
                            <Trash2 size={14} /> 刪除
                        </button>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};

export default CollectionFolder;
