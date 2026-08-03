import React from 'react';
import { getAuthorColorIndex, getAuthorInitial } from '../utils/authorInitial';

const AVATAR_PALETTE = [
    'bg-blue-100 text-blue-800 border-blue-200',
    'bg-emerald-100 text-emerald-800 border-emerald-200',
    'bg-amber-100 text-amber-800 border-amber-200',
    'bg-violet-100 text-violet-800 border-violet-200',
    'bg-rose-100 text-rose-800 border-rose-200',
    'bg-slate-100 text-slate-700 border-slate-200'
];

const SIZE_CLASSES = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm'
};

const AuthorInitialAvatar = ({ name, size = 'md', className = '' }) => {
    const label = typeof name === 'string' && name.trim() ? name.trim() : 'Unknown';
    const color = AVATAR_PALETTE[getAuthorColorIndex(label, AVATAR_PALETTE.length)];

    return (
        <div
            className={`${SIZE_CLASSES[size] || SIZE_CLASSES.md} ${color} ${className} flex flex-shrink-0 items-center justify-center rounded-full border font-bold select-none`}
            role="img"
            aria-label={`${label} 的文字頭像`}
            title={label}
        >
            {getAuthorInitial(label)}
        </div>
    );
};

export default AuthorInitialAvatar;
