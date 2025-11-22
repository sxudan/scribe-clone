// Event handlers for user interactions
import { Message, MessageResponse } from '../types';
import { getState, updateState, isRecordingTab } from './state';
import { getElementInfo } from './element-utils';
import { willNavigate, markClickCausedNavigation, clearClickCausedNavigation } from './navigation-detection';
import { captureStep, captureStepWithScreenshot } from './step-capture';

// Extend HTMLElement to include our custom property
interface ExtendedHTMLElement extends HTMLElement {
  _inputTimeout?: number;
}

export function createClickHandler() {
  return function handleClick(event: MouseEvent): void {
    const state = getState();
    if (!state.isRecording) return;
    if (!isRecordingTab()) return;

    // Prevent duplicate clicks
    const now = Date.now();
    const target = event.target as HTMLElement;
    const clickX = Math.round(event.clientX);
    const clickY = Math.round(event.clientY);

    // More aggressive deduplication
    if (state.lastActionType === 'click' && now - state.lastActionTime < 200) {
      if (
        state.lastClickTarget === target ||
        (state.lastClickCoordinates &&
          Math.abs(state.lastClickCoordinates.x - clickX) < 10 &&
          Math.abs(state.lastClickCoordinates.y - clickY) < 10)
      ) {
        console.log('Duplicate click ignored (rapid fire)');
        return;
      }
    }

    // Traditional deduplication
    if (
      state.lastClickTarget === target &&
      state.lastClickCoordinates &&
      Math.abs(state.lastClickCoordinates.x - clickX) < 5 &&
      Math.abs(state.lastClickCoordinates.y - clickY) < 5 &&
      now - state.lastClickTime < 500
    ) {
      console.log('Duplicate click ignored');
      return;
    }

    // Update last click info
    updateState({
      lastClickTime: now,
      lastActionTime: now,
      lastActionType: 'click',
      lastClickTarget: target,
      lastClickCoordinates: { x: clickX, y: clickY },
    });

    // Check if this click will cause navigation
    const { willNavigate: willNav, linkElement, href } = willNavigate(target);

    if (willNav) {
      markClickCausedNavigation();
    }

    let elementInfo;
    try {
      elementInfo = getElementInfo(target, event);
    } catch (error) {
      console.error('Error in getElementInfo:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack',
        target: {
          tag: target.tagName,
          id: target.id,
          className: target.className,
        }
      });
      // Return early if we can't get element info
      return;
    }
    
    const rect = target.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const relativeY = event.clientY - rect.top;

    // For clicks that cause navigation, capture screenshot BEFORE navigation
    if (willNav && linkElement) {
      event.preventDefault();
      event.stopPropagation();

      const currentUrl = window.location.href;
      const currentTitle = document.title;

      chrome.runtime.sendMessage(
        { action: 'captureScreenshot' } as Message,
        async (response: MessageResponse) => {
          let screenshot: string | null = null;
          if (chrome.runtime.lastError) {
            console.warn('Screenshot capture error:', chrome.runtime.lastError);
          } else {
            screenshot = response?.screenshot || null;
            console.log(
              'Screenshot captured for navigation click, length:',
              screenshot?.length || 0
            );
          }

          await captureStepWithScreenshot(
            'click',
            {
              element: elementInfo,
              coordinates: {
                x: event.clientX,
                y: event.clientY,
                relativeX,
                relativeY,
                viewportX: event.clientX,
                viewportY: event.clientY,
              },
              pageMetadata: {
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                scrollX: window.scrollX,
                scrollY: window.scrollY,
                userAgent: navigator.userAgent,
              },
            },
            screenshot,
            currentUrl,
            currentTitle
          );

          if (href && linkElement) {
            setTimeout(() => {
              console.log('Navigating to:', href);
              if (linkElement.target === '_blank') {
                window.open(href, '_blank');
              } else {
                window.location.href = href;
              }
            }, 150);
          }
        }
      );
    } else {
      // For non-navigation clicks, capture normally
      captureStep('click', {
        element: elementInfo,
        coordinates: {
          x: event.clientX,
          y: event.clientY,
          relativeX,
          relativeY,
          viewportX: event.clientX,
          viewportY: event.clientY,
        },
        pageMetadata: {
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          userAgent: navigator.userAgent,
        },
      });
    }
  };
}

