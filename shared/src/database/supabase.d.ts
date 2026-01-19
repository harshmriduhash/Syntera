/**
 * Shared Supabase Client
 * Standardized Supabase client initialization
 */
import { SupabaseClient } from '@supabase/supabase-js';
export declare function getSupabaseClient(): SupabaseClient;
export declare function verifySupabaseConnection(table: string): Promise<void>;
//# sourceMappingURL=supabase.d.ts.map