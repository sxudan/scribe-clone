// Step CRUD operations and screenshot upload
import { supabase, SCREENSHOT_BUCKET } from './config';
import { Step } from '../types';

export const stepService = {
  // Upload screenshot to Supabase Storage
  async uploadScreenshot(documentId: string, stepNumber: number, screenshotDataUrl: string): Promise<{ url: string | null; error: any }> {
    try {
      if (!screenshotDataUrl) {
        console.warn('No screenshot data URL provided');
        return { url: null, error: new Error('No screenshot data URL') };
      }

      if (!screenshotDataUrl.startsWith('data:image')) {
        console.warn('Invalid screenshot data URL format:', screenshotDataUrl.substring(0, 50));
        return { url: null, error: new Error('Invalid screenshot data URL format') };
      }

      console.log('Starting screenshot upload...', {
        documentId,
        stepNumber,
        dataUrlLength: screenshotDataUrl.length,
        bucket: SCREENSHOT_BUCKET
      });

      // Convert data URL to blob
      const response = await fetch(screenshotDataUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch screenshot data: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      console.log('Screenshot blob created:', { size: blob.size, type: blob.type });

      if (blob.size === 0) {
        console.error('Screenshot blob is empty');
        return { url: null, error: new Error('Screenshot blob is empty') };
      }

      // Get current user ID for folder structure
      // The storage policy expects: {user_id}/{document_id}/...
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      
      if (!userId) {
        console.error('User not authenticated');
        return { url: null, error: new Error('User not authenticated') };
      }
      
      // Create file path matching policy: {user_id}/{document_id}/step_{stepNumber}.png
      const filePath = `${userId}/${documentId}/step_${stepNumber}_${Date.now()}.png`;
      
      console.log('File path structure:', { filePath, userId, documentId });

      console.log(`Uploading to bucket: "${SCREENSHOT_BUCKET}", path: ${filePath}`);
      console.log('Supabase client initialized:', !!supabase);
      console.log('Storage API available:', !!supabase.storage);
      console.log('Current user:', userId);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(SCREENSHOT_BUCKET)
        .upload(filePath, blob, {
          contentType: 'image/png',
          upsert: true, // Allow overwriting if file exists
        });

      if (uploadError) {
        console.error('Error uploading screenshot to Supabase:', {
          error: uploadError,
          message: uploadError.message,
          statusCode: (uploadError as any).statusCode,
          bucket: SCREENSHOT_BUCKET,
          path: filePath,
          userId: userId
        });
        
        // Provide helpful error message
        if (uploadError.message.includes('not found') || uploadError.message.includes('does not exist')) {
          return { 
            url: null, 
            error: new Error(`Bucket "${SCREENSHOT_BUCKET}" not found. Please create it in Supabase Dashboard > Storage.`) 
          };
        }
        
        if (uploadError.message.includes('permission') || uploadError.message.includes('policy')) {
          return { 
            url: null, 
            error: new Error(`Permission denied. Please check storage policies for bucket "${SCREENSHOT_BUCKET}". See STORAGE_POLICIES.md for setup instructions.`) 
          };
        }
        
        return { url: null, error: uploadError };
      }

      console.log('Screenshot uploaded successfully:', uploadData);

      // Get public URL (works for both public and private buckets, but private needs signed URLs for access)
      const { data: urlData } = supabase.storage
        .from(SCREENSHOT_BUCKET)
        .getPublicUrl(filePath);

      const url = urlData?.publicUrl || null;

      if (!url) {
        console.warn('Could not get public URL. Bucket might be private.');
        // For private buckets, we still return the path - you can generate signed URLs later
        return { url: filePath, error: null };
      }

      console.log('Screenshot URL generated:', url);
      return { url, error: null };
    } catch (error) {
      console.error('Error processing screenshot:', error);
      const err = error as Error;
      return { url: null, error: err };
    }
  },

  // Save steps to database
  async saveSteps(documentId: string, steps: Step[]) {
    console.log('=== Starting saveSteps ===');
    console.log('Document ID:', documentId);
    console.log('Steps count:', steps.length);
    console.log('Bucket name:', SCREENSHOT_BUCKET);
    
    // Try to verify bucket exists (but don't fail if we can't list buckets due to permissions)
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) {
      console.warn('Could not list buckets (may be permission issue, will try upload anyway):', bucketError);
    } else if (buckets) {
      console.log('Available buckets:', buckets.map(b => b.name));
      const bucketExists = buckets.some(b => b.name === SCREENSHOT_BUCKET);
      if (!bucketExists) {
        console.warn(`Bucket "${SCREENSHOT_BUCKET}" not found in list. Will attempt upload anyway.`);
      }
    }
    
    // First, delete existing steps for this document
    const { error: deleteError } = await supabase
      .from('steps')
      .delete()
      .eq('document_id', documentId);

    if (deleteError) {
      console.error('Error deleting existing steps:', deleteError);
      return { data: null, error: deleteError };
    }

    // If no steps to save, return early
    if (steps.length === 0) {
      return { data: [], error: null };
    }

    console.log(`Saving ${steps.length} steps for document ${documentId}`);
    console.log('Steps with screenshots:', steps.filter(s => s.screenshot).length);

    // Upload screenshots and prepare step data
    const stepsWithScreenshots = await Promise.all(
      steps.map(async (step) => {
        let screenshotUrl: string | null = null;

        // Upload screenshot if it exists
        if (step.screenshot) {
          console.log(`[Step ${step.id}] Uploading screenshot...`, {
            hasScreenshot: !!step.screenshot,
            screenshotLength: step.screenshot.length,
            screenshotPreview: step.screenshot.substring(0, 50)
          });
          
          const { url, error } = await this.uploadScreenshot(
            documentId,
            step.id,
            step.screenshot
          );
          
          if (error) {
            console.error(`[Step ${step.id}] Screenshot upload error:`, error);
          } else if (url) {
            screenshotUrl = url;
            console.log(`[Step ${step.id}] Screenshot uploaded successfully:`, url);
          } else {
            console.warn(`[Step ${step.id}] No URL returned from upload`);
          }
        } else {
          console.log(`[Step ${step.id}] No screenshot to upload`);
        }

        // Extract commonly accessed fields for quick querying
        const elementId = step.data.element?.id || null;
        const elementSelector = step.data.element?.selector || null;
        const clickX = step.data.coordinates?.x || null;
        const clickY = step.data.coordinates?.y || null;
        const viewportWidth = step.data.pageMetadata?.viewportWidth || step.data.element?.viewport.width || null;
        const viewportHeight = step.data.pageMetadata?.viewportHeight || step.data.element?.viewport.height || null;

        // Use step.id as step_number, but ensure it's unique by using index if needed
        // The step.id should already be unique, but we'll use it directly
        return {
          document_id: documentId,
          step_number: step.id, // This should be unique per document
          action: step.action,
          data: step.data, // Full data object with all metadata
          timestamp: step.timestamp,
          url: step.url,
          title: step.title,
          screenshot_url: screenshotUrl,
          element_id: elementId,
          element_selector: elementSelector,
          click_x: clickX ? Math.round(clickX) : null,
          click_y: clickY ? Math.round(clickY) : null,
          viewport_width: viewportWidth,
          viewport_height: viewportHeight,
        };
      })
    );

    // Check for duplicate step_numbers before inserting
    const stepNumbers = stepsWithScreenshots.map(s => s.step_number);
    const uniqueStepNumbers = new Set(stepNumbers);
    if (stepNumbers.length !== uniqueStepNumbers.size) {
      console.error('Duplicate step numbers detected:', stepNumbers);
      // Fix duplicates by using array index + 1
      stepsWithScreenshots.forEach((step, index) => {
        step.step_number = index + 1;
      });
    }

    // Insert all steps in a transaction-like manner (Supabase handles this)
    // Use upsert to handle any edge cases
    const { data, error } = await supabase
      .from('steps')
      .upsert(stepsWithScreenshots, {
        onConflict: 'document_id,step_number',
        ignoreDuplicates: false
      })
      .select();

    return { data, error };
  },

  // Get steps for a document
  async getSteps(documentId: string) {
    const { data, error } = await supabase
      .from('steps')
      .select('*')
      .eq('document_id', documentId)
      .order('step_number', { ascending: true });

    if (error) {
      return { data: null, error };
    }

    // Convert to Step format
    const steps: Step[] = (data || []).map((dbStep) => ({
      id: dbStep.step_number,
      action: dbStep.action as Step['action'],
      data: dbStep.data,
      timestamp: dbStep.timestamp,
      url: dbStep.url,
      title: dbStep.title,
      screenshot: dbStep.screenshot_url || undefined,
    }));

    return { data: steps, error: null };
  },

  // Update a single step
  async updateStep(stepId: string, updates: Partial<Step>) {
    const { data, error } = await supabase
      .from('steps')
      .update(updates)
      .eq('id', stepId)
      .select()
      .single();

    return { data, error };
  },

  // Delete a step
  async deleteStep(stepId: string) {
    const { error } = await supabase
      .from('steps')
      .delete()
      .eq('id', stepId);

    return { error };
  },
};

