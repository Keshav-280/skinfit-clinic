/**
 * Patient web (my.skinfitwellness.in) always shows 0-10 scores.
 * Mobile still honors clinic-visit unlock via the same APIs.
 */
export function webPatientScoresUnlocked(_fromServer = false): boolean {
  return true;
}
