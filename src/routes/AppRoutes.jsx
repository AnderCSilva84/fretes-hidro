import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute.jsx'

const Login = lazy(() => import('../pages/Login.jsx'))
const Rastreio = lazy(() => import('../pages/Rastreio.jsx'))
const Caixa = lazy(() => import('../pages/Caixa.jsx'))
const Clientes = lazy(() => import('../pages/Clientes.jsx'))
const Dashboard = lazy(() => import('../pages/Dashboard.jsx'))
const Embarcacoes = lazy(() => import('../pages/Embarcacoes.jsx'))
const Encomendas = lazy(() => import('../pages/Encomendas.jsx'))
const NovaComanda = lazy(() => import('../pages/NovaComanda.jsx'))
const RotasValores = lazy(() => import('../pages/RotasValores.jsx'))
const Terminais = lazy(() => import('../pages/Terminais.jsx'))
const Usuarios = lazy(() => import('../pages/Usuarios.jsx'))

export default function AppRoutes() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-4 text-sm text-slate-500">
          Carregando módulo...
        </div>
      }
    >
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/rastreio/:codigo" element={<Rastreio />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/nova-comanda" element={<NovaComanda />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/terminais" element={<Terminais />} />
          <Route path="/embarcacoes" element={<Embarcacoes />} />
          <Route path="/rotas-valores" element={<RotasValores />} />
          <Route path="/encomendas" element={<Encomendas />} />
          <Route path="/caixa" element={<Caixa />} />
        </Route>
        <Route element={<ProtectedRoute requiredPerfil="superadmin" />}>
          <Route path="/usuarios" element={<Usuarios />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}
