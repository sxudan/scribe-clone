// Document list component
import React from 'react';
import { Document } from '../supabase/types';

interface DocumentListProps {
  documents: Document[];
  onSelectDocument: (document: Document) => void;
  onCreateNew: () => void;
  onDeleteDocument: (documentId: string) => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  onSelectDocument,
  onCreateNew,
  onDeleteDocument,
}) => {
  return (
    <div className="p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">My Documents</h2>
        <button
          onClick={onCreateNew}
          className="px-4 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
        >
          + New Document
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No documents yet. Create your first document!</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-400 cursor-pointer transition-colors"
              onClick={() => onSelectDocument(doc)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-800 mb-1">{doc.title}</h3>
                  {doc.description && (
                    <p className="text-sm text-gray-600 mb-2">{doc.description}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this document?')) {
                      onDeleteDocument(doc.id);
                    }
                  }}
                  className="ml-2 px-2 py-1 text-red-500 hover:bg-red-50 rounded text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

