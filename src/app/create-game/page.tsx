"use client";

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import CreateGameForm from '@/components/game/CreateGameForm';

export default function CreateGamePage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <CreateGameForm />
      </div>
    </ProtectedRoute>
  );
}