import type { ReactNode } from "react";

type Props = {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Card({ title, action, children, className = "" }: Props) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
          {title ? <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2> : <span />}
          {action}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
