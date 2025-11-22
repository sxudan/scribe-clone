// Content script - captures user interactions on the page
import { Step, StepData, ElementInfo, Message, MessageResponse, StorageData } from './types';

let isRecording = false;
let steps: Step[] = [];
let stepCounter = 0;
let lastClickTime = 0;
let lastClickTarget: HTMLElement | null = null;
let lastClickCoordinates: { x: number; y: number } | null = null;
let currentUrl = window.location.href;
let lastActionTime = 0;
let lastActionType: string | null = null;
let capturedPageLoads = new Set<string>();
let clickCausedNavigation = false;
let recordingTabId: number | null = null;

// Extend HTMLElement to include our custom property
interface ExtendedHTMLElement extends HTMLElement {
  _inputTimeout?: number;
}

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((
  message: Message,
  sender,
  sendResponse: (response: MessageResponse) => void
): boolean => {
  if (message.action === 'ping') {
    sendResponse({ success: true });
  } else if (message.action === 'startRecording') {
    // Store the tab ID when recording starts
    if (sender.tab?.id) {
      recordingTabId = sender.tab.id;
      chrome.storage.local.set({ recordingTabId: sender.tab.id });
    }
    startRecording();
    sendResponse({ success: true });
  } else if (message.action === 'stopRecording') {
    stopRecording();
    sendResponse({ success: true });
  } else if (message.action === 'getSteps') {
    sendResponse({ steps });
  }
  return true;
});

// Get current tab ID using chrome.tabs API
let currentTabId: number | null = null;
chrome.runtime.sendMessage({ action: 'getCurrentTabId' } as Message, (response: any) => {
  if (response && typeof response.tabId === 'number') {
    currentTabId = response.tabId;
  }
});

// Check recording state on load
chrome.storage.local.get(['isRecording', 'steps', 'clickCausedNavigation', 'navigationClickTime', 'recordingTabId'], async (result: StorageData & { clickCausedNavigation?: boolean; navigationClickTime?: number }) => {
  // Get current tab ID if not already set
  if (currentTabId === null) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        currentTabId = tabs[0].id;
      }
    } catch (error) {
      console.error('Error getting current tab ID:', error);
    }
  }
  
  // Only proceed if this is the recording tab (or if recordingTabId is not set yet)
  if (result.recordingTabId && currentTabId && result.recordingTabId !== currentTabId) {
    console.log('Not the recording tab, ignoring events', {
      recordingTabId: result.recordingTabId,
      currentTabId
    });
    return;
  }
  
  if (result.isRecording) {
    // Store recording tab ID
    if (result.recordingTabId) {
      recordingTabId = result.recordingTabId;
    }
    
    // Initialize URL tracking
    currentUrl = window.location.href;
    
    // Check if this page load was caused by a click (within last 5 seconds)
    const now = Date.now();
    const navigationTime = result.navigationClickTime || 0;
    const wasClickNavigation = result.clickCausedNavigation && 
                               navigationTime > 0 && 
                               (now - navigationTime) < 5000;
    
    if (wasClickNavigation) {
      // Skip page_load if it was caused by a click navigation
      console.log('Skipping page_load - caused by click navigation', {
        clickTime: navigationTime,
        now,
        diff: now - navigationTime
      });
      capturedPageLoads.add(window.location.href);
      // Clear the flag immediately
      chrome.storage.local.set({ clickCausedNavigation: false, navigationClickTime: 0 });
      // Start recording but skip page_load capture
      startRecording(true); // Pass true to skip page_load
    } else {
      // Normal page load - capture it
      if (!capturedPageLoads.has(window.location.href)) {
        capturedPageLoads.add(window.location.href);
        startRecording(false); // Pass false to capture page_load
      } else {
        // Already captured this URL, just start recording without page_load
        startRecording(true);
      }
    }
    
    // Load existing steps if any
    if (result.steps) {
      steps = result.steps;
      stepCounter = result.steps.length;
    }
  } else if (result.steps) {
    steps = result.steps;
    stepCounter = result.steps.length;
  }
});

