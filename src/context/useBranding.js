import { useContext } from 'react'
import { BrandingContext } from './BrandingContext.jsx'

export default function useBranding() {
  return useContext(BrandingContext)
}
