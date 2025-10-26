
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type GroundingChunk = {
  web?: {
    uri: string;
    title: string;
  };
};

interface ResultDisplayProps {
  result: string;
  isLoading: boolean;
  sources?: GroundingChunk[];
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ result, isLoading, sources }) => {
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

  const validSources = sources?.filter(s => s.web?.uri && s.web?.title) ?? [];

  return (
    <>
      <div className="prose prose-invert prose-table:border prose-table:border-gray-600 prose-th:bg-gray-700/50 prose-th:p-3 prose-td:p-3 max-w-none bg-gray-900/50 p-6 rounded-xl border border-gray-700">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {result}
        </ReactMarkdown>
      </div>
      {validSources.length > 0 && (
        <div className="mt-6">
          <h4 className="text-lg font-semibold text-gray-300 mb-3">Sources:</h4>
          <ul className="space-y-2">
            {validSources.map((source, index) => (
              <li key={index} className="text-gray-400 truncate">
                <a
                  href={source.web!.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 hover:underline"
                  title={source.web!.title}
                >
                  {source.web!.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
};
