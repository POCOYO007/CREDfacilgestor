import React, { useEffect } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X, ChevronLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../utils/formatters';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// ---------------- Botões ----------------
const VARIANTES = {
  primary: 'bg-brand-primary text-white hover:bg-brand-primary-dark shadow-sm shadow-brand-primary/25',
  secondary: 'bg-brand-surface-2 text-text-primary hover:bg-overlay-strong',
  ghost: 'bg-transparent text-text-secondary hover:bg-brand-surface-2 hover:text-text-primary',
  outline: 'border border-border-strong bg-brand-surface text-text-primary hover:bg-brand-surface-2',
  danger: 'bg-danger text-white hover:bg-danger/90',
  'danger-soft': 'bg-danger/10 text-danger hover:bg-danger/15',
  success: 'bg-success text-white hover:bg-success/90 shadow-sm shadow-success/25',
};
const TAMANHOS = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-[15px] gap-2',
  lg: 'h-14 px-5 text-base gap-2',
};

export function Button({ className, variant = 'primary', size = 'md', block, loading, disabled, children, ...props }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none',
        VARIANTES[variant] || VARIANTES.primary,
        TAMANHOS[size] || TAMANHOS.md,
        block && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : children}
    </button>
  );
}

export function IconButton({ className, label, children, ...props }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn('w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-xl text-text-secondary hover:bg-brand-surface-2 hover:text-text-primary transition-colors active:scale-95', className)}
      {...props}
    >
      {children}
    </button>
  );
}

// ---------------- Campos ----------------
function Campo({ label, hint, error, children, className }) {
  return (
    <label className={cn('flex flex-col gap-1.5 w-full min-w-0', className)}>
      {label && <span className="text-[13px] font-semibold text-text-secondary">{label}</span>}
      {children}
      {error ? <span className="text-xs text-danger">{error}</span> : hint ? <span className="text-xs text-text-muted">{hint}</span> : null}
    </label>
  );
}

export function Input({ label, hint, error, icon, prefix, className, inputClassName, ...props }) {
  return (
    <Campo label={label} hint={hint} error={error} className={className}>
      <div className="relative flex items-center">
        {(icon || prefix) && (
          <span className="absolute left-3 text-text-muted text-sm font-semibold pointer-events-none flex items-center">{icon || prefix}</span>
        )}
        <input className={cn('input-field', (icon || prefix) && 'pl-10', error && 'border-danger', inputClassName)} {...props} />
      </div>
    </Campo>
  );
}

export function MoneyInput(props) {
  return <Input type="number" inputMode="decimal" step="0.01" min="0" prefix="R$" {...props} />;
}

export function Select({ label, hint, error, className, children, options, ...props }) {
  return (
    <Campo label={label} hint={hint} error={error} className={className}>
      <select className={cn('input-field appearance-none pr-9 bg-[length:16px] bg-no-repeat bg-[right_12px_center]', 'select-chevron')} {...props}>
        {options ? options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>) : children}
      </select>
    </Campo>
  );
}

export function Textarea({ label, hint, error, className, ...props }) {
  return (
    <Campo label={label} hint={hint} error={error} className={className}>
      <textarea className="input-field min-h-[84px] py-3" {...props} />
    </Campo>
  );
}

// ---------------- Superfícies ----------------
export function Card({ className, children, as: Tag = 'div', ...props }) {
  return <Tag className={cn('surface-card', className)} {...props}>{children}</Tag>;
}

export function Badge({ children, variant = 'neutral', className }) {
  const v = {
    success: 'bg-success/12 text-success',
    warning: 'bg-warning/15 text-warning-strong',
    danger: 'bg-danger/12 text-danger',
    neutral: 'bg-brand-surface-2 text-text-secondary',
    primary: 'bg-brand-primary/12 text-brand-primary',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide whitespace-nowrap', v[variant], className)}>
      {children}
    </span>
  );
}

