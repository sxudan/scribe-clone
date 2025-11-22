// Navigation detection utilities
import { updateState } from './state';

export function willNavigate(target: HTMLElement): {
  willNavigate: boolean;
  linkElement: HTMLAnchorElement | null;
  href: string | null;
} {
  // Check for links
  const isLink = target.tagName === 'A' || target.closest('a');
  const linkElement = isLink
    ? target.tagName === 'A'
      ? (target as HTMLAnchorElement)
      : (target.closest('a') as HTMLAnchorElement)
    : null;
  const href = linkElement?.href || null;
  const isLinkNavigation =
    href &&
    href !== window.location.href &&
    !href.startsWith('#') &&
    !href.startsWith('javascript:');

  // Check for buttons/forms that might cause navigation
  const isButton = target.tagName === 'BUTTON' || target.closest('button');
  const isFormSubmit =
    target.tagName === 'INPUT' &&
    (target as HTMLInputElement).type === 'submit';
  const isInForm = target.closest('form');
  const formElement = target.closest('form') as HTMLFormElement;
  const mightNavigate = !!(
    (isButton || isFormSubmit || isInForm) &&
    (target.getAttribute('type') === 'submit' ||
      formElement?.action ||
      target.onclick !== null ||
      (target as HTMLButtonElement).formAction)
  );

  const willNavigate = isLinkNavigation || mightNavigate;

  return {
    willNavigate,
    linkElement,
    href,
  };
}

export function markClickCausedNavigation(): void {
  const navTime = Date.now();
  updateState({
    clickCausedNavigation: true,
  });
  chrome.storage.local.set({
    clickCausedNavigation: true,
    navigationClickTime: navTime,
  });
}

export function clearClickCausedNavigation(): void {
  updateState({
    clickCausedNavigation: false,
  });
  chrome.storage.local.set({
    clickCausedNavigation: false,
    navigationClickTime: 0,
  });
}

export async function shouldSkipPageLoad(): Promise<boolean> {
  const now = Date.now();
  
  // Check from storage
  return new Promise<boolean>((resolve) => {
    chrome.storage.local.get(
      ['clickCausedNavigation', 'navigationClickTime'],
      (result: { clickCausedNavigation?: boolean; navigationClickTime?: number }) => {
        const navigationTime = result.navigationClickTime || 0;
        const wasClickNavigation =
          !!result.clickCausedNavigation &&
          navigationTime > 0 &&
          now - navigationTime < 5000;
        resolve(wasClickNavigation);
      }
    );
  });
}

