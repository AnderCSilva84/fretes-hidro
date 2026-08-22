import { createContext, useEffect, useMemo } from 'react'
import useAuth from './useAuth.js'
import useCollectionOnce from '../hooks/useCollectionOnce.js'
import { applyCompanyBrandingToDocument, DEFAULT_COMPANY_BRANDING, resolveCompanyBranding } from '../utils/companyBranding.js'
import { SYSTEM_ICON_SRC } from '../utils/systemConfig.js'

const BrandingContext = createContext({
  company: null,
  branding: {
    ...DEFAULT_COMPANY_BRANDING,
    logoUrl: SYSTEM_ICON_SRC,
  },
})

export function BrandingProvider({ children }) {
  const { user } = useAuth()
  const empresaId = user?.empresaId || ''
  const empresaNome = String(user?.empresaNome || '').trim().toLowerCase()
  const { items: empresas, reload } = useCollectionOnce('empresas')

  const company = !empresaId && !empresaNome
    ? null
    : empresas.find((item) => {
      if (empresaId) {
        return String(item.id || '') === String(empresaId)
      }

      return String(item.nome || '').trim().toLowerCase() === empresaNome
    }) || null

  const branding = useMemo(() => resolveCompanyBranding(company), [company])

  useEffect(() => {
    applyCompanyBrandingToDocument(branding)
  }, [branding])

  useEffect(() => {
    function handleCompanyBrandingRefresh() {
      void reload()
    }

    window.addEventListener('company-branding-updated', handleCompanyBrandingRefresh)
    return () => {
      window.removeEventListener('company-branding-updated', handleCompanyBrandingRefresh)
    }
  }, [reload])

  const value = useMemo(() => ({ company, branding }), [branding, company])

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
}

export { BrandingContext }
