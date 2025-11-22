// Document CRUD operations using Supabase
import { supabase, SCREENSHOT_BUCKET } from './config';
import { Step } from '../types';
import { DocumentWithSteps } from './types';

export const documentService = {
  // Create a new document
  async createDocument(userId: string, title: string, description?: string) {
    const { data, error } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        title,
        description: description || null,
      })
      .select()
      .single();

    return { data, error };
  },

  // Get all documents for a user
  async getDocuments(userId: string) {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return { data, error };
  },

  // Get a single document by ID
  async getDocument(documentId: string) {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    return { data, error };
  },

  // Get document with all steps
  async getDocumentWithSteps(documentId: string): Promise<{ data: DocumentWithSteps | null; error: any }> {
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return { data: null, error: docError };
    }

    const { data: steps, error: stepsError } = await supabase
      .from('steps')
      .select('*')
      .eq('document_id', documentId)
      .order('step_number', { ascending: true });

    if (stepsError) {
      return { data: null, error: stepsError };
    }

    // Convert database steps to Step format
    const convertedSteps: Step[] = steps.map((dbStep: any) => ({
      id: dbStep.step_number,
      action: dbStep.action as Step['action'],
      data: dbStep.data,
      timestamp: dbStep.timestamp,
      url: dbStep.url,
      title: dbStep.title,
      screenshot: dbStep.screenshot_url || undefined,
    }));

    return {
      data: {
        ...document,
        steps: convertedSteps,
      },
      error: null,
    };
  },

  // Update a document
  async updateDocument(documentId: string, updates: { title?: string; description?: string }) {
    const { data, error } = await supabase
      .from('documents')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)
      .select()
      .single();

    return { data, error };
  },

  // Delete a document (cascade will delete steps)
  // Also deletes all associated screenshots from Supabase Storage
  async deleteDocument(documentId: string) {
    try {
      // First, get all steps with screenshot URLs before deleting
      const { data: steps, error: stepsError } = await supabase
        .from('steps')
        .select('screenshot_url')
        .eq('document_id', documentId);

      if (stepsError) {
        console.error('Error fetching steps for deletion:', stepsError);
        // Continue with document deletion even if we can't fetch steps
      } else if (steps && steps.length > 0) {
        // Get current user ID for folder structure
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id;

        if (userId) {
          // Extract file paths from screenshot URLs and delete from storage
          const filePaths: string[] = [];
          
          for (const step of steps) {
            if (step.screenshot_url) {
              let filePath = step.screenshot_url;
              
              // If it's a full URL, extract the path
              // URL format: https://...supabase.co/storage/v1/object/public/bucket/path
              // or: https://...supabase.co/storage/v1/object/sign/bucket/path
              if (filePath.startsWith('http')) {
                try {
                  const url = new URL(filePath);
                  // Extract path after /storage/v1/object/public/ or /storage/v1/object/sign/
                  const pathMatch = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/[^\/]+\/(.+)$/);
                  if (pathMatch) {
                    filePath = pathMatch[1];
                  } else {
                    // Fallback: try to extract from end of path
                    const pathParts = url.pathname.split('/');
                    const bucketIndex = pathParts.findIndex(p => p === SCREENSHOT_BUCKET);
                    if (bucketIndex >= 0 && bucketIndex < pathParts.length - 1) {
                      filePath = pathParts.slice(bucketIndex + 1).join('/');
                    }
                  }
                } catch (e) {
                  // If URL parsing fails, assume it's already a path
                  console.warn('Could not parse screenshot URL, assuming it\'s a path:', filePath);
                }
              }
              
              // Ensure filePath starts with userId/documentId structure
              // Screenshots are stored as: userId/documentId/step_...
              if (!filePath.startsWith(userId)) {
                // If path doesn't start with userId, it might be just the filename
                // or it might be documentId/filename
                const pathParts = filePath.split('/');
                if (pathParts.length === 1) {
                  // Just filename, prepend userId/documentId
                  filePath = `${userId}/${documentId}/${filePath}`;
                } else if (pathParts[0] === documentId) {
                  // documentId/filename, prepend userId
                  filePath = `${userId}/${filePath}`;
                } else if (pathParts[0] !== userId) {
                  // Some other structure, try to construct properly
                  filePath = `${userId}/${documentId}/${pathParts[pathParts.length - 1]}`;
                }
              }
              
              // Validate that path contains userId and documentId
              if (filePath.includes(userId) && filePath.includes(documentId)) {
                filePaths.push(filePath);
              } else {
                console.warn(`Skipping invalid screenshot path: ${filePath}`);
              }
            }
          }

          // Delete all screenshot files from storage
          if (filePaths.length > 0) {
            console.log(`Deleting ${filePaths.length} screenshots from storage...`);
            
            // Delete files one by one (Supabase doesn't support batch delete easily)
            const deletePromises = filePaths.map(async (filePath) => {
              const { error: deleteError } = await supabase.storage
                .from(SCREENSHOT_BUCKET)
                .remove([filePath]);
              
              if (deleteError) {
                console.warn(`Failed to delete screenshot ${filePath}:`, deleteError);
                // Don't throw - continue deleting other files
              } else {
                console.log(`Deleted screenshot: ${filePath}`);
              }
            });

            await Promise.allSettled(deletePromises);
            
            // Also try to delete the entire folder (more efficient)
            // This will delete all files in the folder: userId/documentId/
            try {
              const { data: folderFiles, error: listError } = await supabase.storage
                .from(SCREENSHOT_BUCKET)
                .list(`${userId}/${documentId}/`);
              
              if (!listError && folderFiles && folderFiles.length > 0) {
                const folderFilePaths = folderFiles.map(file => `${userId}/${documentId}/${file.name}`);
                const { error: folderDeleteError } = await supabase.storage
                  .from(SCREENSHOT_BUCKET)
                  .remove(folderFilePaths);
                
                if (folderDeleteError) {
                  console.warn('Error deleting folder files:', folderDeleteError);
                } else {
                  console.log(`Deleted ${folderFilePaths.length} files from folder ${userId}/${documentId}/`);
                }
              }
            } catch (folderError) {
              console.warn('Error listing/deleting folder:', folderError);
              // Continue with document deletion
            }
          }
        } else {
          console.warn('User not authenticated, cannot delete screenshots from storage');
        }
      }

      // Now delete the document (this will cascade delete steps in database)
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      return { error };
    } catch (error) {
      console.error('Error in deleteDocument:', error);
      // Still try to delete the document even if screenshot deletion failed
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);
      
      return { error: dbError || error };
    }
  },
};

