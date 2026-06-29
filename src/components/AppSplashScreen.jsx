import { SYSTEM_ICON_SRC, SYSTEM_NAME, SYSTEM_SPLASH_SRC } from '../utils/systemConfig.js'

export default function AppSplashScreen({ message = 'Carregando sistema...' }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#072d67]">
      <img
        src={SYSTEM_SPLASH_SRC}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,45,103,0.16)_0%,rgba(7,45,103,0.5)_62%,rgba(7,45,103,0.78)_100%)]" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center justify-end px-6 pb-14 pt-12 text-center text-white">
        <div className="rounded-[2rem] border border-white/24 bg-white/20 p-3 shadow-[0_24px_60px_rgba(2,12,27,0.28)] backdrop-blur-md">
          <img
            src={SYSTEM_ICON_SRC}
            alt={SYSTEM_NAME}
            className="h-16 w-16 scale-[1.15] rounded-[1.3rem] bg-white object-cover"
          />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.45em] text-blue-100/95">{SYSTEM_NAME}</p>
        <p className="mt-3 max-w-sm text-base font-medium text-white/92 sm:text-lg">{message}</p>
      </div>
    </div>
  )
}
