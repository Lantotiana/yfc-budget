import { createContext, useContext } from 'react'

export const DesktopToolbarContext = createContext({
  toolbar: { actions: null },
  setToolbar: () => {},
})

export function useDesktopToolbar() {
  return useContext(DesktopToolbarContext)
}
