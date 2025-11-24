import React, { useState } from 'react';
import { Folder } from 'lucide-react';

const CollectionCard = ({ collection, onClick, onRename }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(collection.name);

    const handleRename = (e) => {
        e.preventDefault();
        if (name.trim()) {
            onRename(collection.id, name);
        }
        setIsEditing(false);
    };

    return (
        <div
            className="glass-card rounded-2xl overflow-hidden hover:border-white/20 transition-all duration-300 group relative h-full flex flex-col cursor-pointer"
            onClick={onClick}
        >
            {/* Header / Preview Area */}
            <div className="aspect-[4/5] bg-white/5 p-4 grid grid-cols-2 gap-2 relative">
                {/* Show first 4 items as preview */}
                {collection.items.slice(0, 4).map((item, idx) => (
                    <div key={idx} className="bg-gray-900/50 rounded-lg overflow-hidden relative border border-white/5">
                        {/* Simplified preview */}
                        {item.image ? (
                            <img src={item.image} alt="" className="w-full h-full object-cover opacity-70" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 p-1 break-all">
                                {item.platform || 'Post'}
                            </div>
                        )}
                    </div>
                ))}

                {/* Folder Icon Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Folder size={48} className="text-white/10" />
                </div>
            </div>

            {/* Footer / Name */}
            <div className="p-4 bg-black/40 border-t border-white/5 mt-auto">
                {isEditing ? (
                    <form
                        onSubmit={handleRename}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-transparent border-b border-white/20 text-white w-full focus:outline-none pb-1"
                            autoFocus
                            onBlur={handleRename}
                        />
                    </form>
                ) : (
                    <div className="flex items-center justify-between group/title">
                        <h3 className="font-medium text-white truncate pr-2">{collection.name}</h3>
                        <button
                            className="text-xs text-gray-400 hover:text-white opacity-0 group-hover/title:opacity-100 transition-opacity"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(true);
                            }}
                        >
                            Rename
                        </button>
                    </div>
                )}
                <p className="text-xs text-gray-500 mt-1">{collection.items.length} items</p>
            </div>
        </div>
    );
};

export default CollectionCard;
