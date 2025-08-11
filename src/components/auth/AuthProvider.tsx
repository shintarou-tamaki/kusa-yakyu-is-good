"use client";

import React, { useEffect, useState, createContext, useContext } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  provider: string | null;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    // 初期認証状態の確認
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      }
      setLoading(false);
    };

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await handleAuthSuccess(session.user);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    getInitialSession();

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('プロファイル取得エラー:', error);
        return;
      }

      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('プロファイル取得エラー:', error);
    }
  };

  const handleAuthSuccess = async (user: User) => {
    try {
      console.log('handleAuthSuccess called for user:', user.id);
      
      // ユーザープロファイルが存在するかチェック
      const { data: existingProfile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      console.log('Existing profile check:', { existingProfile, fetchError });

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('プロファイル取得時のエラー:', fetchError);
        return;
      }

      if (!existingProfile) {
        console.log('Creating new profile for user:', user.id);
        
        // 新規ユーザーの場合、プロファイルを作成
        const profileData = {
          id: user.id,
          display_name: user.user_metadata.full_name || user.email?.split('@')[0] || 'ユーザー',
          avatar_url: user.user_metadata.avatar_url || null,
          provider: user.app_metadata.provider || 'unknown'
        };

        console.log('Profile data to insert:', profileData);

        const { data: newProfile, error } = await supabase
          .from('user_profiles')
          .insert(profileData)
          .select()
          .single();

        console.log('Profile creation result:', { newProfile, error });

        if (error) {
          console.error('プロファイル作成エラー:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          
          // エラーが発生してもアプリを続行できるように、最小限のプロファイルを設定
          setProfile({
            id: user.id,
            display_name: user.user_metadata.full_name || user.email?.split('@')[0] || 'ユーザー',
            avatar_url: user.user_metadata.avatar_url || null,
            provider: user.app_metadata.provider || 'unknown',
            created_at: new Date().toISOString()
          });
          return;
        }
        setProfile(newProfile);
      } else {
        console.log('Using existing profile:', existingProfile);
        setProfile(existingProfile);
      }
    } catch (error) {
      console.error('ユーザープロファイル処理エラー:', error);
      
      // フォールバック: 最小限のプロファイルを設定
      setProfile({
        id: user.id,
        display_name: user.user_metadata.full_name || user.email?.split('@')[0] || 'ユーザー',
        avatar_url: user.user_metadata.avatar_url || null,
        provider: user.app_metadata.provider || 'unknown',
        created_at: new Date().toISOString()
      });
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
    if (error) throw error;
  };

  const signInWithGitHub = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = {
    user,
    profile,
    loading,
    signInWithGoogle,
    signInWithGitHub,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}