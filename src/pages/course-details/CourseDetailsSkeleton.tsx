import React from 'react';

export const CourseDetailsSkeleton: React.FC = () => (
  <div className="space-y-12 pb-20 w-full px-4 sm:px-6 lg:px-10 animate-pulse" dir="rtl">
    {/* Hero Skeleton */}
    <div className="relative rounded-[2rem] overflow-hidden bg-white/[0.03] border border-white/5 h-[420px] sm:h-[500px]">
      <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/50 to-transparent" />
      <div className="absolute bottom-0 inset-x-0 p-8 sm:p-12 flex flex-col lg:flex-row justify-between gap-8">
        <div className="flex-1 space-y-6">
          <div className="flex gap-3">
            <div className="h-7 w-24 rounded-full bg-white/5" />
            <div className="h-7 w-32 rounded-full bg-white/5" />
          </div>
          <div className="h-12 w-3/4 rounded-2xl bg-white/5" />
          <div className="h-8 w-1/2 rounded-xl bg-white/[0.03]" />
          <div className="flex gap-4">
            <div className="h-10 w-28 rounded-2xl bg-white/5" />
            <div className="h-10 w-36 rounded-2xl bg-white/5" />
          </div>
        </div>
        <div className="w-full lg:w-80 h-72 rounded-[2rem] bg-white/5 border border-white/5" />
      </div>
    </div>
    {/* Content Skeleton */}
    <div className="grid lg:grid-cols-12 gap-12">
      <div className="lg:col-span-8 space-y-8">
        <div className="h-8 w-40 rounded-xl bg-white/5" />
        <div className="h-40 rounded-3xl bg-white/[0.02] border border-white/5" />
        <div className="h-8 w-48 rounded-xl bg-white/5" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-2xl bg-white/[0.02] border border-white/5" />
        ))}
      </div>
      <div className="lg:col-span-4 space-y-6">
        <div className="h-80 rounded-[2rem] bg-white/[0.02] border border-white/5" />
        <div className="h-48 rounded-[2rem] bg-white/[0.02] border border-white/5" />
      </div>
    </div>
  </div>
);