function startRecording(skipPageLoad: boolean = false): void {
  if (isRecording) return;
  
  isRecording = true;
  steps = [];
  stepCounter = 0;
  lastClickTime = 0;
  lastClickTarget = null;
  lastClickCoordinates = null;
  currentUrl = window.location.href;
  lastActionTime = 0;
  lastActionType = null;
  capturedPageLoads.clear();
  clickCausedNavigation = false;
  
  // Add event listeners
  document.addEventListener('click', handleClick, true);
  document.addEventListener('input', handleInput, true);
  document.addEventListener('change', handleChange, true);
  document.addEventListener('submit', handleSubmit, true);
  window.addEventListener('beforeunload', handleNavigation);
  
  // Track page navigation
  const originalPushState = history.pushState;
  history.pushState = function(...args: Parameters<typeof history.pushState>) {
    originalPushState.apply(history, args);
    handleNavigation();
  };
  
  const originalReplaceState = history.replaceState;
  history.replaceState = function(...args: Parameters<typeof history.replaceState>) {
    originalReplaceState.apply(history, args);
    handleNavigation();
  };
  
  // Capture initial page state only when starting recording (and not skipping)
  // Use setTimeout to capture page_load asynchronously so it doesn't block recording start
  if (!skipPageLoad && !capturedPageLoads.has(window.location.href)) {
    capturedPageLoads.add(window.location.href);
    // Capture page_load asynchronously to avoid blocking
    setTimeout(() => {
      captureStep('page_load', {
        url: window.location.href,
        title: document.title,
        pageMetadata: {
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          userAgent: navigator.userAgent
        },
        coordinates: {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
          viewportX: window.innerWidth / 2,
          viewportY: window.innerHeight / 2
        }
      });
    }, 0);
  }
}

function stopRecording(): void {
  if (!isRecording) return;
  
  isRecording = false;
  
  // Remove event listeners
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('input', handleInput, true);
  document.removeEventListener('change', handleChange, true);
  document.removeEventListener('submit', handleSubmit, true);
  window.removeEventListener('beforeunload', handleNavigation);
}

