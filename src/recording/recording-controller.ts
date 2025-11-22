// Recording controller - start/stop recording logic
import { getState, updateState, resetState } from './state';
import { captureStep } from './step-capture';
import {
  createClickHandler,
  createInputHandler,
  createChangeHandler,
  createSubmitHandler,
  createNavigationHandler,
} from './event-handlers';

let clickHandler: ((event: MouseEvent) => void) | null = null;
let inputHandler: ((event: Event) => void) | null = null;
let changeHandler: ((event: Event) => void) | null = null;
let submitHandler: ((event: Event) => void) | null = null;
let navigationHandler: (() => void) | null = null;

let originalPushState: typeof history.pushState | null = null;
let originalReplaceState: typeof history.replaceState | null = null;

export function startRecording(skipPageLoad: boolean = false): void {
  const state = getState();
  if (state.isRecording) return;

  resetState();
  updateState({ isRecording: true });

  // Create event handlers
  clickHandler = createClickHandler();
  inputHandler = createInputHandler();
  changeHandler = createChangeHandler();
  submitHandler = createSubmitHandler();
  navigationHandler = createNavigationHandler();

  // Add event listeners
  document.addEventListener('click', clickHandler, true);
  document.addEventListener('input', inputHandler, true);
  document.addEventListener('change', changeHandler, true);
  document.addEventListener('submit', submitHandler, true);
  window.addEventListener('beforeunload', navigationHandler);

  // Track page navigation
  originalPushState = history.pushState;
  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    originalPushState!.apply(history, args);
    navigationHandler!();
  };

  originalReplaceState = history.replaceState;
  history.replaceState = function (
    ...args: Parameters<typeof history.replaceState>
  ) {
    originalReplaceState!.apply(history, args);
    navigationHandler!();
  };

  // Capture initial page state
  const currentState = getState();
  if (!skipPageLoad && !currentState.capturedPageLoads.has(window.location.href)) {
    currentState.capturedPageLoads.add(window.location.href);
    updateState({ capturedPageLoads: currentState.capturedPageLoads });

    setTimeout(() => {
      captureStep('page_load', {
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
    }, 0);
  }
}

export function stopRecording(): void {
  const state = getState();
  if (!state.isRecording) return;

  updateState({ isRecording: false });

  // Remove event listeners
  if (clickHandler) {
    document.removeEventListener('click', clickHandler, true);
    clickHandler = null;
  }
  if (inputHandler) {
    document.removeEventListener('input', inputHandler, true);
    inputHandler = null;
  }
  if (changeHandler) {
    document.removeEventListener('change', changeHandler, true);
    changeHandler = null;
  }
  if (submitHandler) {
    document.removeEventListener('submit', submitHandler, true);
    submitHandler = null;
  }
  if (navigationHandler) {
    window.removeEventListener('beforeunload', navigationHandler);
    navigationHandler = null;
  }

  // Restore original history methods
  if (originalPushState) {
    history.pushState = originalPushState;
    originalPushState = null;
  }
  if (originalReplaceState) {
    history.replaceState = originalReplaceState;
    originalReplaceState = null;
  }
}

