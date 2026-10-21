const STORAGE_KEY = 'ageConfirmed'

// Storage may be blocked (private mode, disabled site data); treat that as "no consent".
export function hasAgeConsent(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function saveAgeConsent(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true')
  } catch {
    // Consent still applies for this session; it just won't persist.
  }
}
