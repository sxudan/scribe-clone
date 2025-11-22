// Step capture logic
import { Step, StepData, Message, MessageResponse, StorageData } from '../types';
import { getState, updateState, checkRecordingTab } from './state';

export async function captureStepWithScreenshot(
  action: Step['action'],
  data: StepData,
  screenshot: string | null,
  urlOverride?: string,
  titleOverride?: string
): Promise<void> {
  // Check if this is the recording tab
  if (!(await checkRecordingTab())) {
    console.log('Ignoring step capture - not the recording tab');
    return;
  }

  const state = getState();
  const stepCounter = state.stepCounter + 1;
  updateState({ stepCounter });

  // Use override URL/title if provided (for navigation clicks to preserve current page info)
  const step: Step = {
    id: stepCounter,
    action,
    data,
    timestamp: Date.now(),
    url: urlOverride || window.location.href,
    title: titleOverride || document.title,
    screenshot: screenshot || undefined,
  };

  if (screenshot) {
    console.log(
      `Screenshot pre-captured for ${action} step ${step.id}, URL: ${step.url}`
    );
  } else {
    console.warn(
      `No screenshot for ${action} step ${step.id}, URL: ${step.url}`
    );
  }

  const newSteps = [...state.steps, step];
  updateState({ steps: newSteps });

  // Save to storage
  await chrome.storage.local.set({ steps: newSteps } as StorageData);
  console.log(`Step ${step.id} saved to storage`);

  // Notify background script
  chrome.runtime.sendMessage({
    action: 'stepCaptured',
    step,
  } as Message);
}

export async function captureStep(
  action: Step['action'],
  data: StepData
): Promise<void> {
  // Check if this is the recording tab
  if (!(await checkRecordingTab())) {
    console.log('Ignoring step capture - not the recording tab');
    return;
  }

  const state = getState();
  const stepCounter = state.stepCounter + 1;
  updateState({ stepCounter });

  const step: Step = {
    id: stepCounter,
    action,
    data,
    timestamp: Date.now(),
    url: window.location.href,
    title: document.title,
  };

  // Capture screenshot based on action type
  if (action === 'click') {
    await captureScreenshotForClick(step);
  } else if (action === 'navigation' || action === 'page_load') {
    await captureScreenshotForNavigation(step);
  } else {
    await captureScreenshotForOther(step);
  }

  const newSteps = [...state.steps, step];
  updateState({ steps: newSteps });

  // Save to storage
  await chrome.storage.local.set({ steps: newSteps } as StorageData);

  // Notify background script
  chrome.runtime.sendMessage({
    action: 'stepCaptured',
    step,
  } as Message);
}

async function captureScreenshotForClick(step: Step): Promise<void> {
  try {
    const response = await new Promise<MessageResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Screenshot timeout'));
      }, 3000);

      chrome.runtime.sendMessage(
        { action: 'captureScreenshot' } as Message,
        (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });

    if (response && response.screenshot) {
      step.screenshot = response.screenshot;
      console.log(`Screenshot captured immediately for click step ${step.id}`);
    } else {
      console.warn(`Screenshot not available for click step ${step.id}`);
    }
  } catch (error) {
    console.warn(`Screenshot capture failed for click step ${step.id}:`, error);
  }
}

async function captureScreenshotForNavigation(step: Step): Promise<void> {
  // Wait for page to be ready
  if (document.readyState === 'loading') {
    await new Promise<void>((resolve) => {
      if (document.readyState === 'complete') {
        resolve();
        return;
      }

      const onReady = () => {
        resolve();
        document.removeEventListener('DOMContentLoaded', onReady);
      };
      document.addEventListener('DOMContentLoaded', onReady);
      setTimeout(() => {
        document.removeEventListener('DOMContentLoaded', onReady);
        resolve();
      }, 500);
    });
  }

  await new Promise((resolve) => setTimeout(resolve, 300));

  // Retry logic
  let screenshotAttempts = 0;
  const maxAttempts = 3;
  let screenshotCaptured = false;

  while (screenshotAttempts < maxAttempts && !screenshotCaptured) {
    try {
      screenshotAttempts++;

      if (screenshotAttempts > 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, 300 * screenshotAttempts)
        );
      } else {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const response = await new Promise<MessageResponse>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Screenshot timeout'));
        }, 10000);

        chrome.runtime.sendMessage(
          { action: 'captureScreenshot' } as Message,
          (response) => {
            clearTimeout(timeout);
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      if (response && response.screenshot) {
        step.screenshot = response.screenshot;
        console.log(
          `Screenshot captured for step ${step.id} (attempt ${screenshotAttempts})`
        );
        screenshotCaptured = true;
      } else {
        console.warn(
          `Screenshot not available for step ${step.id} (attempt ${screenshotAttempts})`
        );
        if (screenshotAttempts < maxAttempts) {
          continue;
        }
      }
    } catch (error) {
      console.warn(
        `Screenshot capture failed for step ${step.id} (attempt ${screenshotAttempts}):`,
        error
      );
      if (screenshotAttempts >= maxAttempts) {
        console.error('All screenshot capture attempts failed');
      }
    }
  }
}

async function captureScreenshotForOther(step: Step): Promise<void> {
  try {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await new Promise<MessageResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Screenshot timeout'));
      }, 5000);

      chrome.runtime.sendMessage(
        { action: 'captureScreenshot' } as Message,
        (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });

    if (response && response.screenshot) {
      step.screenshot = response.screenshot;
      console.log(`Screenshot captured for step ${step.id}`);
    } else {
      console.warn(`Screenshot not available for step ${step.id}`);
    }
  } catch (error) {
    console.warn(`Screenshot capture failed for step ${step.id}:`, error);
  }
}

