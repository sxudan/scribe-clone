// Background service worker
import { Step, ExportFormat, Message, MessageResponse } from './types';

chrome.runtime.onInstalled.addListener(() => {
  console.log('Documentation Tool installed');
});

// Open side panel when extension icon is clicked (if side panel is available)
if (chrome.sidePanel) {
  chrome.action.onClicked.addListener((tab) => {
    if (tab.windowId) {
      chrome.sidePanel.open({ windowId: tab.windowId });
    }
  });
}

// Handle screenshot capture requests
chrome.runtime.onMessage.addListener((
  message: Message,
  sender,
  sendResponse: (response: MessageResponse) => void
): boolean => {
  if (message.action === 'captureScreenshot') {
    if (sender.tab?.id) {
      const tabId = sender.tab.id;
      // Check if this is the recording tab
      chrome.storage.local.get(['recordingTabId'], (result) => {
        if (result.recordingTabId && result.recordingTabId !== tabId) {
          console.log('Ignoring screenshot - not the recording tab');
          sendResponse({ screenshot: null });
          return;
        }
        
        captureScreenshot(tabId)
          .then(screenshot => {
            sendResponse({ screenshot });
          })
          .catch(error => {
            console.error('Screenshot error:', error);
            sendResponse({ screenshot: null });
          });
      });
    } else {
      sendResponse({ screenshot: null });
    }
    return true; // Keep channel open for async response
  }
  
  if (message.action === 'getCurrentTabId') {
    // Get the current tab ID from the sender
    if (sender.tab?.id) {
      sendResponse({ tabId: sender.tab.id });
    } else {
      // Fallback: query for active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          sendResponse({ tabId: tabs[0].id });
        } else {
          sendResponse({ tabId: null });
        }
      });
    }
    return true; // Keep channel open for async response
  }
  
  if (message.action === 'stepCaptured') {
    // Handle step capture notification if needed
    if (message.step) {
      console.log('Step captured:', message.step.id);
    }
  }
  
  if (message.action === 'generateDocumentation') {
    if (message.steps && message.format) {
      generateDocumentation(message.steps, message.format)
        .then(result => {
          sendResponse({ success: true, content: result });
        })
        .catch(error => {
          console.error('Documentation generation error:', error);
          const err = error as Error;
          sendResponse({ success: false, error: err.message });
        });
    } else {
      sendResponse({ success: false, error: 'Missing steps or format' });
    }
    return true; // Keep channel open for async response
  }
  
  return false;
});

async function captureScreenshot(tabId: number): Promise<string | null> {
  try {
    // First, ensure the tab is active/visible
    const tab = await chrome.tabs.get(tabId);
    if (!tab) {
      console.error('Tab not found:', tabId);
      return null;
    }
    
    // Check if tab is active in its window
    if (!tab.active) {
      console.warn('Tab is not active, attempting to activate it');
      try {
        await chrome.tabs.update(tabId, { active: true });
        // Wait a bit for the tab to become active
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (updateError) {
        console.warn('Could not activate tab:', updateError);
        // Continue anyway - might still work
      }
    }
    
    // Get the window ID to ensure we capture from the correct window
    const windowId = tab.windowId;
    
    // Use captureVisibleTab with windowId to capture from the correct window
    // Note: captureVisibleTab captures the active tab in the specified window
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
      format: 'png',
      quality: 80
    });
    
    if (!dataUrl) {
      console.error('Screenshot returned empty');
      return null;
    }
    
    return dataUrl;
  } catch (error) {
    console.error('Failed to capture screenshot:', error);
    // Try fallback: capture without windowId
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab({
        format: 'png',
        quality: 80
      });
      return dataUrl;
    } catch (fallbackError) {
      console.error('Fallback screenshot capture also failed:', fallbackError);
      return null;
    }
  }
}

async function generateDocumentation(steps: Step[], format: ExportFormat = 'markdown'): Promise<string> {
  // For now, generate locally. In production, this would call an AI API
  // You can replace this with an actual API call to your backend
  
  const formattedSteps = formatSteps(steps, format);
  
  // If you want to use an AI service, uncomment and configure:
  /*
  try {
    const response = await fetch('YOUR_BACKEND_API_URL/generate-documentation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        steps: steps,
        format: format
      })
    });
    
    if (!response.ok) {
      throw new Error('API request failed');
    }
    
    const data = await response.json();
    return data.documentation;
  } catch (error) {
    console.error('API error, using local formatter:', error);
    return formattedSteps;
  }
  */
  
  return formattedSteps;
}

function formatSteps(steps: Step[], format: ExportFormat): string {
  if (format === 'text') {
    return formatAsText(steps);
  } else if (format === 'html') {
    return formatAsHTML(steps);
  } else {
    return formatAsMarkdown(steps);
  }
}

function formatAsText(steps: Step[]): string {
  let output = `Documentation Guide\n`;
  output += `Generated: ${new Date().toLocaleString()}\n`;
  output += `Total Steps: ${steps.length}\n\n`;
  output += `========================================\n\n`;
  
  steps.forEach((step, index) => {
    output += `Step ${index + 1}: ${formatActionText(step)}\n\n`;
    if (step.url) {
      output += `URL: ${step.url}\n`;
    }
    output += `\n`;
  });
  
  return output;
}

