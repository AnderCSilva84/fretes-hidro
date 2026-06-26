import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute.jsx'
import RouteErrorBoundary from '../components/RouteErrorBoundary.jsx'
import useAuth from '../context/useAuth.js'
import { getDefaultHomeRoute } from '../utils/accessControl.js'

const Login = lazy(() => import('../pages/Login.jsx'))
const Rastreio = lazy(() => import('../pages/Rastreio.jsx'))
const Caixa = lazy(() => import('../pages/Caixa.jsx'))
const Clientes = lazy(() => import('../pages/Clientes.jsx'))
const Dashboard = lazy(() => import('../pages/Dashboard.jsx'))
const Embarcacoes = lazy(() => import('../pages/Embarcacoes.jsx'))
const Encomendas = lazy(() => import('../pages/Encomendas.jsx'))
const Empresas = lazy(() => import('../pages/Empresas.jsx'))
const LogsUso = lazy(() => import('../pages/LogsUso.jsx'))
const ManifestoViagem = lazy(() => import('../pages/ManifestoViagem.jsx'))
const NovaComanda = lazy(() => import('../pages/NovaComanda.jsx'))
const NovaPassagem = lazy(() => import('../pages/NovaPassagem.jsx'))
const Passagens = lazy(() => import('../pages/Passagens.jsx'))
const Passageiros = lazy(() => import('../pages/Passageiros.jsx'))
const RetiradaEntrega = lazy(() => import('../pages/RetiradaEntrega.jsx'))
const RotasValores = lazy(() => import('../pages/RotasValores.jsx'))
const ScannerEmbarque = lazy(() => import('../pages/ScannerEmbarque.jsx'))
const ScannerRetirada = lazy(() => import('../pages/ScannerRetirada.jsx'))
const Terminais = lazy(() => import('../pages/Terminais.jsx'))
const Usuarios = lazy(() => import('../pages/Usuarios.jsx'))

function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={getDefaultHomeRoute(user)} replace />
}

export default function AppRoutes() {
  return (
    <RouteErrorBoundary>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center px-4 text-sm text-slate-500">
            Carregando modulo...
          </div>
        }
      >
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/rastreio/:codigo" element={<Rastreio />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route element={<ProtectedRoute requiredModule="fretes" />}>
              <Route path="/nova-comanda" element={<NovaComanda />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/encomendas" element={<Encomendas />} />
              <Route path="/scanner-retirada" element={<ScannerRetirada />} />
              <Route path="/retirada/:codigo" element={<RetiradaEntrega />} />
            </Route>
            <Route element={<ProtectedRoute requiredModule="passagens" />}>
              <Route path="/nova-passagem" element={<NovaPassagem />} />
              <Route path="/passageiros" element={<Passageiros />} />
              <Route path="/passagens" element={<Passagens />} />
              <Route path="/scanner-embarque" element={<ScannerEmbarque />} />
              <Route path="/manifesto/:viagemId" element={<ManifestoViagem />} />
            </Route>
            <Route path="/terminais" element={<Terminais />} />
            <Route path="/embarcacoes" element={<Embarcacoes />} />
            <Route path="/rotas-valores" element={<RotasValores />} />
            <Route path="/caixa" element={<Caixa />} />
          </Route>
          <Route element={<ProtectedRoute requiredPerfil="superadmin" />}>
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/empresas" element={<Empresas />} />
            <Route path="/logs-uso" element={<LogsUso />} />
          </Route>
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  )
}
