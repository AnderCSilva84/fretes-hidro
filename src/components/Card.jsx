export default function Card({ className = '', children }) {
  return <div className={`rounded-[1.75rem] border border-blue-100 bg-white/95 p-5 shadow-panel ${className}`}>{children}</div>
}