function formatAsMarkdown(steps: Step[]): string {
  let output = `# Documentation Guide\n\n`;
  output += `**Generated:** ${new Date().toLocaleString()}\n`;
  output += `**Total Steps:** ${steps.length}\n\n`;
  output += `---\n\n`;
  
  steps.forEach((step, index) => {
    output += `## Step ${index + 1}: ${formatActionTitle(step)}\n\n`;
    
    if (step.screenshot) {
      const base64Data = step.screenshot.split(',')[1] || step.screenshot;
      output += `![Step ${index + 1} Screenshot](data:image/png;base64,${base64Data})\n\n`;
    }
    
    output += formatActionDetails(step);
    output += `\n`;
    
    if (step.url) {
      output += `**URL:** ${step.url}\n\n`;
    }
    
    output += `---\n\n`;
  });
  
  return output;
}

function formatAsHTML(steps: Step[]): string {
  let output = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Documentation Guide</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
    }
    h1 { color: #333; }
    h2 { color: #555; margin-top: 30px; }
    .step { margin-bottom: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px; }
    .screenshot { max-width: 100%; border-radius: 4px; margin: 10px 0; }
    .details { margin: 10px 0; }
    .label { font-weight: bold; color: #666; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>Documentation Guide</h1>
  <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
  <p><strong>Total Steps:</strong> ${steps.length}</p>
  <hr>
`;
  
  steps.forEach((step, index) => {
    output += `  <div class="step">\n`;
    output += `    <h2>Step ${index + 1}: ${formatActionTitle(step)}</h2>\n`;
    
    if (step.screenshot) {
      output += `    <img src="${step.screenshot}" alt="Step ${index + 1} Screenshot" class="screenshot">\n`;
    }
    
    output += `    <div class="details">\n`;
    output += formatActionDetailsHTML(step);
    output += `    </div>\n`;
    
    if (step.url) {
      output += `    <p><strong>URL:</strong> <a href="${step.url}">${step.url}</a></p>\n`;
    }
    
    output += `  </div>\n`;
  });
  
  output += `</body>\n</html>`;
  
  return output;
}

function formatActionTitle(step: Step): string {
  const actionMap: Record<Step['action'], string> = {
    'click': 'Click',
    'input': 'Enter Text',
    'change': 'Change Selection',
    'submit': 'Submit Form',
    'navigation': 'Navigate',
    'page_load': 'Page Load'
  };
  
  return actionMap[step.action] || step.action;
}

function formatActionText(step: Step): string {
  const title = formatActionTitle(step);
  const details = formatActionDetails(step);
  return `${title}\n${details}`;
}

function formatActionDetails(step: Step): string {
  let details = '';
  const data = step.data;
  
  if (data.element) {
    const el = data.element;
    if (el.label) {
      details += `**Element:** ${el.label}\n`;
    } else if (el.text) {
      details += `**Element:** ${el.text}\n`;
    } else if (el.placeholder) {
      details += `**Element:** ${el.placeholder}\n`;
    } else {
      details += `**Element:** ${el.tag}${el.id ? `#${el.id}` : ''}${el.className ? `.${el.className}` : ''}\n`;
    }
    
    if (el.selector) {
      details += `**Selector:** \`${el.selector}\`\n`;
    }
  }
  
  if (data.value !== undefined) {
    details += `**Value:** ${data.value}\n`;
  }
  
  if (data.url) {
    details += `**URL:** ${data.url}\n`;
  }
  
  if (data.title) {
    details += `**Title:** ${data.title}\n`;
  }
  
  return details;
}

function formatActionDetailsHTML(step: Step): string {
  let details = '';
  const data = step.data;
  
  if (data.element) {
    const el = data.element;
    if (el.label) {
      details += `      <p><span class="label">Element:</span> ${escapeHtml(el.label)}</p>\n`;
    } else if (el.text) {
      details += `      <p><span class="label">Element:</span> ${escapeHtml(el.text)}</p>\n`;
    } else if (el.placeholder) {
      details += `      <p><span class="label">Element:</span> ${escapeHtml(el.placeholder)}</p>\n`;
    } else {
      const elementDesc = `${el.tag}${el.id ? `#${el.id}` : ''}${el.className ? `.${el.className}` : ''}`;
      details += `      <p><span class="label">Element:</span> ${escapeHtml(elementDesc)}</p>\n`;
    }
    
    if (el.selector) {
      details += `      <p><span class="label">Selector:</span> <code>${escapeHtml(el.selector)}</code></p>\n`;
    }
  }
  
  if (data.value !== undefined) {
    const valueStr = typeof data.value === 'boolean' ? String(data.value) : data.value;
    details += `      <p><span class="label">Value:</span> ${escapeHtml(valueStr)}</p>\n`;
  }
  
  if (data.url) {
    details += `      <p><span class="label">URL:</span> ${escapeHtml(data.url)}</p>\n`;
  }
  
  if (data.title) {
    details += `      <p><span class="label">Title:</span> ${escapeHtml(data.title)}</p>\n`;
  }
  
  return details;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
