import React from 'react';
import { Database, Plus, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { useI18n } from '../../i18n';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondaryAction,
  icon,
}) => {
  const { t, isRtl } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl my-6">
      <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 mb-4">
        {icon || <Database className="w-6 h-6" />}
      </div>
      <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
        {title || t.noDataTitle}
      </h3>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mb-6">
        {description || t.noDataDesc}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {onAction && (
          <Button variant="primary" size="md" onClick={onAction}>
            <Plus className="w-4 h-4" />
            <span>{actionLabel || t.connectFirstDataSource}</span>
          </Button>
        )}
        {onSecondaryAction && (
          <Button variant="outline" size="md" onClick={onSecondaryAction}>
            <span>{secondaryLabel || t.uploadFirstDocument}</span>
            <ArrowRight className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
          </Button>
        )}
      </div>
    </div>
  );
};
