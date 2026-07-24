import clsx from 'clsx';

const variants = {
  primary: 'bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] text-white hover:opacity-90 hover:shadow-lg hover:shadow-[var(--primary)]/25 active:scale-[0.98]',
  secondary: 'bg-white/70 dark:bg-white/5 backdrop-blur-sm border border-gray-200/70 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10',
  danger: 'bg-gradient-to-r from-red-500 to-rose-600 text-white hover:opacity-90 active:scale-[0.98]',
  ghost: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-white/10',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-sm',
};

export default function Button({ children, variant = 'primary', size = 'md', className = '', onClick, type = 'button', disabled = false, ...props }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      {...props}
      className={clsx(
        'transition-all duration-200 font-medium rounded-xl flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--primary)]/50 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </button>
  );
}
