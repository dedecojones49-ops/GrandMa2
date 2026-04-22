import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    
    // Defer the initial check to avoid synchronous cascading renders warning
    const timeoutId = setTimeout(() => {
      const currentIsMobile = window.innerWidth < MOBILE_BREAKPOINT
      setIsMobile(currentIsMobile)
    }, 0)

    return () => {
      mql.removeEventListener("change", onChange)
      clearTimeout(timeoutId)
    }
  }, [])

  return !!isMobile
}
