// Popup UI controller with React
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { StorageData, Step, ExportFormat, Message, MessageResponse } from './types';
import './popup.css';

const App: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  // Check current recording state
  const updateUI = async (): Promise<void> => {
    const result = await chrome.storage.local.get(['isRecording', 'steps']) as { isRecording?: boolean; steps?: Step[] };
    setIsRecording(result.isRecording || false);
    setSteps(result.steps || []);
  };

  // Listen for step updates
  useEffect(() => {
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
  }, []);

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
          // Wait a bit for script to initialize
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          alert('Cannot record on this page. Please navigate to a web page.');
          return;
        }
      }
      
      await chrome.storage.local.set({ 
        isRecording: true, 
        steps: [],
        startTime: Date.now()
      } as StorageData);
      
      // Send message to content script to start recording
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
      
      // Send message to content script to stop recording
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

  // Export guide
  const handleExport = async (format: ExportFormat) => {
    setIsLoading(true);
    setShowExportOptions(false);
    
    try {
      const result = await chrome.storage.local.get(['steps']) as { steps?: Step[] };
      const { steps: currentSteps } = result;
      
      if (!currentSteps || currentSteps.length === 0) {
        alert('No steps to export');
        setIsLoading(false);
        return;
      }
      
      // Send to background script for processing
      chrome.runtime.sendMessage({ 
        action: 'generateDocumentation', 
        steps: currentSteps, 
        format 
      } as Message, (response: MessageResponse) => {
        setIsLoading(false);
        
        if (response.success && response.content) {
          // Download the file
          const blob = new Blob([response.content], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const extension = format === 'html' ? 'html' : format === 'markdown' ? 'md' : 'txt';
          a.download = `documentation.${extension}`;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          alert('Error generating documentation: ' + (response.error || 'Unknown error'));
        }
      });
    } catch (error) {
      setIsLoading(false);
      const err = error as Error;
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="w-full max-w-md min-w-[320px] min-h-[400px] bg-gray-100 font-sans">
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
          <button
            onClick={() => setShowExportOptions(!showExportOptions)}
            disabled={steps.length === 0}
            className="flex-1 px-5 py-3 rounded-md text-sm font-medium text-gray-800 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Export Guide
          </button>
        </div>
        
        {/* Export Options */}
        {showExportOptions && (
          <div className="p-4 mb-5 bg-white rounded-lg shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Export Format</h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleExport('text')}
                className="px-4 py-2.5 rounded-md text-sm text-gray-800 bg-white border border-gray-300 hover:bg-gray-50 hover:border-blue-500 hover:text-blue-500 transition-colors"
              >
                Plain Text
              </button>
              <button
                onClick={() => handleExport('markdown')}
                className="px-4 py-2.5 rounded-md text-sm text-gray-800 bg-white border border-gray-300 hover:bg-gray-50 hover:border-blue-500 hover:text-blue-500 transition-colors"
              >
                Markdown
              </button>
              <button
                onClick={() => handleExport('html')}
                className="px-4 py-2.5 rounded-md text-sm text-gray-800 bg-white border border-gray-300 hover:bg-gray-50 hover:border-blue-500 hover:text-blue-500 transition-colors"
              >
                HTML
              </button>
            </div>
          </div>
        )}
        
        {/* Loading */}
        {isLoading && (
          <div className="text-center py-5">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-600">Generating documentation...</p>
          </div>
        )}
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

