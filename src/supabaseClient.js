import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uboanxjunejzjbonygnw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVib2FueGp1bmVqempib255Z253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjQxMDksImV4cCI6MjA5MjYwMDEwOX0.M-EAKeMPXZiTqbcktyHSzqGVilPvSIyU4xxk5ZlZS8o';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
