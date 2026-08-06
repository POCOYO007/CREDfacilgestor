import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function Button({ className, variant = "primary", size = "md", ...props }) {
  const variants = {
    primary: "btn-primary",
    secondary: "bg-brand-surface-2 text-text-primary hover:bg-brand-surface-2/80",
    danger: "bg-danger text-white hover:bg-danger/80",
    ghost: "bg-transparent text-text-secondary hover:bg-brand-surface-2 font-semibold",
    outline: "border border-border-subtle text-text-primary hover:bg-brand-surface-2"
  };

  const sizes = {
    sm: "px-3 h-9 text-sm",
    md: "px-4 h-11",
    lg: "px-6 h-14 text-lg"
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

export function Input({ label, error, icon, className, inputClassName, ...props }) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-sm font-medium text-text-secondary">{label}</label>}
      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center text-text-muted">
            {icon}
          </div>
        )}
        <input
          className={cn(
            "input-field", 
            icon && "pl-10",
            error && "border-danger focus:border-danger", 
            className,
            inputClassName
          )}
          {...props}
        />
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <div className={cn("bento-card", className)} {...props}>
      {children}
    </div>
  );
}

export function Badge({ children, variant = "neutral", className }) {
  const variants = {
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    danger: "bg-danger/10 text-danger border-danger/20",
    neutral: "bg-brand-surface-2 text-text-secondary border-border-subtle",
    primary: "bg-brand-primary/10 text-brand-primary border-brand-primary/20"
  };

  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold border", variants[variant], className)}>
      {children}
    </span>
  );
}

export function Modal({ isOpen, onClose, title, children, footer }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="px-6 py-4 border-t border-border-subtle bg-brand-surface-2 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
