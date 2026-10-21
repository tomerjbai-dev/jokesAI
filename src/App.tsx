import { useState } from 'react'
import { hasAgeConsent, saveAgeConsent } from './ageConsent.ts'
import AgeGate from './screens/AgeGate.tsx'
import AccessDenied from './screens/AccessDenied.tsx'
import Home from './screens/Home.tsx'
import Offline from './screens/Offline.tsx'
import { useOnlineStatus } from './useOnlineStatus.ts'

type Screen = 'age-gate' | 'denied' | 'home'

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => (hasAgeConsent() ? 'home' : 'age-gate'))
  const { online, recheck } = useOnlineStatus()

  let current
  if (screen === 'home') current = <Home />
  else if (screen === 'denied') current = <AccessDenied onBack={() => setScreen('age-gate')} />
  else
    current = (
      <AgeGate
        onConfirm={() => {
          saveAgeConsent()
          setScreen('home')
        }}
        // A decline is not persisted, so a refresh shows the declaration again.
        onDecline={() => setScreen('denied')}
      />
    )

  // While offline the current screen is hidden, not unmounted, so its topic and joke survive.
  return (
    <>
      {!online && <Offline onRetry={recheck} />}
      <div className="screen-host" hidden={!online}>
        {current}
      </div>
    </>
  )
}
