import { createClient } from '@supabase/supabase-js'

/**
 * Supabase Client Configuration
 * 
 * Setup Instructions:
 * 1. Go to https://supabase.com
 * 2. Create a new project
 * 3. Copy your project URL and anon key
 * 4. Create .env file (copy from .env.example)
 * 5. Add your credentials
 * 
 * Author: David Gabion Selorm
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!')
  console.log('Please create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')
