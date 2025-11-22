// Content script - captures user interactions on the page
import { Step, StepData, ElementInfo, Message, MessageResponse, StorageData } from './types';

let isRecording = false;
let steps: Step[] = [];
let stepCounter = 0;

// Extend HTMLElement to include our custom property
interface ExtendedHTMLElement extends HTMLElement {
  _inputTimeout?: number;
}

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((
  message: Message,
  _sender,
  sendResponse: (response: MessageResponse) => void
): boolean => {
  if (message.action === 'ping') {
    sendResponse({ success: true });
  } else if (message.action === 'startRecording') {
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

// Check recording state on load
chrome.storage.local.get(['isRecording', 'steps'], (result: StorageData) => {
  if (result.isRecording) {
    startRecording();
  }
  if (result.steps) {
    steps = result.steps;
    stepCounter = steps.length;
  }
});

function startRecording(): void {
  if (isRecording) return;
  
  isRecording = true;
  steps = [];
  stepCounter = 0;
  
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
  
  // Capture initial page state
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
  
  const target = event.target as HTMLElement;
  const elementInfo = getElementInfo(target, event);
  
  // Calculate relative coordinates
  const rect = target.getBoundingClientRect();
  const relativeX = event.clientX - rect.left;
  const relativeY = event.clientY - rect.top;
  
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

function handleInput(event: Event): void {
  if (!isRecording) return;
  
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

async function captureStep(action: Step['action'], data: StepData): Promise<void> {
  stepCounter++;
  
  const step: Step = {
    id: stepCounter,
    action,
    data,
    timestamp: Date.now(),
    url: window.location.href,
    title: document.title
  };
  
  // Capture screenshot if possible (with retry logic)
  try {
    const response = await new Promise<MessageResponse>((resolve, reject) => {
      // Add timeout
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
    console.warn('Screenshot capture failed:', error);
    // Continue without screenshot - step is still valid
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

