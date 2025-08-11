// components/search/PublicTeamSearch.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

interface Team {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  owner_profile?: {
    display_name: string;
  };
  recent_games_count?: number;
}

interface SearchFilters {
  keyword: string;
  sortBy: 'name' | 'member_count' | 'created_at';
}

export default function PublicTeamSearch() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<SearchFilters>({
    keyword: '',
    sortBy: 'member_count'
  });

  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchTeams();
  }, [filters]);

  const fetchTeams = async () => {
    try {
      let query = supabase
        .from('teams')
        .select(`
          *,
          team_members(count),
          user_profiles!teams_owner_id_fkey(
            display_name
          )
        `)
        .eq('is_public', true); // 公開チームのみ

      // キーワード検索
      if (filters.keyword) {
        query = query.or(`name.ilike.%${filters.keyword}%,description.ilike.%${filters.keyword}%`);
      }

      // ソート
      switch (filters.sortBy) {
        case 'name':
          query = query.order('name', { ascending: true });
          break;
        case 'member_count':
          query = query.order('team_members.count', { ascending: false });
          break;
        case 'created_at':
          query = query.order('created_at', { ascending: false });
          break;
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;

      // データを整形
      const formattedTeams = data?.map(team => ({
        ...team,
        member_count: team.team_members?.length || 0,
        owner_profile: team.user_profiles
      })) || [];

      setTeams(formattedTeams);
    } catch (error) {
      console.error('チーム検索エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      keyword: '',
      sortBy: 'member_count'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">チーム検索</h1>
          <p className="text-gray-600">公開されているチームを検索・閲覧できます</p>
        </div>

        {/* 検索フィルター */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="keyword" className="block text-sm font-medium text-gray-700 mb-1">
                キーワード
              </label>
              <input
                type="text"
                id="keyword"
                value={filters.keyword}
                onChange={(e) => handleFilterChange('keyword', e.target.value)}
                placeholder="チーム名、説明で検索"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="sortBy" className="block text-sm font-medium text-gray-700 mb-1">
                並び順
              </label>
              <select
                id="sortBy"
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="member_count">メンバー数順</option>
                <option value="name">チーム名順</option>
                <option value="created_at">作成日順</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-between items-center">
            <button
              onClick={clearFilters}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              フィルターをクリア
            </button>
            <div className="text-sm text-gray-500">
              {teams.length} 件のチームが見つかりました
            </div>
          </div>
        </div>

        {/* チーム一覧 */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-4">検索中...</p>
          </div>
        ) : teams.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mt-2">チームが見つかりませんでした</h3>
            <p className="text-gray-500 mt-1">検索条件を変更してもう一度お試しください</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map(team => (
              <div key={team.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-medium text-gray-900 truncate">{team.name}</h3>
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 text-xs font-medium rounded-full">
                    公開
                  </span>
                </div>

                {team.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{team.description}</p>
                )}

                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div className="flex items-center space-x-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                    <span>{team.member_count}人のメンバー</span>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>オーナー: {team.owner_profile?.display_name || '不明'}</span>
                  </div>
                </div>

                {/* 参加申請ボタン（ログインが必要） */}
                <div className="mt-4 space-y-2">
                  <Link
                    href={`/teams/${team.id}/public`}
                    className="w-full bg-blue-600 text-white text-center py-2 px-4 rounded-md hover:bg-blue-700 transition-colors block"
                  >
                    チーム詳細を見る
                  </Link>
                  <Link
                    href={`/login?redirect=/teams/${team.id}/join`}
                    className="w-full border border-blue-600 text-blue-600 text-center py-2 px-4 rounded-md hover:bg-blue-50 transition-colors block"
                  >
                    参加申請（ログインが必要）
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}