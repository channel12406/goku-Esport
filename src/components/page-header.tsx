import { type ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  center?: boolean;
};

export function PageHeader({ eyebrow, title, subtitle, action, center = false }: PageHeaderProps) {
  return (
    <div
      className={`flex flex-col gap-4 ${center ? "items-center text-center" : "sm:flex-row sm:items-center sm:justify-between"}`}
    >
      <div className={center ? "flex flex-col items-center" : ""}>
        {eyebrow && (
          <span className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#fc0]/30 bg-[#fc0]/10 px-3 py-0.5 text-xs font-medium text-[#ffd740]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#fc0]" />
            {eyebrow}
          </span>
        )}
        <h1 className="font-display text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p
            className={`mt-1.5 max-w-2xl text-xs text-white/50 sm:text-sm lg:text-base ${center ? "mx-auto" : ""}`}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
