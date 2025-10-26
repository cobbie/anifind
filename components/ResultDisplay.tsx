
import React from 'react';
// Note: This component uses react-markdown and remark-gfm.
// In a real project, you would install them:
// npm install react-markdown remark-gfm
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ResultDisplayProps {
  result: string;
  isLoading: boolean;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ result, isLoading }) => {
  if (isLoading) {
    return (
      <div className="w-full bg-gray-800 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-3/4 mb-4"></div>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-4">
            <div className="h-4 bg-gray-700 rounded col-span-1"></div>
            <div className="h-4 bg-gray-700 rounded col-span-2"></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-4 bg-gray-700 rounded col-span-1"></div>
            <div className="h-4 bg-gray-700 rounded col-span-2"></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-4 bg-gray-700 rounded col-span-1"></div>
            <div className="h-4 bg-gray-700 rounded col-span-2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="prose prose-invert prose-table:border prose-table:border-gray-600 prose-th:bg-gray-700/50 prose-th:p-3 prose-td:p-3 max-w-none bg-gray-900/50 p-6 rounded-xl border border-gray-700">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {result}
      </ReactMarkdown>
    </div>
  );
};