/** Folha que sobe de baixo no celular e vira janela central no computador. */
export function Modal({ isOpen, onClose, title, subtitle, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const larguras = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 animate-fade" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn('relative w-full bg-brand-surface rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh] animate-sheet', larguras[size])}
      >
        <div className="sm:hidden mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-border-strong" />
        <div className="px-5 pt-3 sm:pt-5 pb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold leading-tight">{title}</h3>
            {subtitle && <p className="text-sm text-text-secondary mt-0.5 truncate">{subtitle}</p>}
          </div>
          <IconButton label="Fechar" onClick={onClose} className="-mr-2 -mt-1"><X className="w-5 h-5" /></IconButton>
        </div>
        <div className="px-5 pb-5 overflow-y-auto overscroll-contain flex-1">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-border-subtle flex items-center gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
export const Sheet = Modal;

// ---------------- Navegação / cabeçalhos ----------------
export function PageHeader({ title, subtitle, back, actions, className }) {
  const navigate = useNavigate();
  return (
    <div className={cn('flex items-start gap-2 mb-4', className)}>
      {back && (
        <IconButton label="Voltar" className="-ml-2 mt-0.5" onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}>
          <ChevronLeft className="w-6 h-6" />
        </IconButton>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-[22px] sm:text-2xl font-extrabold tracking-tight leading-tight truncate">{title}</h1>
        {subtitle && <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, action, className }) {
  return (
    <div className={cn('flex items-center justify-between gap-2 mt-6 mb-2.5 px-0.5', className)}>
      <h2 className="text-[13px] font-bold uppercase tracking-wider text-text-muted">{children}</h2>
      {action}
    </div>
  );
}

/** Botões de escolha lado a lado (ex.: Pagamento | Quitar | Só multa). */
export function Segmented({ options, value, onChange, className }) {
  return (
    <div className={cn('grid gap-1 p-1 rounded-xl bg-brand-surface-2', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'h-9 rounded-lg text-[13px] font-semibold transition-colors truncate px-1',
            value === o.value ? 'bg-brand-surface text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Filtros em "pílulas" com rolagem horizontal. */
export function Chips({ options, value, onChange, className }) {
  return (
    <div className={cn('flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'h-9 shrink-0 px-3.5 rounded-full text-[13px] font-semibold border transition-colors inline-flex items-center gap-1.5',
            value === o.value
              ? 'bg-text-primary text-brand-surface border-text-primary'
              : 'bg-brand-surface text-text-secondary border-border-subtle hover:text-text-primary',
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={cn('text-[11px] px-1.5 rounded-full', value === o.value ? 'bg-brand-surface/20' : 'bg-brand-surface-2', o.alert && o.count > 0 && value !== o.value && 'bg-danger/12 text-danger')}>
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------------- Dados ----------------
export function Money({ value, className }) {
  return <span className={cn('tabular-nums', className)}>{formatCurrency(value)}</span>;
}

const TONS = {
  default: 'text-text-primary',
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning-strong',
  primary: 'text-brand-primary',
};

export function Stat({ label, value, hint, tone = 'default', icon, onClick, className }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={cn('surface-card p-3.5 text-left min-w-0', onClick && 'active:scale-[0.98] transition-transform', className)}>
      <div className="flex items-center gap-1.5 text-text-muted">
        {icon}
        <span className="text-[12px] font-semibold truncate">{label}</span>
      </div>
      <div className={cn('mt-1 text-lg sm:text-xl font-extrabold tabular-nums truncate', TONS[tone])}>{value}</div>
      {hint && <div className="text-[12px] text-text-secondary mt-0.5 truncate">{hint}</div>}
    </Tag>
  );
}

export function Empty({ icon, title, text, action, className }) {
  return (
    <div className={cn('flex flex-col items-center text-center py-10 px-6', className)}>
      {icon && <div className="w-12 h-12 rounded-2xl bg-brand-surface-2 flex items-center justify-center text-text-muted mb-3">{icon}</div>}
      <p className="font-bold">{title}</p>
      {text && <p className="text-sm text-text-secondary mt-1 max-w-xs">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Linha "rótulo …… valor" usada em resumos. */
export function Row({ label, value, strong, tone = 'default', className }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 py-1.5 text-sm', className)}>
      <span className={cn('text-text-secondary', strong && 'text-text-primary font-semibold')}>{label}</span>
      <span className={cn('tabular-nums font-semibold text-right', strong && 'text-base font-extrabold', TONS[tone])}>{value}</span>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Buscar…', className }) {
  return (
    <div className={cn('relative', className)}>
      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field pl-10 h-11 bg-brand-surface"
      />
    </div>
  );
}
