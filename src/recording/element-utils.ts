// Element information extraction utilities
import { ElementInfo } from '../types';

export function getElementInfo(
  element: HTMLElement,
  _event?: MouseEvent
): ElementInfo {
  const rect = element.getBoundingClientRect();

  // Get all attributes
  const attributes: Record<string, string> = {};
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    attributes[attr.name] = attr.value;
  }

  // Get parent selector
  const parent = element.parentElement;
  const parentSelector = parent ? generateSelector(parent) : null;
  // Generate XPath
  const xpath = generateXPath(element);
  
  try {
    const selector = generateSelector(element);
    const label = getLabel(element);
    const inputElement = element as HTMLInputElement;
    const name = inputElement.name || null;
    const type = inputElement.type || null;
    const placeholder = inputElement.placeholder || null;
    const info: ElementInfo = {
      tag: element.tagName.toLowerCase(),
      id: element.id || null,
      className: element.className?.toString() || null,
      text: element.textContent?.trim().substring(0, 200) || null,
      selector,
      label,
      name,
      type,
      placeholder,
      boundingBox: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
      },
      scrollPosition: {
        x: window.scrollX,
        y: window.scrollY,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      attributes,
      parentSelector,
      xpath,
    };

    return info;
  } catch (error) {
    console.error('Error creating ElementInfo:', error);
    throw error;
  }
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

export function generateSelector(element: HTMLElement): string {
  // Generate a CSS selector for the element
  if (element.id) {
    return `#${element.id}`;
  }

  if (element.className) {
    // Escape special characters in class names for CSS selectors
    const escapeClassName = (className: string): string => {
      // CSS class names can contain: letters, numbers, hyphens, underscores
      // We need to escape or remove invalid characters
      return className.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    };

    const classList = element.className
      .toString()
      .split(' ')
      .filter((c) => c && c.trim().length > 0)
      .map(escapeClassName)
      .filter((c) => c.length > 0); // Remove empty strings after escaping

    if (classList.length > 0) {
      const classes = classList.join('.');
      const selector = `${element.tagName.toLowerCase()}.${classes}`;
      
      // Validate selector before using it
      try {
        const matches = document.querySelectorAll(selector);
        if (matches.length === 1 && matches[0] === element) {
          return selector;
        }
      } catch (error) {
        // Invalid selector, skip it
        console.warn('Invalid selector generated, skipping:', selector, error);
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

