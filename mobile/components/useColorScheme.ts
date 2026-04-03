/**
 * Web portal is light-only; ignore system dark mode on native.
 */
export function useColorScheme(): 'light' {
  return 'light';
}
