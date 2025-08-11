"use client";

import { Headline1 } from "@/components/Headline1";
import React, { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from '@/components/auth/AuthProvider';

interface CreateGameForm {
  title: string;
  gameDate: string;
  gameTime: string;
  gameType: 'practice' | 'official' | 'tournament';
  venue: string;
  description: string;
  isPublic: boolean;
  participationType: 'individual' | 'team';
  selectedTeamId?: string;
  opponentName: string;
  myParticipantName: string;
  battingOrder: 'first' | 'second';
}

interface Team {
  id: string;
  name: string;
  member_count: number;
}

export default function CreateGameForm() {
  const searchParams = useSearchParams();
  const initialTeamId = searchParams.get('teamId');

  const [formData, setFormData] = useState<CreateGameForm>({
    title: '',
    gameDate: '',
    gameTime: '',
    gameType: 'practice',
    venue: '',
    description: '',
    isPublic: true,
    participationType: initialTeamId ? 'team' : 'individual',
    selectedTeamId: initialTeamId || undefined,
    opponentName: '',
    myParticipantName: '',
    battingOrder: 'first'
  });

  const [teams, setTeams] = useState<Team[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { user } = useAuth();
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    fetchUserTeams();
  }, [user]);

  const fetchUserTeams = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('team_members')
        .select(`
          teams (
            id,
            name,
            team_members (count)
          )
        `)
        .eq('user_id', user.id);

      if (data) {
        const formattedTeams = data.map(item => ({
          id: item.teams.id,
          name: item.teams.name,
          member_count: item.teams.team_members?.length || 0
        }));
        setTeams(formattedTeams);
      }
    } catch (error) {
      console.error('チーム取得エラー:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      if (!user) throw new Error('ログインが必要です');

      // バリデーション
      if (!formData.title || !formData.gameDate || !formData.venue || !formData.opponentName) {
        throw new Error('必須項目を入力してください');
      }

      if (formData.participationType === 'individual' && !formData.myParticipantName) {
        throw new Error('参加者名を入力してください');
      }

      // 1. 試合を作成
      const { data: newGame, error: gameError } = await supabase
        .from('games')
        .insert({
          title: formData.title,
          date: formData.gameDate,
          start_time: formData.gameTime || null,
          venue: formData.venue,
          game_type: formData.gameType,
          description: formData.description || null,
          is_public: formData.isPublic,
          created_by: user.id,
          status: 'scheduled'
        })
        .select()
        .single();

      if (gameError) throw gameError;

      // 2. 参加者を追加
      let myParticipantName = '';
      if (formData.participationType === 'team' && formData.selectedTeamId) {
        const selectedTeam = teams.find(t => t.id === formData.selectedTeamId);
        myParticipantName = selectedTeam?.name || '';
      } else {
        myParticipantName = formData.myParticipantName;
      }

      const participants = [
        {
          game_id: newGame.id,
          team_id: formData.participationType === 'team' ? formData.selectedTeamId : null,
          user_id: formData.participationType === 'individual' ? user.id : null,
          participant_name: myParticipantName,
          is_home: formData.battingOrder === 'second',
          total_score: 0,
          hits: 0,
          errors: 0
        },
        {
          game_id: newGame.id,
          team_id: null,
          user_id: null,
          participant_name: formData.opponentName,
          is_home: formData.battingOrder === 'first',
          total_score: 0,
          hits: 0,
          errors: 0
        }
      ];

      const { error: participantsError } = await supabase
        .from('game_participants')
        .insert(participants);

      if (participantsError) throw participantsError;

      // 3. 成功メッセージと画面遷移
      alert('試合が作成されました！');
      router.push(`/games/${newGame.id}`);

    } catch (err: any) {
      setError(err.message || '試合の作成中にエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Headline1>新しい試合を作成</Headline1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* 参加方法の選択 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            参加方法 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="relative">
              <input
                type="radio"
                name="participationType"
                value="individual"
                checked={formData.participationType === 'individual'}
                onChange={handleInputChange}
                className="sr-only"
              />
              <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                formData.participationType === 'individual' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <div className="text-center">
                  <svg className="mx-auto h-8 w-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <h3 className="font-medium">個人で参加</h3>
                  <p className="text-sm text-gray-500">個人名義で試合を作成</p>
                </div>
              </div>
            </label>

            <label className="relative">
              <input
                type="radio"
                name="participationType"
                value="team"
                checked={formData.participationType === 'team'}
                onChange={handleInputChange}
                className="sr-only"
              />
              <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                formData.participationType === 'team' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <div className="text-center">
                  <svg className="mx-auto h-8 w-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM9 9a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h3 className="font-medium">チームで参加</h3>
                  <p className="text-sm text-gray-500">所属チーム名義で作成</p>
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* 参加者名/チーム選択 */}
        {formData.participationType === 'individual' ? (
          <div>
            <label htmlFor="myParticipantName" className="block text-sm font-medium text-gray-700 mb-1">
              参加者名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="myParticipantName"
              name="myParticipantName"
              value={formData.myParticipantName}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例：田中太郎"
            />
          </div>
        ) : (
          <div>
            <label htmlFor="selectedTeamId" className="block text-sm font-medium text-gray-700 mb-1">
              参加チーム <span className="text-red-500">*</span>
            </label>
            <select
              id="selectedTeamId"
              name="selectedTeamId"
              value={formData.selectedTeamId || ''}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">チームを選択してください</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.name} ({team.member_count}人)
                </option>
              ))}
            </select>
            {teams.length === 0 && (
              <p className="text-sm text-gray-500 mt-1">
                参加できるチームがありません。先にチームを作成してください。
              </p>
            )}
          </div>
        )}

        {/* 基本情報 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              試合名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例：練習試合、○○カップなど"
            />
          </div>

          <div>
            <label htmlFor="gameType" className="block text-sm font-medium text-gray-700 mb-1">
              試合種別
            </label>
            <select
              id="gameType"
              name="gameType"
              value={formData.gameType}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="practice">練習試合</option>
              <option value="official">公式戦</option>
              <option value="tournament">トーナメント</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="gameDate" className="block text-sm font-medium text-gray-700 mb-1">
              試合日 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="gameDate"
              name="gameDate"
              value={formData.gameDate}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="gameTime" className="block text-sm font-medium text-gray-700 mb-1">
              開始時刻 (任意)
            </label>
            <input
              type="time"
              id="gameTime"
              name="gameTime"
              value={formData.gameTime}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label htmlFor="venue" className="block text-sm font-medium text-gray-700 mb-1">
            会場 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="venue"
            name="venue"
            value={formData.venue}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="例：夢の島公園野球場"
          />
        </div>

        <div>
          <label htmlFor="opponentName" className="block text-sm font-medium text-gray-700 mb-1">
            対戦相手 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="opponentName"
            name="opponentName"
            value={formData.opponentName}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="対戦相手のチーム名または個人名"
          />
        </div>

        <div>
          <label htmlFor="battingOrder" className="block text-sm font-medium text-gray-700 mb-1">
            攻撃順 <span className="text-red-500">*</span>
          </label>
          <select
            id="battingOrder"
            name="battingOrder"
            value={formData.battingOrder}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="first">先攻</option>
            <option value="second">後攻</option>
          </select>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            備考 (任意)
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="試合に関する追加情報があれば入力"
          />
        </div>

        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="isPublic"
              checked={formData.isPublic}
              onChange={handleInputChange}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              公開試合（他のユーザーが閲覧できます）
            </span>
          </label>
        </div>

        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            戻る
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? '作成中...' : '試合を作成'}
          </button>
        </div>
      </form>
    </div>
  );
}