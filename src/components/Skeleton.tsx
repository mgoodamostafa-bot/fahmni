import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'rect' }) => {
  const baseClasses = 'animate-pulse bg-white/[0.07]';
  const variantClasses = {
    text: 'h-4 w-full rounded-full',
    rect: 'h-32 w-full rounded-2xl',
    circle: 'h-12 w-12 rounded-full',
  };

  return <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} />;
};

export const CourseCardSkeleton: React.FC = () => (
  <div className="glass-card overflow-hidden p-0">
    <Skeleton className="aspect-video rounded-b-none" />
    <div className="p-6 space-y-4">
      <Skeleton variant="text" className="w-3/4 h-6" />
      <Skeleton variant="text" className="w-full h-4" />
      <Skeleton variant="text" className="w-1/2 h-4" />
      <div className="pt-4 border-t border-gray-100 dark:border-white/5 flex justify-between items-center">
        <Skeleton variant="text" className="w-24 h-4" />
        <Skeleton variant="text" className="w-20 h-4" />
      </div>
    </div>
  </div>
);

export const LessonSkeleton: React.FC = () => (
  <div className="space-y-10">
    <div className="flex items-center gap-4 mb-10">
      <Skeleton variant="text" className="w-24 h-4" />
      <Skeleton variant="text" className="w-4 h-4" />
      <Skeleton variant="text" className="w-48 h-4" />
    </div>
    <div className="grid lg:grid-cols-3 gap-12">
      <div className="lg:col-span-2 space-y-8">
        <Skeleton className="aspect-video rounded-3xl" />
        <div className="flex justify-between items-center">
          <Skeleton variant="text" className="w-1/3 h-8" />
          <div className="flex gap-4">
            <Skeleton className="w-32 h-12 rounded-2xl" />
            <Skeleton className="w-32 h-12 rounded-2xl" />
          </div>
        </div>
      </div>
      <div className="space-y-6">
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    </div>
  </div>
);

export const CourseDetailsSkeleton: React.FC = () => (
  <div className="space-y-12">
    <Skeleton className="h-[400px] w-full rounded-3xl" />
    <div className="grid lg:grid-cols-3 gap-12">
      <div className="lg:col-span-2 space-y-10">
        <div className="space-y-4">
          <Skeleton variant="text" className="w-1/4 h-8" />
          <Skeleton variant="text" className="w-full h-4" />
          <Skeleton variant="text" className="w-full h-4" />
          <Skeleton variant="text" className="w-3/4 h-4" />
        </div>
        <div className="space-y-4">
          <Skeleton variant="text" className="w-1/3 h-8" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
      <div className="space-y-8">
        <Skeleton className="h-80 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    </div>
  </div>
);