function handleClick(event: MouseEvent): void {
  if (!isRecording) return;
  
  // Prevent duplicate clicks (same target and coordinates within 500ms)
  const now = Date.now();
  const target = event.target as HTMLElement;
  const clickX = Math.round(event.clientX);
  const clickY = Math.round(event.clientY);
  
  // More aggressive deduplication: check if same action type within short time
  if (lastActionType === 'click' && (now - lastActionTime) < 200) {
    // Check if same target or very close coordinates
    if (
      lastClickTarget === target ||
      (lastClickCoordinates &&
        Math.abs(lastClickCoordinates.x - clickX) < 10 &&
        Math.abs(lastClickCoordinates.y - clickY) < 10)
    ) {
      console.log('Duplicate click ignored (rapid fire)');
      return;
    }
  }
  
  // Also check traditional deduplication (same target + coordinates within 500ms)
  if (
    lastClickTarget === target &&
    lastClickCoordinates &&
    Math.abs(lastClickCoordinates.x - clickX) < 5 &&
    Math.abs(lastClickCoordinates.y - clickY) < 5 &&
    (now - lastClickTime) < 500
  ) {
    console.log('Duplicate click ignored');
    return;
  }
  
  // Update last click info
  lastClickTime = now;
  lastActionTime = now;
  lastActionType = 'click';
  lastClickTarget = target;
  lastClickCoordinates = { x: clickX, y: clickY };
  
  // Check if this click will cause navigation
  // Check for links
  const isLink = target.tagName === 'A' || target.closest('a');
  const linkElement = isLink ? (target.tagName === 'A' ? target as HTMLAnchorElement : target.closest('a') as HTMLAnchorElement) : null;
  const href = linkElement?.href;
  const isLinkNavigation = href && href !== window.location.href && !href.startsWith('#') && !href.startsWith('javascript:');
  
  // Check for buttons/forms that might cause navigation
  const isButton = target.tagName === 'BUTTON' || target.closest('button');
  const isFormSubmit = target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'submit';
  const isInForm = target.closest('form');
  const formElement = target.closest('form') as HTMLFormElement;
  const mightNavigate = (isButton || isFormSubmit || isInForm) && 
                       (target.getAttribute('type') === 'submit' || 
                        formElement?.action ||
                        target.onclick !== null ||
                        (target as HTMLButtonElement).formAction);
  
  const willNavigate = isLinkNavigation || mightNavigate;
  
  if (willNavigate) {
    // Mark that this click will cause navigation
    clickCausedNavigation = true;
    const navTime = Date.now();
    chrome.storage.local.set({ 
      clickCausedNavigation: true, 
      navigationClickTime: navTime 
    });
    console.log('Click will cause navigation - setting flag', {
      isLink,
      isButton,
      href,
      navTime
    });
  }
  
  const elementInfo = getElementInfo(target, event);
  
  // Calculate relative coordinates
  const rect = target.getBoundingClientRect();
  const relativeX = event.clientX - rect.left;
  const relativeY = event.clientY - rect.top;
  
  // For clicks that cause navigation, we need to capture screenshot BEFORE navigation
  // Since navigation can be very fast (especially in Gmail), we prevent default temporarily
  if (willNavigate && linkElement) {
    // Prevent default navigation temporarily
    event.preventDefault();
    event.stopPropagation();
    
    // Store current page info before navigation
    const currentUrl = window.location.href;
    const currentTitle = document.title;
    
    // Capture screenshot immediately and WAIT for it before navigating
    chrome.runtime.sendMessage({ action: 'captureScreenshot' } as Message, async (response: MessageResponse) => {
      let screenshot: string | null = null;
      if (chrome.runtime.lastError) {
        console.warn('Screenshot capture error:', chrome.runtime.lastError);
      } else {
        screenshot = response?.screenshot || null;
        console.log('Screenshot captured for navigation click, length:', screenshot?.length || 0);
      }
      
      // Capture step with screenshot - use current page info, not new page
      await captureStepWithScreenshot('click', {
        element: elementInfo,
        coordinates: {
          x: event.clientX,
          y: event.clientY,
          relativeX,
          relativeY,
          viewportX: event.clientX,
          viewportY: event.clientY
        },
        pageMetadata: {
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          userAgent: navigator.userAgent
        }
      }, screenshot, currentUrl, currentTitle);
      
      // Now allow navigation by programmatically navigating AFTER screenshot is saved
      if (href && linkElement) {
        // Small delay to ensure step is saved to storage
        setTimeout(() => {
          console.log('Navigating to:', href);
          if (linkElement.target === '_blank') {
            window.open(href, '_blank');
          } else {
            window.location.href = href;
          }
        }, 150);
      }
    });
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
        viewportY: event.clientY
      },
      pageMetadata: {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        userAgent: navigator.userAgent
      }
    });
  }
}

function handleInput(event: Event): void {
  if (!isRecording) return;
  
  // Check if this is the recording tab
  if (recordingTabId !== null && currentTabId !== null && recordingTabId !== currentTabId) {
    return;
  }
  
  const target = event.target as HTMLInputElement | HTMLTextAreaElement;
  const mouseEvent = event as unknown as MouseEvent;
  const elementInfo = getElementInfo(target, mouseEvent);
  
  // Only capture on blur to avoid too many steps
  if (event.type === 'input') {
    // Debounce input events
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
          viewportY: rect.top + rect.height / 2
        },
        value: target.value.substring(0, 100), // Limit value length
        pageMetadata: {
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          userAgent: navigator.userAgent
        }
      });
    }, 500);
  }
}

