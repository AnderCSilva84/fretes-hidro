import { Component } from 'react'
import { useLocation } from 'react-router-dom'

class RouteErrorBoundaryInner extends Component {
  constructor(props) {
    super(props)
    this.state = {
      error: null,
    }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Erro de renderizacao capturado na rota.', error, errorInfo)
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <div className="w-full max-w-md rounded-[1.75rem] border border-amber-200 bg-white p-6 text-center shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-700">Falha na tela</p>
            <h1 className="mt-3 text-2xl font-bold text-slate-950">Nao foi possivel abrir esta pagina.</h1>
            <p className="mt-3 text-sm text-slate-600">
              Tente navegar novamente. Se a falha persistir, recarregue o sistema para restaurar a tela.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[1rem] bg-[#1657d8] px-4 text-sm font-semibold text-white transition hover:bg-[#1248b5]"
            >
              Recarregar sistema
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default function RouteErrorBoundary({ children }) {
  const location = useLocation()
  const resetKey = `${location.pathname}${location.search}${location.hash}`

  return <RouteErrorBoundaryInner resetKey={resetKey}>{children}</RouteErrorBoundaryInner>
}
