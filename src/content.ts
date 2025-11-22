// Content script entry point - orchestrates recording
import { Message, MessageResponse, StorageData } from "./types";
import { getState, updateState } from "./recording/state";
import {
  startRecording,
  stopRecording,
} from "./recording/recording-controller";

// Initialize tab ID
let currentTabId: number | null = null;
chrome.runtime.sendMessage(
  { action: "getCurrentTabId" } as Message,
  (response: any) => {
    if (response && typeof response.tabId === "number") {
      currentTabId = response.tabId;
      updateState({ currentTabId });
    }
  }
);

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener(
  (
    message: Message,
    sender,
    sendResponse: (response: MessageResponse) => void
  ): boolean => {
    if (message.action === "ping") {
      sendResponse({ success: true });
    } else if (message.action === "startRecording") {
      // Store the tab ID when recording starts
      if (sender.tab?.id) {
        updateState({ recordingTabId: sender.tab.id });
        chrome.storage.local.set({ recordingTabId: sender.tab.id });
      }
      startRecording();
      sendResponse({ success: true });
    } else if (message.action === "stopRecording") {
      stopRecording();
      sendResponse({ success: true });
    } else if (message.action === "getSteps") {
      const state = getState();
      sendResponse({ steps: state.steps });
    }
    return true;
  }
);

// Check recording state on load
chrome.storage.local.get(
  [
    "isRecording",
    "steps",
    "clickCausedNavigation",
    "navigationClickTime",
    "recordingTabId",
  ],
  async (
    result: StorageData & {
      clickCausedNavigation?: boolean;
      navigationClickTime?: number;
    }
  ) => {
    // Get current tab ID if not already set
    if (currentTabId === null) {
      try {
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (tabs[0]?.id) {
          currentTabId = tabs[0].id;
          updateState({ currentTabId });
        }
      } catch (error) {
        console.error("Error getting current tab ID:", error);
      }
    }

    // Only proceed if this is the recording tab
    if (
      result.recordingTabId &&
      currentTabId &&
      result.recordingTabId !== currentTabId
    ) {
      console.log("Not the recording tab, ignoring events", {
        recordingTabId: result.recordingTabId,
        currentTabId,
      });
      return;
    }

    if (result.isRecording) {
      // Store recording tab ID
      if (result.recordingTabId) {
        updateState({ recordingTabId: result.recordingTabId });
      }

      // Check if this page load was caused by a click
      const now = Date.now();
      const navigationTime = result.navigationClickTime || 0;
      const wasClickNavigation =
        result.clickCausedNavigation &&
        navigationTime > 0 &&
        now - navigationTime < 5000;

      if (wasClickNavigation) {
        // Skip page_load if it was caused by a click navigation
        console.log("Skipping page_load - caused by click navigation", {
          clickTime: navigationTime,
          now,
          diff: now - navigationTime,
        });
        const state = getState();
        state.capturedPageLoads.add(window.location.href);
        updateState({ capturedPageLoads: state.capturedPageLoads });

        // Clear the flag immediately
        chrome.storage.local.set({
          clickCausedNavigation: false,
          navigationClickTime: 0,
        });

        // Start recording but skip page_load capture
        startRecording(true);
      } else {
        // Normal page load - capture it
        const state = getState();
        if (!state.capturedPageLoads.has(window.location.href)) {
          state.capturedPageLoads.add(window.location.href);
          updateState({ capturedPageLoads: state.capturedPageLoads });
          startRecording(false);
        } else {
          // Already captured this URL, just start recording without page_load
          startRecording(true);
        }
      }

      // Load existing steps if any
      if (result.steps) {
        updateState({
          steps: result.steps,
          stepCounter: result.steps.length,
        });
      }
    } else if (result.steps) {
      updateState({
        steps: result.steps,
        stepCounter: result.steps.length,
      });
    }
  }
);
