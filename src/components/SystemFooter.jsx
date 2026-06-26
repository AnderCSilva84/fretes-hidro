export default function SystemFooter({ className = '' }) {
  return (
    <div className={`text-center text-xs leading-relaxed text-slate-500 ${className}`.trim()}>
      <p>Desenvolvido por Anderson C Silva</p>
      <p>ACS Informática</p>
    </div>
  )
}
