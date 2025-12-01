import React, { useState, useRef, useEffect, useCallback } from 'react';
import { twMerge } from 'tailwind-merge';

const RichMentionEditor = ({ value, onChange, variables, placeholder, minHeight = '150px', className }) => {
    const editorRef = useRef(null);
    const [showMenu, setShowMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const [filterText, setFilterText] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Convert template text {{VAR}} to HTML with badges
    const textToHtml = useCallback((text) => {
        if (!text) return '';
        let html = text;
        // Escape HTML first to prevent XSS if text contains user input
        html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        variables.forEach(v => {
            // Create a regex to replace all occurrences of the variable
            // We use a special data attribute to store the variable name
            const regex = new RegExp(v.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            const badge = `<span class="mention-badge" contenteditable="false" data-variable="${v.value}">@${v.label}</span>`;
            html = html.replace(regex, badge);
        });
        return html;
    }, [variables]);

    // Convert HTML back to template text
    const htmlToText = (html) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // Replace badges with their variable values
        const badges = tempDiv.querySelectorAll('.mention-badge');
        badges.forEach(badge => {
            const variable = badge.getAttribute('data-variable');
            badge.replaceWith(variable);
        });

        // Get text content (this handles encoded entities and line breaks)
        // Note: innerText preserves newlines better than textContent in some browsers for contentEditable
        return tempDiv.innerText;
    };

    // Initialize content
    useEffect(() => {
        if (editorRef.current && value !== htmlToText(editorRef.current.innerHTML)) {
            // Only update if significantly different to avoid cursor jumping
            // This is a naive check; for a production editor, we'd need more robust cursor management.
            // But since we only set value externally on load or reset, this might be okay.
            if (editorRef.current.innerText.trim() === '' && value) {
                editorRef.current.innerHTML = textToHtml(value);
            }
        }
    }, [value, textToHtml]);

    const handleInput = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const text = editorRef.current.innerText;

        // Check for @ trigger
        // We need to find the text node and offset
        const node = range.startContainer;
        const offset = range.startOffset;

        if (node.nodeType === Node.TEXT_NODE) {
            const textBefore = node.textContent.slice(0, offset);
            const match = textBefore.match(/@(\w*)$/);

            if (match) {
                const query = match[1];
                setFilterText(query);
                setShowMenu(true);

                // Calculate position
                const rect = range.getBoundingClientRect();
                const editorRect = editorRef.current.getBoundingClientRect();

                setMenuPosition({
                    top: rect.bottom - editorRect.top + 5,
                    left: rect.left - editorRect.left
                });
                setSelectedIndex(0);
            } else {
                setShowMenu(false);
            }
        } else {
            setShowMenu(false);
        }

        // Propagate change
        const newText = htmlToText(editorRef.current.innerHTML);
        if (newText !== value) {
            onChange(newText);
        }
    };

    const insertVariable = (variable) => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const node = range.startContainer;

        if (node.nodeType === Node.TEXT_NODE) {
            const textBefore = node.textContent.slice(0, range.startOffset);
            const match = textBefore.match(/@(\w*)$/);

            if (match) {
                // Delete the @query part
                range.setStart(node, range.startOffset - match[0].length);
                range.deleteContents();

                // Insert the badge
                const span = document.createElement('span');
                span.className = 'mention-badge';
                span.contentEditable = 'false';
                span.setAttribute('data-variable', variable.value);
                span.innerText = `@${variable.label}`;

                range.insertNode(span);

                // Add a space after
                const space = document.createTextNode('\u00A0');
                range.collapse(false);
                range.insertNode(space);

                // Move cursor after space
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);

                setShowMenu(false);

                // Trigger change
                onChange(htmlToText(editorRef.current.innerHTML));
            }
        }
    };

    const handleKeyDown = (e) => {
        if (showMenu) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % filteredVariables.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredVariables.length) % filteredVariables.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                if (filteredVariables.length > 0) {
                    insertVariable(filteredVariables[selectedIndex]);
                }
            } else if (e.key === 'Escape') {
                setShowMenu(false);
            }
        }
    };

    const filteredVariables = variables.filter(v =>
        v.label.toLowerCase().includes(filterText.toLowerCase())
    );

    return (
        <div className="relative w-full">
            <style>{`
                .mention-badge {
                    background-color: #e0f2fe; /* light blue */
                    color: #0284c7; /* dark blue */
                    padding: 2px 6px;
                    border-radius: 9999px;
                    font-weight: 500;
                    font-size: 0.9em;
                    margin: 0 2px;
                    display: inline-block;
                    user-select: none;
                    border: 1px solid #bae6fd;
                }
                .dark .mention-badge {
                    background-color: #0c4a6e;
                    color: #7dd3fc;
                    border-color: #075985;
                }
                .rich-editor:empty:before {
                    content: attr(placeholder);
                    color: #9ca3af;
                    pointer-events: none;
                }
            `}</style>
            <div
                ref={editorRef}
                contentEditable
                className={twMerge(
                    "rich-editor w-full bg-white/50 border border-white/20 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 overflow-y-auto font-mono whitespace-pre-wrap",
                    className
                )}
                style={{ minHeight: minHeight }}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
            />

            {showMenu && filteredVariables.length > 0 && (
                <div
                    className="absolute z-50 bg-background border border-border rounded-lg shadow-lg overflow-hidden min-w-[150px]"
                    style={{ top: menuPosition.top, left: menuPosition.left }}
                >
                    {filteredVariables.map((v, i) => (
                        <div
                            key={v.value}
                            className={`px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground ${i === selectedIndex ? 'bg-accent text-accent-foreground' : ''}`}
                            onClick={() => insertVariable(v)}
                        >
                            {v.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RichMentionEditor;