export function createInputHandler() {
  return function handleInput(event: Event): void {
    const state = getState();
    if (!state.isRecording) return;
    if (!isRecordingTab()) return;

    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    const mouseEvent = event as unknown as MouseEvent;
    const elementInfo = getElementInfo(target, mouseEvent);

    if (event.type === 'input') {
      const extendedTarget = target as ExtendedHTMLElement;
      if (extendedTarget._inputTimeout) {
        clearTimeout(extendedTarget._inputTimeout);
      }
      extendedTarget._inputTimeout = window.setTimeout(() => {
        const rect = target.getBoundingClientRect();
        captureStep('input', {
          element: elementInfo,
          coordinates: {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            relativeX: rect.width / 2,
            relativeY: rect.height / 2,
            viewportX: rect.left + rect.width / 2,
            viewportY: rect.top + rect.height / 2,
          },
          value: target.value.substring(0, 100),
          pageMetadata: {
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            scrollX: window.scrollX,
            scrollY: window.scrollY,
            userAgent: navigator.userAgent,
          },
        });
      }, 500);
    }
  };
}

export function createChangeHandler() {
  return function handleChange(event: Event): void {
    const state = getState();
    if (!state.isRecording) return;
    if (!isRecordingTab()) return;

    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const mouseEvent = event as unknown as MouseEvent;
    const elementInfo = getElementInfo(target, mouseEvent);

    const value =
      target instanceof HTMLInputElement && target.type === 'checkbox'
        ? target.checked
        : target.value;

    const rect = target.getBoundingClientRect();
    captureStep('change', {
      element: elementInfo,
      coordinates: {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        relativeX: rect.width / 2,
        relativeY: rect.height / 2,
        viewportX: rect.left + rect.width / 2,
        viewportY: rect.top + rect.height / 2,
      },
      value: value,
      pageMetadata: {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        userAgent: navigator.userAgent,
      },
    });
  };
}

export function createSubmitHandler() {
  return function handleSubmit(event: Event): void {
    const state = getState();
    if (!state.isRecording) return;
    if (!isRecordingTab()) return;

    const target = event.target as HTMLFormElement;
    const mouseEvent = event as unknown as MouseEvent;
    const elementInfo = getElementInfo(target, mouseEvent);

    const rect = target.getBoundingClientRect();
    captureStep('submit', {
      element: elementInfo,
      coordinates: {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        relativeX: rect.width / 2,
        relativeY: rect.height / 2,
        viewportX: rect.left + rect.width / 2,
        viewportY: rect.top + rect.height / 2,
      },
      pageMetadata: {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        userAgent: navigator.userAgent,
      },
    });
  };
}

export function createNavigationHandler() {
  return function handleNavigation(): void {
    const state = getState();
    if (!state.isRecording) return;
    if (!isRecordingTab()) return;

    const newUrl = window.location.href;

    if (newUrl === state.currentUrl) {
      return;
    }

    const now = Date.now();
    if (state.lastActionType === 'navigation' && now - state.lastActionTime < 1000) {
      console.log('Duplicate navigation ignored');
      return;
    }

    updateState({
      currentUrl: newUrl,
      lastClickTime: 0,
      lastClickTarget: null,
      lastClickCoordinates: null,
      lastActionTime: now,
      lastActionType: 'navigation',
    });

    if (state.clickCausedNavigation) {
      clearClickCausedNavigation();
    }

    captureStep('navigation', {
      url: window.location.href,
      title: document.title,
      pageMetadata: {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        userAgent: navigator.userAgent,
      },
      coordinates: {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        viewportX: window.innerWidth / 2,
        viewportY: window.innerHeight / 2,
      },
    });
  };
}

