// Document CRUD operations using Supabase
import { supabase } from './config';
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
  async deleteDocument(documentId: string) {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    return { error };
  },
};

