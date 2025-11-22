// Supabase database types
import { Step } from '../types';

export interface Database {
  public: {
    Tables: {
      documents: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          updated_at?: string;
        };
      };
      steps: {
        Row: {
          id: string;
          document_id: string;
          step_number: number;
          action: string;
          data: any; // JSONB - contains full StepData
          timestamp: number;
          url: string;
          title: string;
          screenshot_url: string | null;
          element_id: string | null;
          element_selector: string | null;
          click_x: number | null;
          click_y: number | null;
          viewport_width: number | null;
          viewport_height: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          step_number: number;
          action: string;
          data: any;
          timestamp: number;
          url: string;
          title: string;
          screenshot_url?: string | null;
          element_id?: string | null;
          element_selector?: string | null;
          click_x?: number | null;
          click_y?: number | null;
          viewport_width?: number | null;
          viewport_height?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          step_number?: number;
          action?: string;
          data?: any;
          timestamp?: number;
          url?: string;
          title?: string;
          screenshot_url?: string | null;
          element_id?: string | null;
          element_selector?: string | null;
          click_x?: number | null;
          click_y?: number | null;
          viewport_width?: number | null;
          viewport_height?: number | null;
        };
      };
    };
  };
}

export interface Document {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  steps?: Step[];
}

export interface DocumentWithSteps extends Document {
  steps: Step[];
}

