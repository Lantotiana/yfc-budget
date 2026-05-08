import useMediaQuery from '../hooks/useMediaQuery'
import DesktopLayout from './DesktopLayout'
import MobileLayout from './MobileLayout'

export default function AppLayout({ user, userData, children }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  if (isDesktop) {
    return (
      <DesktopLayout user={user} userData={userData}>
        {children}
      </DesktopLayout>
    )
  }

  return <MobileLayout>{children}</MobileLayout>
}
