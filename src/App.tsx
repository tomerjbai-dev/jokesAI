import { useState } from 'react'
import { hasAgeConsent, saveAgeConsent } from './ageConsent.ts'
import AgeGate from './screens/AgeGate.tsx'
import AccessDenied from './screens/AccessDenied.tsx'
import Home from './screens/Home.tsx'

type Screen = 'age-gate' | 'denied' | 'home'

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => (hasAgeConsent() ? 'home' : 'age-gate'))

  if (screen === 'home') return <Home />

  if (screen === 'denied') return <AccessDenied onBack={() => setScreen('age-gate')} />

  return (
    <AgeGate
      onConfirm={() => {
        saveAgeConsent()
        setScreen('home')
      }}
      // A decline is not persisted, so a refresh shows the declaration again.
      onDecline={() => setScreen('denied')}
    />
  )
}
