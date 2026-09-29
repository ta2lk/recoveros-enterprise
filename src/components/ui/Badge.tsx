import React from 'react';

export type StatusTone = 'emerald' | 'amber' | 'rose' | 'slate' | 'blue';

interface StatusMarkerProps {
  label: string;
  tone?: StatusTone;
  icon?: React.ReactNode;
}

/**
 * StatusMarker: Implements Zero-Pill & Metadata Discipline.
 * Renders unboxed text with a subtle dot indicator and clean typography,
 * strictly avoiding garish rounded-full pill capsules or candy borders.
 */
export const StatusMarker: React.FC<StatusMarkerProps> = ({
  label,
  tone = 'slate',
  icon,
}) => {
  const dotTones: Record<StatusTone, string> = {
    emerald: 'bg-emerald-600 dark:bg-emerald-400',
    amber: 'bg-amber-600 dark:bg-amber-400',
    rose: 'bg-rose-600 dark:bg-rose-400',
    slate: 'bg-neutral-400 dark:bg-neutral-500',
    blue: 'bg-sky-600 dark:bg-sky-400',
  };

  const textTones: Record<StatusTone, string> = {
    emerald: 'text-emerald-700 dark:text-emerald-300 font-medium',
    amber: 'text-amber-700 dark:text-amber-300 font-medium',
    rose: 'text-rose-700 dark:text-rose-300 font-medium',
    slate: 'text-neutral-600 dark:text-neutral-400 font-normal',
    blue: 'text-sky-700 dark:text-sky-300 font-medium',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${textTones[tone]}`}>
      {icon ? (
        icon
      ) : (
        <span className={`w-1.5 h-1.5 rounded-full ${dotTones[tone]}`} aria-hidden="true" />
      )}
      <span>{label}</span>
    </span>
  );
};
