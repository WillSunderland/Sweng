import React from 'react';

export const GradientBackground: React.FC = () => {
  return (
    <div className="absolute inset-0 overflow-hidden z-0">
      <div className="absolute w-[600px] h-[600px] rounded-full blur-[80px] opacity-60 bg-gradient-to-br from-blue-400/40 to-blue-200/30 -top-[200px] -left-[100px] animate-pulse" />
      <div className="absolute w-[500px] h-[500px] rounded-full blur-[80px] opacity-60 bg-gradient-to-br from-purple-400/35 to-purple-200/25 -top-[100px] -right-[150px]" />
      <div className="absolute w-[450px] h-[450px] rounded-full blur-[80px] opacity-60 bg-gradient-to-br from-pink-400/30 to-pink-200/20 top-[200px] right-[20%]" />
      <div className="absolute w-[400px] h-[400px] rounded-full blur-[80px] opacity-60 bg-gradient-to-br from-cyan-400/30 to-cyan-200/20 bottom-[100px] left-[10%]" />
      <div className="absolute w-[350px] h-[350px] rounded-full blur-[80px] opacity-60 bg-gradient-to-br from-emerald-400/25 to-emerald-200/15 -bottom-[100px] right-[15%]" />
    </div>
  );
};