function handleChange(event: Event): void {
  if (!isRecording) return;
  
  // Check if this is the recording tab
  if (recordingTabId !== null && currentTabId !== null && recordingTabId !== currentTabId) {
    return;
  }
  
  const target = event.target as HTMLInputElement | HTMLSelectElement;
  const mouseEvent = event as unknown as MouseEvent;
  const elementInfo = getElementInfo(target, mouseEvent);
  
  const value = target instanceof HTMLInputElement && target.type === 'checkbox' 
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
      viewportY: rect.top + rect.height / 2
    },
    value: value,
    pageMetadata: {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      userAgent: navigator.userAgent
    }
  });
}

function handleSubmit(event: Event): void {
  if (!isRecording) return;
  
  // Check if this is the recording tab
  if (recordingTabId !== null && currentTabId !== null && recordingTabId !== currentTabId) {
    return;
  }
  
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
      viewportY: rect.top + rect.height / 2
    },
    pageMetadata: {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      userAgent: navigator.userAgent
    }
  });
}

function handleNavigation(): void {
  if (!isRecording) return;
  
  // Check if this is the recording tab
  if (recordingTabId !== null && currentTabId !== null && recordingTabId !== currentTabId) {
    return;
  }
  
  const newUrl = window.location.href;
  
  // Only capture navigation if URL actually changed
  if (newUrl === currentUrl) {
    return;
  }
  
  // Prevent duplicate navigation events within short time
  const now = Date.now();
  if (lastActionType === 'navigation' && (now - lastActionTime) < 1000) {
    console.log('Duplicate navigation ignored');
    return;
  }
  
  // Update current URL
  currentUrl = newUrl;
  
  // Reset click tracking on navigation
  lastClickTime = 0;
  lastClickTarget = null;
  lastClickCoordinates = null;
  lastActionTime = now;
  lastActionType = 'navigation';
  
  // Clear navigation flag if it was set
  if (clickCausedNavigation) {
    clickCausedNavigation = false;
    chrome.storage.local.set({ clickCausedNavigation: false, navigationClickTime: 0 });
  }
  
  // Don't capture page_load for navigation - only capture navigation
  // Page loads should only happen when recording starts
  captureStep('navigation', {
    url: window.location.href,
    title: document.title,
    pageMetadata: {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      userAgent: navigator.userAgent
    },
    coordinates: {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      viewportX: window.innerWidth / 2,
      viewportY: window.innerHeight / 2
    }
  });
}

function getElementInfo(element: HTMLElement, _event?: MouseEvent): ElementInfo {
  const rect = element.getBoundingClientRect();
  
  // Get all attributes
  const attributes: Record<string, string> = {};
  if (element.attributes) {
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attributes[attr.name] = attr.value;
    }
  }
  
  // Get parent selector
  const parent = element.parentElement;
  const parentSelector = parent ? generateSelector(parent) : null;
  
  // Generate XPath
  const xpath = generateXPath(element);
  
  const info: ElementInfo = {
    tag: element.tagName.toLowerCase(),
    id: element.id || null,
    className: element.className?.toString() || null,
    name: (element as HTMLInputElement).name || null,
    type: (element as HTMLInputElement).type || null,
    text: element.textContent?.trim().substring(0, 50) || null,
    placeholder: (element as HTMLInputElement).placeholder || null,
    label: getLabel(element) || null,
    selector: generateSelector(element),
    boundingBox: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom
    },
    scrollPosition: {
      x: window.scrollX,
      y: window.scrollY
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    attributes,
    parentSelector,
    xpath
  };
  
  return info;
}

function generateXPath(element: HTMLElement): string {
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }
  
  const parts: string[] = [];
  let current: HTMLElement | null = element;
  
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let index = 1;
    let sibling = current.previousElementSibling;
    
    while (sibling) {
      if (sibling.tagName === current.tagName) {
        index++;
      }
      sibling = sibling.previousElementSibling;
    }
    
    const tagName = current.tagName.toLowerCase();
    const xpathIndex = index > 1 ? `[${index}]` : '';
    parts.unshift(`${tagName}${xpathIndex}`);
    
    current = current.parentElement;
    
    // Stop at body
    if (current?.tagName === 'BODY') {
      break;
    }
  }
  
  return '/' + parts.join('/');
}

