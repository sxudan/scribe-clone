// Recording state management
import { Step } from '../types';

export interface RecordingState {
  isRecording: boolean;
  steps: Step[];
  stepCounter: number;
  lastClickTime: number;
  lastClickTarget: HTMLElement | null;
  lastClickCoordinates: { x: number; y: number } | null;
  currentUrl: string;
  lastActionTime: number;
  lastActionType: string | null;
  capturedPageLoads: Set<string>;
  clickCausedNavigation: boolean;
  recordingTabId: number | null;
  currentTabId: number | null;
}

let state: RecordingState = {
  isRecording: false,
  steps: [],
  stepCounter: 0,
  lastClickTime: 0,
  lastClickTarget: null,
  lastClickCoordinates: null,
  currentUrl: window.location.href,
  lastActionTime: 0,
  lastActionType: null,
  capturedPageLoads: new Set<string>(),
  clickCausedNavigation: false,
  recordingTabId: null,
  currentTabId: null,
};

export function getState(): RecordingState {
  return state;
}

export function updateState(updates: Partial<RecordingState>): void {
  state = { ...state, ...updates };
}

export function resetState(): void {
  state = {
    isRecording: false,
    steps: [],
    stepCounter: 0,
    lastClickTime: 0,
    lastClickTarget: null,
    lastClickCoordinates: null,
    currentUrl: window.location.href,
    lastActionTime: 0,
    lastActionType: null,
    capturedPageLoads: new Set<string>(),
    clickCausedNavigation: false,
    recordingTabId: state.recordingTabId, // Keep tab ID
    currentTabId: state.currentTabId, // Keep current tab ID
  };
}

export function isRecordingTab(): boolean {
  const { recordingTabId, currentTabId } = state;
  if (recordingTabId === null || currentTabId === null) {
    return true; // If not set, assume it's the recording tab
  }
  return recordingTabId === currentTabId;
}

export async function checkRecordingTab(): Promise<boolean> {
  const { recordingTabId, currentTabId } = state;
  
  // Check from storage if currentTabId wasn't set yet
  if (recordingTabId !== null && currentTabId === null) {
    const storage = await chrome.storage.local.get(['recordingTabId']);
    if (storage.recordingTabId && state.currentTabId) {
      return storage.recordingTabId === state.currentTabId;
    }
  }
  
  return isRecordingTab();
}

