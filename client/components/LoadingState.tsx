import React from 'react';

interface LoadingStateProps {
  message?: string;
  compact?: boolean;
}

const SkeletonLine: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-full bg-slate-200/80 ${className}`}></div>
);

const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading...', compact = false }) => (
  <div className={`${compact ? 'py-8' : 'py-10 sm:py-14'} px-4`}>
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="space-y-3">
        <SkeletonLine className="h-6 w-40 sm:h-8 sm:w-56" />
        <SkeletonLine className="h-4 w-64 max-w-full" />
      </div>

      <div className={`grid gap-4 ${compact ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'}`}>
        {[0, 1, 2, 3].slice(0, compact ? 2 : 4).map((item) => (
          <div key={item} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <SkeletonLine className="mb-4 h-3 w-24" />
            <SkeletonLine className="mb-3 h-8 w-28" />
            <SkeletonLine className="h-3 w-20" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-4">
          {[0, 1].map((item) => (
            <div key={item} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <SkeletonLine className="mb-4 h-5 w-32" />
              <SkeletonLine className="mb-3 h-4 w-full" />
              <SkeletonLine className="mb-3 h-4 w-4/5" />
              <SkeletonLine className="h-10 w-32 rounded-2xl" />
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm xl:col-span-8">
          <SkeletonLine className="mb-5 h-5 w-40" />
          <div className="space-y-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 px-4 py-3">
                <div className="space-y-2">
                  <SkeletonLine className="h-3 w-20" />
                  <SkeletonLine className="h-4 w-36 sm:w-48" />
                </div>
                <div className="space-y-2 text-right">
                  <SkeletonLine className="ml-auto h-4 w-20" />
                  <SkeletonLine className="ml-auto h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-sm font-medium text-slate-400">{message}</p>
    </div>
  </div>
);

export default LoadingState;
