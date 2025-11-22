// Generate .docx file from steps stored locally
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, AlignmentType, ExternalHyperlink } from 'docx';
import { Step } from '../types';
import { saveAs } from 'file-saver';

export async function generateAndDownloadDocx(steps: Step[], title: string = 'Documentation Guide'): Promise<void> {
  const children: Paragraph[] = [];

  // Title with better formatting
  children.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Introduction paragraph
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'This guide will walk you through the process step by step. Follow each step in order to complete the task.',
          italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Add spacing
  children.push(new Paragraph({ text: '', spacing: { after: 200 } }));

  // Process each step
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepData = step.data;

    // Step header with better formatting (like Scribe)
    const stepNumber = i + 1;
    const actionDescription = getActionDescription(step, stepData);
    
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Step ${stepNumber}`,
            bold: true,
            size: 28,
            color: '2E75B6',
          }),
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      })
    );

    // Action description (user-friendly) with clickable URLs
    const descriptionChildren = createActionDescriptionWithLinks(actionDescription);
    children.push(
      new Paragraph({
        children: descriptionChildren,
        spacing: { after: 300 },
      })
    );

    // Screenshot with click highlight (if available)
    // Skip highlight for page_load actions
    if (step.screenshot) {
      try {
        // Only add click highlight for actions that involve clicks/interactions
        const shouldAddHighlight = step.action !== 'page_load' && step.action !== 'navigation';
        
        let imageBuffer: Buffer | null = null;
        
        if (shouldAddHighlight) {
          // Add click highlight to screenshot
          const boundingBox = stepData.element?.boundingBox 
            ? {
                x: stepData.element.boundingBox.x,
                y: stepData.element.boundingBox.y,
                width: stepData.element.boundingBox.width,
                height: stepData.element.boundingBox.height,
              }
            : null;
          
          imageBuffer = await addClickHighlight(
            step.screenshot,
            stepData.coordinates,
            boundingBox,
            stepData.pageMetadata
          );
        }
        
        // If highlight wasn't added or failed, use original screenshot
        if (!imageBuffer) {
          imageBuffer = await dataUrlToBuffer(step.screenshot);
        }
        
        if (imageBuffer) {
          children.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: imageBuffer,
                  transformation: {
                    width: 800,
                    height: 600,
                  },
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 },
            })
          );
        }
      } catch (error) {
        console.error(`Error processing screenshot for step ${step.id}:`, error);
        // Fallback to original screenshot without annotation
        try {
          const imageBuffer = await dataUrlToBuffer(step.screenshot);
          if (imageBuffer) {
            children.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    data: imageBuffer,
                    transformation: {
                      width: 800,
                      height: 600,
                    },
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 300 },
              })
            );
          }
        } catch (fallbackError) {
          console.error('Fallback screenshot error:', fallbackError);
        }
      }
    }

    // Additional helpful information (user-friendly format)
    const helpfulInfo = getHelpfulInfo(step, stepData);
    if (helpfulInfo) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: helpfulInfo,
              size: 22,
            }),
          ],
          spacing: { after: 400 },
        })
      );
    }

    // Add spacing between steps
    children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
  }

  // Create document
  const doc = new Document({
    sections: [
      {
        children,
      },
    ],
  });

  // Generate blob and download
  const blob = await Packer.toBlob(doc);
  const fileName = `${title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.docx`;
  saveAs(blob, fileName);
}

// Clean text by removing newlines and extra whitespace
function cleanText(text: string | null | undefined, maxLength: number = 50): string {
  if (!text) return '';
  
  return text
    .replace(/\n/g, ' ')           // Replace newlines with spaces
    .replace(/\r/g, ' ')           // Replace carriage returns with spaces
    .replace(/\t/g, ' ')           // Replace tabs with spaces
    .replace(/\s+/g, ' ')          // Replace multiple spaces with single space
    .trim()                         // Remove leading/trailing whitespace
    .substring(0, maxLength);       // Limit length
}

// Create action description with clickable hyperlinks for URLs
function createActionDescriptionWithLinks(description: string): (TextRun | ExternalHyperlink)[] {
  // Check if description contains a URL
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = description.match(urlRegex);
  
  if (matches && matches.length > 0) {
    // Split description by URL and create hyperlinks
    const parts: (TextRun | ExternalHyperlink)[] = [];
    let lastIndex = 0;
    
    for (const urlMatch of matches) {
      // Add text before URL
      const beforeText = description.substring(lastIndex, description.indexOf(urlMatch, lastIndex));
      if (beforeText) {
        parts.push(
          new TextRun({
            text: beforeText,
            bold: true,
            size: 24,
          })
        );
      }
      
      // Add clickable hyperlink
      parts.push(
        new ExternalHyperlink({
          children: [
            new TextRun({
              text: urlMatch,
              bold: true,
              size: 24,
              color: '0563C1', // Blue color for links
            }),
          ],
          link: urlMatch,
        })
      );
      
      lastIndex = description.indexOf(urlMatch, lastIndex) + urlMatch.length;
    }
    
    // Add remaining text after last URL
    const afterText = description.substring(lastIndex);
    if (afterText) {
      parts.push(
        new TextRun({
          text: afterText,
          bold: true,
          size: 24,
        })
      );
    }
    
    return parts;
  }
  
  // No URL found, return plain text
  return [
    new TextRun({
      text: description,
      bold: true,
      size: 24,
    }),
  ];
}

// Get user-friendly action description (like Scribe format)
function getActionDescription(step: Step, stepData: any): string {
  const el = stepData.element;
  
  switch (step.action) {
    case 'click':
      if (el?.label) {
        return `Click on "${cleanText(el.label)}"`;
      } else if (el?.text) {
        return `Click on "${cleanText(el.text)}"`;
      } else if (el?.placeholder) {
        return `Click on the "${cleanText(el.placeholder)}" field`;
      } else if (el?.tag === 'button') {
        return 'Click the button';
      } else if (el?.tag === 'a') {
        return 'Click the link';
      } else {
        return 'Click on the highlighted element';
      }
    
    case 'input':
      if (el?.placeholder) {
        return `Enter text in the "${cleanText(el.placeholder)}" field`;
      } else if (el?.label) {
        return `Enter text in the "${cleanText(el.label)}" field`;
      } else if (stepData.value) {
        return `Enter "${cleanText(String(stepData.value), 30)}"`;
      } else {
        return 'Enter text in the highlighted field';
      }
    
    case 'change':
      if (el?.label) {
        return `Select "${cleanText(String(stepData.value || ''), 30)}" from ${cleanText(el.label)}`;
      } else if (stepData.value) {
        return `Select "${cleanText(String(stepData.value), 30)}"`;
      } else {
        return 'Change the selection';
      }
    
    case 'submit':
      return 'Submit the form';
    
    case 'navigation':
      if (step.url) {
        return `Navigate to ${step.url}`;
      }
      return 'Navigate to the next page';
    
    case 'page_load':
      if (step.url) {
        return `Navigate to ${step.url}`;
      } else if (step.title) {
        return `Page loaded: ${step.title}`;
      }
      return 'Page loaded';
    
    default:
      return 'Perform the action';
  }
}

// Get helpful information for the step (user-friendly)
function getHelpfulInfo(step: Step, stepData: any): string | null {
  const info: string[] = [];
  
  // Add input value if it's an input action
  if (step.action === 'input' && stepData.value) {
    const value = String(stepData.value).substring(0, 100);
    info.push(`Enter: "${value}"`);
  }
  
  // Add selected value for change action
  if (step.action === 'change' && stepData.value) {
    const value = String(stepData.value).substring(0, 100);
    info.push(`Selected: "${value}"`);
  }
  
  // Add page context if different from previous
  if (step.url && step.title) {
    info.push(`Page: ${step.title}`);
  }
  
  return info.length > 0 ? info.join(' • ') : null;
}

// Add click highlight to screenshot
async function addClickHighlight(
  dataUrl: string,
  coordinates: { x: number; y: number; viewportX?: number; viewportY?: number } | null,
  boundingBox: { x: number; y: number; width: number; height: number } | null,
  pageMetadata?: { viewportWidth: number; viewportHeight: number; scrollX: number; scrollY: number } | null
): Promise<Buffer | null> {
  try {
    // Create image from data URL
    const img = new Image();
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          // Create canvas
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          // Draw original image
          ctx.drawImage(img, 0, 0);
          
          // Calculate click position with proper scaling
          let clickX = 0;
          let clickY = 0;
          let hasClick = false;
          
          if (coordinates) {
            // Calculate scale factors if viewport dimensions are available
            let scaleX = 1;
            let scaleY = 1;
            
            if (pageMetadata && pageMetadata.viewportWidth > 0 && pageMetadata.viewportHeight > 0) {
              // Screenshot might be at different resolution than viewport
              // Scale coordinates to match screenshot dimensions
              scaleX = img.width / pageMetadata.viewportWidth;
              scaleY = img.height / pageMetadata.viewportHeight;
            }
            
            // Prefer viewport coordinates (they're relative to viewport, which matches screenshot)
            if (coordinates.viewportX !== undefined && coordinates.viewportY !== undefined) {
              clickX = coordinates.viewportX * scaleX;
              clickY = coordinates.viewportY * scaleY;
              hasClick = true;
            } else if (coordinates.x > 0 && coordinates.y > 0) {
              // Use absolute coordinates, but need to account for scroll if available
              let x = coordinates.x;
              let y = coordinates.y;
              
              // If we have scroll position, adjust coordinates
              if (pageMetadata) {
                // Absolute coordinates might include scroll, but screenshot is viewport only
                // So we need to check if coordinates are within viewport
                if (x >= pageMetadata.scrollX && x < pageMetadata.scrollX + pageMetadata.viewportWidth &&
                    y >= pageMetadata.scrollY && y < pageMetadata.scrollY + pageMetadata.viewportHeight) {
                  // Coordinates are within viewport, adjust for scroll
                  x = x - pageMetadata.scrollX;
                  y = y - pageMetadata.scrollY;
                }
              }
              
              clickX = x * scaleX;
              clickY = y * scaleY;
              hasClick = true;
            }
          }
          
          // If no coordinates but have bounding box, use center
          if (!hasClick && boundingBox) {
            // Scale bounding box if needed
            let scaleX = 1;
            let scaleY = 1;
            if (pageMetadata && pageMetadata.viewportWidth > 0 && pageMetadata.viewportHeight > 0) {
              scaleX = img.width / pageMetadata.viewportWidth;
              scaleY = img.height / pageMetadata.viewportHeight;
            }
            
            clickX = (boundingBox.x + boundingBox.width / 2) * scaleX;
            clickY = (boundingBox.y + boundingBox.height / 2) * scaleY;
            hasClick = true;
          }
          
          // Ensure coordinates are within image bounds
          clickX = Math.max(0, Math.min(clickX, img.width));
          clickY = Math.max(0, Math.min(clickY, img.height));
          
          // Draw bounding box highlight first (if available)
          if (boundingBox) {
            let scaleX = 1;
            let scaleY = 1;
            if (pageMetadata && pageMetadata.viewportWidth > 0 && pageMetadata.viewportHeight > 0) {
              scaleX = img.width / pageMetadata.viewportWidth;
              scaleY = img.height / pageMetadata.viewportHeight;
            }
            
            const boxX = boundingBox.x * scaleX;
            const boxY = boundingBox.y * scaleY;
            const boxWidth = boundingBox.width * scaleX;
            const boxHeight = boundingBox.height * scaleY;
            
            ctx.strokeStyle = 'rgba(0, 123, 255, 0.6)';
            ctx.lineWidth = 4;
            ctx.setLineDash([10, 5]);
            ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
            ctx.setLineDash([]);
          }
          
          // Draw click highlight (red circle with pulse effect) - like Scribe
          // Increased sizes for better visibility
          if (hasClick && clickX > 0 && clickY > 0 && clickX < img.width && clickY < img.height) {
            // Reset shadow before drawing
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // Outer glow circle (largest) - increased from 25 to 40
            ctx.beginPath();
            ctx.arc(clickX, clickY, 40, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
            ctx.fill();
            
            // Middle circle - increased from 18 to 30
            ctx.beginPath();
            ctx.arc(clickX, clickY, 30, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.35)';
            ctx.fill();
            
            // Inner circle - increased from 12 to 20
            ctx.beginPath();
            ctx.arc(clickX, clickY, 20, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.fill();
            
            // Solid red circle (click point) - increased from 8 to 14
            ctx.beginPath();
            ctx.arc(clickX, clickY, 14, 0, 2 * Math.PI);
            ctx.fillStyle = '#FF0000';
            ctx.fill();
            
            // White center dot - increased from 3 to 5
            ctx.beginPath();
            ctx.arc(clickX, clickY, 5, 0, 2 * Math.PI);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();
            
            // Add shadow for depth
            ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;
          }
          
          // Convert canvas to buffer
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'));
              return;
            }
            
            blob.arrayBuffer().then((arrayBuffer) => {
              resolve(Buffer.from(arrayBuffer));
            }).catch(reject);
          }, 'image/png');
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      // Load image directly from data URL
      img.src = dataUrl;
    });
  } catch (error) {
    console.error('Error adding click highlight:', error);
    return null;
  }
}

// Convert data URL to buffer for docx library
async function dataUrlToBuffer(dataUrl: string): Promise<Buffer | null> {
  try {
    // Remove data URL prefix (e.g., "data:image/png;base64,")
    const base64Data = dataUrl.includes(',') 
      ? dataUrl.split(',')[1] 
      : dataUrl;
    
    // Convert base64 to buffer
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return Buffer.from(bytes);
  } catch (error) {
    console.error('Error converting data URL to buffer:', error);
    return null;
  }
}