function getLabel(element: HTMLElement): string | null {
  // Try to find associated label
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) return label.textContent?.trim() || null;
  }
  
  // Try to find parent label
  let parent = element.parentElement;
  while (parent && parent.tagName !== 'LABEL' && parent.tagName !== 'BODY') {
    parent = parent.parentElement;
  }
  if (parent && parent.tagName === 'LABEL') {
    return parent.textContent?.trim() || null;
  }
  
  // Try aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    return ariaLabel;
  }
  
  return null;
}

function generateSelector(element: HTMLElement): string {
  // Generate a CSS selector for the element
  if (element.id) {
    return `#${element.id}`;
  }
  
  if (element.className) {
    const classes = element.className.toString().split(' ').filter(c => c).join('.');
    if (classes) {
      const selector = `${element.tagName.toLowerCase()}.${classes}`;
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }
  }
  
  // Fallback to path-based selector
  const path: string[] = [];
  let current: HTMLElement | null = element;
  while (current && current.tagName !== 'HTML') {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector += `#${current.id}`;
      path.unshift(selector);
      break;
    } else {
      let sibling: Element | null = current;
      let nth = 1;
      while (sibling && sibling.previousElementSibling) {
        sibling = sibling.previousElementSibling;
        if (sibling && sibling.tagName === current.tagName) nth++;
      }
      if (nth > 1) {
        selector += `:nth-of-type(${nth})`;
      }
      path.unshift(selector);
    }
    current = current.parentElement;
  }
  
  return path.join(' > ');
}

// Helper function to capture step with pre-captured screenshot
async function captureStepWithScreenshot(
  action: Step['action'], 
  data: StepData, 
  screenshot: string | null,
  urlOverride?: string,
  titleOverride?: string
): Promise<void> {
  // Check if this is the recording tab before capturing
  if (recordingTabId !== null && currentTabId !== null && recordingTabId !== currentTabId) {
    console.log('Ignoring step capture - not the recording tab');
    return;
  }
  
  // Also check from storage in case currentTabId wasn't set yet
  const storage = await chrome.storage.local.get(['recordingTabId']);
  if (storage.recordingTabId && currentTabId && storage.recordingTabId !== currentTabId) {
    console.log('Ignoring step capture - not the recording tab (from storage)');
    return;
  }
  
  stepCounter++;
  
  // Use override URL/title if provided (for navigation clicks to preserve current page info)
  const step: Step = {
    id: stepCounter,
    action,
    data,
    timestamp: Date.now(),
    url: urlOverride || window.location.href,
    title: titleOverride || document.title,
    screenshot: screenshot || undefined
  };
  
  if (screenshot) {
    console.log(`Screenshot pre-captured for ${action} step ${step.id}, URL: ${step.url}`);
  } else {
    console.warn(`No screenshot for ${action} step ${step.id}, URL: ${step.url}`);
  }
  
  steps.push(step);
  
  // Save to storage
  await chrome.storage.local.set({ steps } as StorageData);
  console.log(`Step ${step.id} saved to storage`);
  
  // Notify background script
  chrome.runtime.sendMessage({ 
    action: 'stepCaptured', 
    step 
  } as Message);
}

