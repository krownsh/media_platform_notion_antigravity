import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import PostCard from './PostCard';
import CollectionCard from './CollectionCard';

const SortablePostCard = ({ post, onRemix, onClick, onDelete, onRename }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: post.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            {post.type === 'collection' ? (
                <CollectionCard
                    collection={post}
                    onClick={onClick}
                    onRename={onRename}
                />
            ) : (
                <PostCard
                    post={post}
                    onRemix={onRemix}
                    onClick={onClick}
                    onDelete={onDelete}
                />
            )}
        </div>
    );
};

export default SortablePostCard;
