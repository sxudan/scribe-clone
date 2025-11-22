// Type definitions for the extension

export type ActionType = 'click' | 'input' | 'change' | 'submit' | 'navigation' | 'page_load';

export type ExportFormat = 'text' | 'markdown' | 'html';

export interface ElementInfo {
  // Basic identification
  tag: string;
  id: string | null;
  className: string | null;
  name: string | null;
  type: string | null;
  text: string | null;
  placeholder: string | null;
  label: string | null;
  selector: string;
  
  // Position and dimensions for visualization
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    left: number;
    right: number;
    bottom: number;
  } | null;
  
  // Scroll position when element was interacted with
  scrollPosition: {
    x: number;
    y: number;
  };
  
  // Viewport dimensions
  viewport: {
    width: number;
    height: number;
  };
  
  // Additional attributes for better element identification
  attributes: Record<string, string>;
  
  // Parent element info (for context)
  parentSelector: string | null;
  
  // Element position in DOM tree
  xpath: string | null;
}

export interface StepData {
  element?: ElementInfo;
  // Click coordinates (always captured for clicks)
  coordinates: {
    x: number;
    y: number;
    // Relative to element
    relativeX?: number;
    relativeY?: number;
    // Relative to viewport
    viewportX: number;
    viewportY: number;
  } | null;
  value?: string | boolean;
  url?: string;
  title?: string;
  // Page metadata
  pageMetadata?: {
    viewportWidth: number;
    viewportHeight: number;
    scrollX: number;
    scrollY: number;
    userAgent: string;
  };
}

export interface Step {
  id: number;
  action: ActionType;
  data: StepData;
  timestamp: number;
  url: string;
  title: string;
  screenshot?: string;
}

export interface StorageData {
  isRecording?: boolean;
  steps?: Step[];
  startTime?: number;
  recordingTabId?: number;
}

export interface Message {
  action: string;
  steps?: Step[];
  format?: ExportFormat;
  step?: Step;
  screenshot?: string;
}

export interface MessageResponse {
  success?: boolean;
  content?: string;
  error?: string;
  screenshot?: string | null;
  steps?: Step[];
  tabId?: number | null;
}

