/**
 * API key for face_analysis_tool (header `X-API-Key`).
 * Worker/web use FACE_ANALYSIS_SERVICE_SECRET; inference container uses FACE_ANALYSIS_API_KEY.
 * Both must be the same value in .env.local.
 */
export function getFaceAnalysisServiceSecret(): string | undefined {
  const secret = process.env.FACE_ANALYSIS_SERVICE_SECRET?.trim();
  if (secret) return secret;
  const apiKey = process.env.FACE_ANALYSIS_API_KEY?.trim();
  return apiKey || undefined;
}
