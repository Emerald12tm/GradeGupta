import * as LocalAuthentication from 'expo-local-authentication';

/** Premium: Face ID / Touch ID lock. Face ID needs a development build — Expo Go falls back to passcode. */
export async function unlockWithBiometrics(): Promise<boolean> {
  const [hasHardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  if (!hasHardware || !enrolled) return true;
  const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock ShauryaGrades' });
  return res.success;
}
