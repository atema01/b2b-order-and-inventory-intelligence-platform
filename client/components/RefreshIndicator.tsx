import React from 'react';

type RefreshIndicatorProps = {
  visible: boolean;
};

const RefreshIndicator: React.FC<RefreshIndicatorProps> = ({ visible }) => {
  if (!visible) return null;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-amber-700">
      <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
      Refreshing
    </div>
  );
};

export default RefreshIndicator;
