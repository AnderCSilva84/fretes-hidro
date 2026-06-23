export default function Button({ className = '', variant = 'primary', ...props }) {
  const styles = {
    primary: 'border border-[#0a2d61] bg-gradient-to-b from-[#1c63e7] via-[#1657d8] to-[#0a2d61] text-white shadow-[0_18px_40px_rgba(22,87,216,0.32)] hover:from-[#3778ef] hover:via-[#1657d8] hover:to-[#07224b]',
    secondary: 'border-2 border-[#1657d8] bg-blue-50 text-[#0a2d61] shadow-[0_10px_24px_rgba(28,99,231,0.16)] hover:bg-blue-100',
    ghost: 'border border-blue-200 bg-white text-[#1657d8] hover:bg-blue-50',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
  }

  return (
    <button
      className={`inline-flex min-h-12 items-center justify-center rounded-2xl px-4 py-3 text-sm font-bold tracking-[0.01em] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${className}`}
      {...props}
    />
  )
}
