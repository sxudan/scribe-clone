// Type definitions for the extension

export type ActionType = 'click' | 'input' | 'change' | 'submit' | 'navigation' | 'page_load';

export type ExportFormat = 'text' | 'markdown' | 'html';

export interface ElementInfo {
  tag: string;
  id: string | null;
  className: string | null;
  name: string | null;
  type: string | null;
  text: string | null;
  placeholder: string | null;
  label: string | null;
  selector: string;
}

export interface StepData {
  element?: ElementInfo;
  coordinates?: { x: number; y: number };
  value?: string | boolean;
  url?: string;
  title?: string;
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
}

