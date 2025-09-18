import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = createServiceRoleClient()

    // SQL to set up the profiles table and trigger
    const setupSQL = `
      -- Enable UUID extension
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- Create profiles table if not exists
      CREATE TABLE IF NOT EXISTS public.profiles (
        user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        full_name TEXT,
        zip_code TEXT,
        city TEXT,
        survey_complete BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Enable RLS on profiles
      ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

      -- Drop existing policies if they exist
      DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
      DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
      DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

      -- Create policies
      CREATE POLICY "Users can view own profile" ON public.profiles
        FOR SELECT USING (auth.uid() = user_id);

      CREATE POLICY "Users can update own profile" ON public.profiles
        FOR UPDATE USING (auth.uid() = user_id);

      CREATE POLICY "Users can insert own profile" ON public.profiles
        FOR INSERT WITH CHECK (auth.uid() = user_id);

      -- Function to handle new user creation
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO public.profiles (user_id, full_name, zip_code)
        VALUES (
          NEW.id,
          NEW.raw_user_meta_data->>'full_name',
          NEW.raw_user_meta_data->>'zip_code'
        );
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      -- Drop existing trigger if exists
      DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

      -- Create trigger for new user signup
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

      -- Grant necessary permissions
      GRANT USAGE ON SCHEMA public TO anon, authenticated;
      GRANT ALL ON public.profiles TO anon, authenticated;
    `

    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', {
      query: setupSQL
    }).single()

    if (error) {
      console.error('Database setup error:', error)
      // Try running the SQL directly (Supabase v2 method)
      // Note: This might not work with RLS, but worth trying
      return NextResponse.json({
        message: 'Please run the SQL manually in Supabase SQL Editor',
        error: error.message,
        sql: setupSQL
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Database setup complete'
    })

  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Please run the setup.sql file manually in Supabase SQL Editor'
    }, { status: 500 })
  }
}