async function captureStep(action: Step['action'], data: StepData): Promise<void> {
  // Check if this is the recording tab before capturing
  if (recordingTabId !== null && currentTabId !== null && recordingTabId !== currentTabId) {
    console.log('Ignoring step capture - not the recording tab');
    return;
  }
  
  // Also check from storage in case currentTabId wasn't set yet
  const storage = await chrome.storage.local.get(['recordingTabId']);
  if (storage.recordingTabId && currentTabId && storage.recordingTabId !== currentTabId) {
    console.log('Ignoring step capture - not the recording tab (from storage)');
    return;
  }
  
  stepCounter++;
  
  const step: Step = {
    id: stepCounter,
    action,
    data,
    timestamp: Date.now(),
    url: window.location.href,
    title: document.title
  };
  
  // For click events, capture screenshot immediately (no delays) to avoid missing it due to fast navigation
  // For navigation/page_load actions, wait for page to be ready
  if (action === 'click') {
    // Capture screenshot immediately for clicks - no delays
    try {
      const response = await new Promise<MessageResponse>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Screenshot timeout'));
        }, 3000); // Shorter timeout for clicks
        
        chrome.runtime.sendMessage({ action: 'captureScreenshot' } as Message, (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      
      if (response && response.screenshot) {
        step.screenshot = response.screenshot;
        console.log(`Screenshot captured immediately for click step ${step.id}`);
      } else {
        console.warn(`Screenshot not available for click step ${step.id}`);
      }
    } catch (error) {
      console.warn(`Screenshot capture failed for click step ${step.id}:`, error);
      // Continue without screenshot - step is still valid
    }
  } else if (action === 'navigation' || action === 'page_load') {
    // For navigation/page_load, wait for page to be ready
    if (document.readyState === 'loading') {
      await new Promise<void>((resolve) => {
        // Check if already complete
        if (document.readyState === 'complete') {
          resolve();
          return;
        }
        
        // Wait for DOMContentLoaded with shorter timeout
        const onReady = () => {
          resolve();
          document.removeEventListener('DOMContentLoaded', onReady);
        };
        document.addEventListener('DOMContentLoaded', onReady);
        // Shorter fallback timeout (500ms instead of 3000ms)
        setTimeout(() => {
          document.removeEventListener('DOMContentLoaded', onReady);
          resolve();
        }, 500);
      });
    }
    
    // Reduced delay for navigation - only 300ms to ensure basic rendering
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Capture screenshot with retry logic for navigation/page_load
    let screenshotAttempts = 0;
    const maxAttempts = 3;
    let screenshotCaptured = false;
    
    while (screenshotAttempts < maxAttempts && !screenshotCaptured) {
      try {
        screenshotAttempts++;
        
        // Add a small delay before capturing to ensure page is ready
        if (screenshotAttempts > 1) {
          await new Promise(resolve => setTimeout(resolve, 300 * screenshotAttempts));
        } else {
          // Minimal delay on first attempt (already waited above)
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        const response = await new Promise<MessageResponse>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Screenshot timeout'));
          }, 10000);
          
          chrome.runtime.sendMessage({ action: 'captureScreenshot' } as Message, (response) => {
            clearTimeout(timeout);
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });
        
        if (response && response.screenshot) {
          step.screenshot = response.screenshot;
          console.log(`Screenshot captured for step ${step.id} (attempt ${screenshotAttempts})`);
          screenshotCaptured = true;
        } else {
          console.warn(`Screenshot not available for step ${step.id} (attempt ${screenshotAttempts})`);
          if (screenshotAttempts < maxAttempts) {
            continue; // Retry
          }
        }
      } catch (error) {
        console.warn(`Screenshot capture failed for step ${step.id} (attempt ${screenshotAttempts}):`, error);
        if (screenshotAttempts >= maxAttempts) {
          console.error('All screenshot capture attempts failed');
          // Continue without screenshot - step is still valid
        }
      }
    }
  } else {
    // For other actions (input, change, submit), capture with minimal delay
    try {
      // Small delay to ensure action is visible
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await new Promise<MessageResponse>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Screenshot timeout'));
        }, 5000);
        
        chrome.runtime.sendMessage({ action: 'captureScreenshot' } as Message, (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      
      if (response && response.screenshot) {
        step.screenshot = response.screenshot;
        console.log(`Screenshot captured for step ${step.id}`);
      } else {
        console.warn(`Screenshot not available for step ${step.id}`);
      }
    } catch (error) {
      console.warn(`Screenshot capture failed for step ${step.id}:`, error);
      // Continue without screenshot - step is still valid
    }
  }
  
  steps.push(step);
  
  // Save to storage
  chrome.storage.local.set({ steps } as StorageData);
  
  // Notify background script
  chrome.runtime.sendMessage({ 
    action: 'stepCaptured', 
    step 
  } as Message);
}

