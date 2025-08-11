// components/search/PublicGameSearch.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

interface Game {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  venue: string;
  game_type: string;
  status: string;
  participants: {
    participant_name: string;
    is_home: boolean;
    total_score: number;
  }[];
  created_by_profile?: {
    display_name: string;
  };
}

interface SearchFilters {
  keyword: string;
  gameType: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

export default function PublicGameSearch() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<SearchFilters>({
    keyword: '',
    gameType: '',
    status: '',
    dateFrom: '',
    dateTo: ''
  });

  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchGames();
  }, [filters]);

  const fetchGames = async () => {
    try {
      let query = supabase
        .from('games')
        .select(`
          *,
          game_participants(
            participant_name,
            is_home,
            total_score
          ),
          user_profiles!games_created_by_fkey(
            display_name
          )
        `)
        .eq('is_public', true) // 公開試合のみ
        .order('date', { ascending: false });

      // フィルター適用
      if (filters.keyword) {
        query = query.or(`title.ilike.%${filters.keyword}%,venue.ilike.%${filters.keyword}%`);
      }
      
      if (filters.gameType) {
        query = query.eq('game_type', filters.gameType);
      }
      
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      
      if (filters.dateFrom) {
        query = query.gte('date', filters.dateFrom);
      }
      
      if (filters.dateTo) {
        query = query.lte('date', filters.dateTo);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;
      setGames(data || []);
    } catch (error) {
      console.error('試合検索エラー:', error);
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
      gameType: '',
      status: '',
      dateFrom: '',
      dateTo: ''
    });
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      scheduled: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    const labels = {
      scheduled: '予定',
      in_progress: '進行中',
      completed: '完了',
      cancelled: '中止'
    };
    return {
      class: badges[status as keyof typeof badges] || badges.scheduled,
      label: labels[status as keyof typeof labels] || status
    };
  };

  const getGameTypeBadge = (gameType: string) => {
    const labels = {
      practice: '練習試合',
      official: '公式戦',
      tournament: 'トーナメント'
    };
    return labels[gameType as keyof typeof labels] || gameType;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">試合検索</h1>
          <p className="text-gray-600">公開されている試合を検索・閲覧できます</p>
        </div>

        {/* 検索フィルター */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label htmlFor="keyword" className="block text-sm font-medium text-gray-700 mb-1">
                キーワード
              </label>
              <input
                type="text"
                id="keyword"
                value={filters.keyword}
                onChange={(e) => handleFilterChange('keyword', e.target.value)}
                placeholder="試合名、会場名で検索"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="gameType" className="block text-sm font-medium text-gray-700 mb-1">
                試合種別
              </label>
              <select
                id="gameType"
                value={filters.gameType}
                onChange={(e) => handleFilterChange('gameType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">すべて</option>
                <option value="practice">練習試合</option>
                <option value="official">公式戦</option>
                <option value="tournament">トーナメント</option>
              </select>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                ステータス
              </label>
              <select
                id="status"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">すべて</option>
                <option value="scheduled">予定</option>
                <option value="in_progress">進行中</option>
                <option value="completed">完了</option>
              </select>
            </div>

            <div>
              <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-700 mb-1">
                開始日
              </label>
              <input
                type="date"
                id="dateFrom"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="dateTo" className="block text-sm font-medium text-gray-700 mb-1">
                終了日
              </label>
              <input
                type="date"
                id="dateTo"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mt-4 flex space-x-3">
            <button
              onClick={clearFilters}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              フィルターをクリア
            </button>
            <div className="text-sm text-gray-500 py-2">
              {games.length} 件の試合が見つかりました
            </div>
          </div>
        </div>

        {/* 試合一覧 */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-4">検索中...</p>
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mt-2">試合が見つかりませんでした</h3>
            <p className="text-gray-500 mt-1">検索条件を変更してもう一度お試しください</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {games.map(game => {
              const statusBadge = getStatusBadge(game.status);
              return (
                <div key={game.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-medium text-gray-900 truncate">{game.title}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusBadge.class}`}>
                      {statusBadge.label}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center space-x-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{new Date(game.date).toLocaleDateString('ja-JP')} {game.start_time || ''}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      <span>{game.venue}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.997 1.997 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span>{getGameTypeBadge(game.game_type)}</span>
                    </div>
                  </div>

                  {/* 対戦カード */}
                  {game.participants.length >= 2 && (
                    <div className="border-t pt-3 mb-3">
                      <div className="space-y-1">
                        {game.participants.map((participant, index) => (
                          <div key={index} className="flex justify-between items-center text-sm">
                            <span className={participant.is_home ? 'text-blue-600' : 'text-red-600'}>
                              {participant.participant_name} {participant.is_home ? '(後)' : '(先)'}
                            </span>
                            {game.status === 'completed' && (
                              <span className="font-bold">{participant.total_score}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 作成者情報 */}
                  <div className="border-t pt-3">
                    <p className="text-xs text-gray-500">
                      作成者: {game.created_by_profile?.display_name || '不明'}
                    </p>
                  </div>

                  {/* 詳細ボタン */}
                  <div className="mt-4">
                    <Link
                      href={`/games/${game.id}`}
                      className="w-full bg-blue-600 text-white text-center py-2 px-4 rounded-md hover:bg-blue-700 transition-colors block"
                    >
                      詳細を見る
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}