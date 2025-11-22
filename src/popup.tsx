// Popup UI controller with React and Supabase integration
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { StorageData, Step, Message } from './types';
import { authService } from './supabase/auth';
import { documentService } from './supabase/documents';
import { stepService } from './supabase/steps';
import { Document } from './supabase/types';
import { Auth } from './components/Auth';
import { DocumentList } from './components/DocumentList';
import { generateAndDownloadDocx } from './utils/generate-docx';
import './popup.css';

type View = 'auth' | 'documents' | 'recording' | 'saving';

const App: React.FC = () => {
  const [view, setView] = useState<View>('auth');
  const [user, setUser] = useState<any>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [savingDocument, setSavingDocument] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  // Check auth state on mount
  useEffect(() => {
    checkAuth();
    
    // Listen for auth changes
    const { data: { subscription } } = authService.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        setView('documents');
        loadDocuments(session.user.id);
      } else {
        setUser(null);
        setView('auth');
        setDocuments([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Check current recording state
  const updateUI = async (): Promise<void> => {
    const result = await chrome.storage.local.get(['isRecording', 'steps']) as { isRecording?: boolean; steps?: Step[] };
    setIsRecording(result.isRecording || false);
    setSteps(result.steps || []);
  };

  // Listen for step updates
  useEffect(() => {
    if (view === 'recording') {
      updateUI();
      
      const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        if (areaName === 'local' && (changes.steps || changes.isRecording)) {
          updateUI();
        }
      };
      
      chrome.storage.onChanged.addListener(listener);
      
      return () => {
        chrome.storage.onChanged.removeListener(listener);
      };
    }
    return undefined;
  }, [view]);

  const checkAuth = async () => {
    const { user } = await authService.getCurrentUser();
    if (user) {
      setUser(user);
      setView('documents');
      loadDocuments(user.id);
    } else {
      setView('auth');
    }
  };

  const loadDocuments = async (userId: string) => {
    const { data, error } = await documentService.getDocuments(userId);
    if (error) {
      console.error('Error loading documents:', error);
    } else {
      setDocuments(data || []);
    }
  };

  const handleAuthSuccess = async () => {
    const { user } = await authService.getCurrentUser();
    if (user) {
      setUser(user);
      setView('documents');
      loadDocuments(user.id);
    }
  };

  const handleSignOut = async () => {
    await authService.signOut();
    setUser(null);
    setView('auth');
    setDocuments([]);
    setCurrentDocument(null);
  };

  const handleCreateNewDocument = async () => {
    // Stop any ongoing recording first
    if (isRecording) {
      chrome.runtime.sendMessage({ action: 'stopRecording' } as Message);
    }
    
    // Clear current document
    setCurrentDocument(null);
    
    // Clear steps from state
    setSteps([]);
    
    // Clear steps from chrome storage
    await chrome.storage.local.set({ 
      steps: [], 
      isRecording: false,
      startTime: undefined,
      recordingTabId: undefined
    } as StorageData);
    
    // Update UI state
    setIsRecording(false);
    
    // Switch to recording view
    setView('recording');
  };

  const handleSelectDocument = async (document: Document) => {
    setCurrentDocument(document);
    const { data, error } = await documentService.getDocumentWithSteps(document.id);
    if (error) {
      alert('Error loading document: ' + error.message);
      return;
    }
    if (data) {
      setSteps(data.steps);
      setView('recording');
    } else {
      setSteps([]);
      setView('recording');
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    const { error } = await documentService.deleteDocument(documentId);
    if (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert('Error deleting document: ' + errorMessage);
    } else {
      if (user) {
        loadDocuments(user.id);
      }
      if (currentDocument?.id === documentId) {
        setCurrentDocument(null);
        setSteps([]);
        setView('documents');
      }
    }
  };

  const handleSaveToSupabase = async () => {
    if (!user || steps.length === 0) return;

    setSavingDocument(true);
    setShowSaveOptions(false);
    try {
      let docId = currentDocument?.id;

      // Create document if it doesn't exist
      if (!docId) {
        const title = prompt('Enter document title:', `Document ${new Date().toLocaleDateString()}`);
        if (!title) {
          setSavingDocument(false);
          return;
        }

        const { data: newDoc, error: createError } = await documentService.createDocument(
          user.id,
          title
        );

        if (createError || !newDoc) {
          alert('Error creating document: ' + (createError?.message || 'Unknown error'));
          setSavingDocument(false);
          return;
        }

        docId = newDoc.id;
        setCurrentDocument(newDoc);
      }

      // Save steps with screenshots
      if (!docId) {
        alert('Error: Document ID is missing');
        setSavingDocument(false);
        return;
      }
      
      // Log steps before saving
      console.log('Saving steps:', {
        documentId: docId,
        stepCount: steps.length,
        stepsWithScreenshots: steps.filter(s => s.screenshot).length,
        steps: steps.map(s => ({
          id: s.id,
          action: s.action,
          hasScreenshot: !!s.screenshot,
          screenshotLength: s.screenshot?.length || 0
        }))
      });
      
      const { error: stepsError } = await stepService.saveSteps(docId, steps);
      if (stepsError) {
        console.error('Error saving steps:', stepsError);
        alert('Error saving steps: ' + stepsError.message);
      } else {
        console.log('Steps saved successfully');
        alert('Document saved successfully!');
        if (user) {
          loadDocuments(user.id);
        }
        setView('documents');
      }
    } catch (error) {
      console.error('Error saving document:', error);
      alert('Error saving document');
    } finally {
      setSavingDocument(false);
    }
  };

  // Start recording
  const handleStartRecording = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) {
        alert('No active tab found');
        return;
      }
      
      // Ensure content script is injected
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'ping' } as Message);
      } catch (error) {
        // Content script not loaded, inject it
        if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          alert('Cannot record on this page. Please navigate to a web page.');
          return;
        }
      }
      
      await chrome.storage.local.set({ 
        isRecording: true, 
        steps: [],
        startTime: Date.now(),
        recordingTabId: tab.id
      } as StorageData);
      
      await chrome.tabs.sendMessage(tab.id, { action: 'startRecording' } as Message);
      if (chrome.runtime.lastError) {
        console.error('Error sending message:', chrome.runtime.lastError);
        alert('Failed to start recording: ' + chrome.runtime.lastError.message);
        await chrome.storage.local.set({ isRecording: false } as StorageData);
        return;
      }
      
      await updateUI();
    } catch (error) {
      console.error('Error starting recording:', error);
      const err = error as Error;
      alert('Error starting recording: ' + err.message);
      await chrome.storage.local.set({ isRecording: false } as StorageData);
      await updateUI();
    }
  };

  // Stop recording
  const handleStopRecording = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) return;
      
      await chrome.storage.local.set({ isRecording: false } as StorageData);
      
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'stopRecording' } as Message);
      } catch (error) {
        console.error('Error sending stop message:', error);
      }
      
      await updateUI();
    } catch (error) {
      console.error('Error stopping recording:', error);
      await updateUI();
    }
  };

  // Clear steps
  const handleClearSteps = async () => {
    await chrome.storage.local.set({ steps: [] } as StorageData);
    await updateUI();
  };


  // Export as .docx
  const handleExportDocx = async () => {
    if (steps.length === 0) {
      alert('No steps to export');
      return;
    }

    setIsExportingDocx(true);
    setShowSaveOptions(false);
    
    try {
      const title = currentDocument?.title || `Documentation_${new Date().toISOString().split('T')[0]}`;
      await generateAndDownloadDocx(steps, title);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export document: ' + ((error as Error).message || 'Unknown error'));
    } finally {
      setIsExportingDocx(false);
    }
  };

  // Render based on view
  if (view === 'auth') {
    return (
      <div className="w-full max-w-md min-w-[320px] min-h-[400px] bg-gray-100 font-sans">
        <Auth onAuthSuccess={handleAuthSuccess} />
      </div>
    );
  }

  if (view === 'documents') {
    return (
      <div className="w-full max-w-md min-w-[320px] min-h-[400px] bg-gray-100 font-sans">
        <div className="p-3 bg-white border-b border-gray-200 flex justify-between items-center">
          <span className="text-sm text-gray-600">{user?.email}</span>
          <button
            onClick={handleSignOut}
            className="text-sm text-red-500 hover:text-red-600"
          >
            Sign Out
          </button>
        </div>
        <DocumentList
          documents={documents}
          onSelectDocument={handleSelectDocument}
          onCreateNew={handleCreateNewDocument}
          onDeleteDocument={handleDeleteDocument}
        />
      </div>
    );
  }

  // Recording view
  return (
    <div className="w-full max-w-md min-w-[320px] min-h-[400px] bg-gray-100 font-sans">
      <div className="p-3 bg-white border-b border-gray-200 flex justify-between items-center">
        <button
          onClick={() => setView('documents')}
          className="text-sm text-blue-500 hover:text-blue-600"
        >
          ← Back to Documents
        </button>
        {currentDocument && (
          <span className="text-sm text-gray-600 truncate max-w-[200px]">{currentDocument.title ?? 'Untitled'}</span>
        )}
      </div>

      <div className="p-5">
        {/* Header */}
        <div className="mb-5 text-center">
          <h1 className="text-xl font-semibold text-gray-800">Documentation Tool</h1>
        </div>
        
        {/* Status Section */}
        <div className="flex items-center justify-center gap-2.5 mb-5 p-3 bg-white rounded-lg shadow-sm">
          <div
            className={`w-3 h-3 rounded-full ${
              isRecording
                ? 'bg-red-500 animate-pulse'
                : 'bg-gray-500'
            }`}
          />
          <span className="text-sm font-medium text-gray-800">
            {isRecording ? 'Recording' : 'Not Recording'}
          </span>
          {isRecording && (
            <span className="text-xs text-gray-500 ml-2">📷 Screenshots enabled</span>
          )}
        </div>
        
        {/* Controls */}
        <div className="flex gap-2.5 mb-5">
          <button
            onClick={handleStartRecording}
            disabled={isRecording}
            className="flex-1 px-5 py-3 rounded-md text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Start Recording
          </button>
          <button
            onClick={handleStopRecording}
            disabled={!isRecording}
            className="flex-1 px-5 py-3 rounded-md text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Stop Recording
          </button>
        </div>
        
        {/* Stats Section */}
        <div className="mb-5 p-3 bg-white rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Steps:</span>
            <span className="text-base font-semibold text-gray-800">{steps.length}</span>
          </div>
          {steps.length > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Screenshots:</span>
              <span className="text-base font-semibold text-gray-800">
                {steps.filter(s => s.screenshot).length} / {steps.length}
              </span>
            </div>
          )}
        </div>

        {/* Save Button */}
        {steps.length > 0 && (
          <div className="mb-5">
            <button
              onClick={() => setShowSaveOptions(!showSaveOptions)}
              disabled={savingDocument || isExportingDocx}
              className="w-full px-5 py-3 rounded-md text-sm font-medium text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {savingDocument ? 'Saving...' : isExportingDocx ? 'Generating...' : 'Save Document'}
            </button>
          </div>
        )}
        
        {/* Save Options */}
        {showSaveOptions && (
          <div className="p-4 mb-5 bg-white rounded-lg shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Save Options</h3>
            <div className="flex flex-col gap-2">
              {user && (
                <button
                  onClick={handleSaveToSupabase}
                  disabled={savingDocument}
                  className="px-4 py-2.5 rounded-md text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {savingDocument ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      💾 Save
                    </>
                  )}
                </button>
              )}
              <button
                onClick={handleExportDocx}
                disabled={isExportingDocx}
                className="px-4 py-2.5 rounded-md text-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isExportingDocx ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    📄 Export as Word Document (.docx)
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Steps List */}
        {steps.length > 0 && (
          <div className="mb-5 max-h-64 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-800 mb-2 sticky top-0 bg-gray-100 py-1">
              Recorded Steps
            </h3>
            <div className="space-y-2">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className="p-3 bg-white rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:border-blue-400 transition-colors"
                  onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        #{step.id}
                      </span>
                      <span className="text-sm font-medium text-gray-800 capitalize">
                        {step.action.replace('_', ' ')}
                      </span>
                      {step.screenshot && (
                        <span className="text-xs text-green-600">📷</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(step.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  {expandedStep === step.id && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      {step.screenshot && (
                        <div className="mb-2">
                          <img
                            src={step.screenshot}
                            alt={`Step ${step.id} screenshot`}
                            className="w-full rounded border border-gray-300 max-h-48 object-contain bg-gray-50"
                          />
                        </div>
                      )}
                      <div className="text-xs text-gray-600 space-y-1">
                        {step.data.element && (
                          <div>
                            <span className="font-medium">Element:</span>{' '}
                            {step.data.element.label || step.data.element.text || step.data.element.selector}
                          </div>
                        )}
                        {step.data.value !== undefined && (
                          <div>
                            <span className="font-medium">Value:</span> {String(step.data.value)}
                          </div>
                        )}
                        {step.url && (
                          <div className="truncate">
                            <span className="font-medium">URL:</span> {step.url}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Actions Section */}
        <div className="flex gap-2.5 mb-5">
          <button
            onClick={handleClearSteps}
            className="flex-1 px-5 py-3 rounded-md text-sm font-medium text-gray-800 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors"
          >
            Clear Steps
          </button>
        </div>
        
      </div>
    </div>
  );
};

// Initialize React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
