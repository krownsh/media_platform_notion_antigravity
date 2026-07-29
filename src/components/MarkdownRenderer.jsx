// Rebuild after installing react-markdown
import React from 'react';
import ReactMarkdown from 'react-markdown';

const MarkdownRenderer = ({ content }) => {
    return (
        <div className="markdown-content">
            <ReactMarkdown
                components={{
                    h1: ({ node: _node, ...props }) => <h1 className="text-xl font-bold my-4" {...props} />,
                    h2: ({ node: _node, ...props }) => <h2 className="text-lg font-bold my-3" {...props} />,
                    h3: ({ node: _node, ...props }) => <h3 className="text-base font-bold my-2" {...props} />,
                    p: ({ node: _node, ...props }) => <p className="my-2 leading-relaxed" {...props} />,
                    ul: ({ node: _node, ...props }) => <ul className="list-disc list-inside my-2" {...props} />,
                    ol: ({ node: _node, ...props }) => <ol className="list-decimal list-inside my-2" {...props} />,
                    li: ({ node: _node, ...props }) => <li className="my-1" {...props} />,
                    blockquote: ({ node: _node, ...props }) => <blockquote className="border-l-4 border-gray-300 pl-4 italic my-4" {...props} />,
                    code: ({ node: _node, inline, className, children, ...props }) => {
                        return !inline ? (
                            <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto my-4 text-sm">
                                <code className={className} {...props}>
                                    {children}
                                </code>
                            </pre>
                        ) : (
                            <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono" {...props}>
                                {children}
                            </code>
                        )
                    }
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};

export default MarkdownRenderer;
