import { Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppSplashScreen from '../components/AppSplashScreen.jsx'
import ProtectedRoute from '../components/ProtectedRoute.jsx'
import RouteErrorBoundary from '../components/RouteErrorBoundary.jsx'
import useAuth from '../context/useAuth.js'
import { getDefaultHomeRoute } from '../utils/accessControl.js'
import { lazyWithRetry } from '../utils/lazyWithRetry.js'

const Login = lazyWithRetry(() => import('../pages/Login.jsx'), 'login')
const Rastreio = lazyWithRetry(() => import('../pages/Rastreio.jsx'), 'rastreio')
const Caixa = lazyWithRetry(() => import('../pages/Caixa.jsx'), 'caixa')
const Clientes = lazyWithRetry(() => import('../pages/Clientes.jsx'), 'clientes')
const Dashboard = lazyWithRetry(() => import('../pages/Dashboard.jsx'), 'dashboard')
const Embarcacoes = lazyWithRetry(() => import('../pages/Embarcacoes.jsx'), 'embarcacoes')
const Encomendas = lazyWithRetry(() => import('../pages/Encomendas.jsx'), 'encomendas')
const Empresas = lazyWithRetry(() => import('../pages/Empresas.jsx'), 'empresas')
const LogsUso = lazyWithRetry(() => import('../pages/LogsUso.jsx'), 'logs-uso')
const ManifestoViagem = lazyWithRetry(() => import('../pages/ManifestoViagem.jsx'), 'manifesto-viagem')
const NovaComanda = lazyWithRetry(() => import('../pages/NovaComanda.jsx'), 'nova-comanda')
const NovaPassagem = lazyWithRetry(() => import('../pages/NovaPassagem.jsx'), 'nova-passagem')
const Passagens = lazyWithRetry(() => import('../pages/Passagens.jsx'), 'passagens')
const Passageiros = lazyWithRetry(() => import('../pages/Passageiros.jsx'), 'passageiros')
const RetiradaEntrega = lazyWithRetry(() => import('../pages/RetiradaEntrega.jsx'), 'retirada-entrega')
const RotasValores = lazyWithRetry(() => import('../pages/RotasValores.jsx'), 'rotas-valores')
const ScannerEmbarque = lazyWithRetry(() => import('../pages/ScannerEmbarque.jsx'), 'scanner-embarque')
const ScannerRetirada = lazyWithRetry(() => import('../pages/ScannerRetirada.jsx'), 'scanner-retirada')
const Terminais = lazyWithRetry(() => import('../pages/Terminais.jsx'), 'terminais')
const Usuarios = lazyWithRetry(() => import('../pages/Usuarios.jsx'), 'usuarios')

function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={getDefaultHomeRoute(user)} replace />
}

export default function AppRoutes() {
  return (
    <RouteErrorBoundary>
      <Suspense
        fallback={
          <AppSplashScreen message="Carregando modulo..." />
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
