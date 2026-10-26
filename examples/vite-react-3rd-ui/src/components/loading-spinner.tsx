import type { FC } from "react";

export const LoadingSpinner: FC = () => {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
    </div>
  );
};
