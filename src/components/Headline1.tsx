import React from 'react';

interface Headline1Props {
  children: React.ReactNode;
  className?: string;
}

export function Headline1({ children, className = '' }: Headline1Props) {
  return (
    <h1 className={`text-3xl font-bold text-gray-900 mb-6 ${className}`}>
      {children}
    </h1>
  );
}