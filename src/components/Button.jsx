export default function Button({ className = '', variant = 'primary', ...props }) {
  const styles = {
    primary: 'app-button--primary',
    secondary: 'app-button--secondary',
    ghost: 'app-button--ghost',
    success: 'app-button--success',
    danger: 'app-button--danger',
  }

  return (
    <button
      className={`app-button inline-flex min-h-12 max-w-full items-center justify-center whitespace-normal rounded-2xl px-4 py-3 text-center text-sm font-bold leading-tight tracking-[0.01em] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${className}`}
      {...props}
    />
  )
}
