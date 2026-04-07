import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import PostCard from './PostCard';

const SortablePostCard = ({
    post,
    onRemix,
    onClick,
    onDelete,
    isOverlay = false
}) => {
    console.log('Rendering SortablePostCard:', post.id);
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
        opacity: isDragging ? 0.45 : 1,
    };

    if (isOverlay) {
        return (
            <div className="relative">
                <PostCard
                    post={post}
                    onRemix={onRemix}
                    onClick={onClick}
                    onDelete={onDelete}
                />
            </div>
        );
    }

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative">
            <PostCard
                post={post}
                onRemix={onRemix}
                onClick={onClick}
                onDelete={onDelete}
            />
        </div>
    );
};

export default SortablePostCard;
