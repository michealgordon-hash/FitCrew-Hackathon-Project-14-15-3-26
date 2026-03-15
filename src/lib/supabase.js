import { createClient } from '@supabase/supabase-js'

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxcWh0c3piY3lzd25qdW5oanlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NjkyMzcsImV4cCI6MjA4OTE0NTIzN30.ucCz6NAkx9_zjCwgl2fGQXuD9W78YJLAjEOtGl09n4A'
const SUPABASE_URL = 'https://dqphtszbcyswnjunhjf.supabase.co'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)