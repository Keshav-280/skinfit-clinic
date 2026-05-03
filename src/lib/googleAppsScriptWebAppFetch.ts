/**
 * Google Apps Script `/exec` returns **302** to `script.googleusercontent.com/macros/echo?...`.
 * The echo URL only allows **GET**; sending POST there yields **405** + Drive HTML.
 * Match `curl -L --data-binary` (no `-X POST`): POST once to `/exec`, then **GET** the `Location`.
 * Drain intermediate response bodies so the connection pool does not stall redirects.
 *
 * @see https://dev.to/googleworkspace/youre-probably-using-curl-wrong-with-your-google-apps-script-web-app-1ed8
 */
function isGoogleAppsScriptEchoUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === "script.googleusercontent.com" &&
      u.pathname.includes("/macros/echo")
    );
  } catch {
    return false;
  }
}

async function drainResponseBody(res: Response): Promise<void> {
  try {
    await res.arrayBuffer();
  } catch {
    /* ignore */
  }
}

/** POST JSON to a deployed web app; follows Google’s redirect chain correctly. */
export async function postGoogleAppsScriptWebAppJson(
  execUrl: string,
  secret: string,
  jsonBody: string
): Promise<Response> {
  const postHeaders: Record<string, string> = {
    "content-type": "application/json",
    "x-skinfit-sheet-secret": secret,
  };
  let url = execUrl;
  for (let hop = 0; hop < 8; hop++) {
    const useGet = isGoogleAppsScriptEchoUrl(url);
    const res = await fetch(url, {
      method: useGet ? "GET" : "POST",
      headers: useGet
        ? { accept: "application/json, text/plain, */*" }
        : postHeaders,
      body: useGet ? undefined : jsonBody,
      redirect: "manual",
    });
    if (res.status < 300 || res.status >= 400) {
      return res;
    }
    await drainResponseBody(res);
    const loc = res.headers.get("location");
    if (!loc) return res;
    url = new URL(loc, url).href;
  }
  const useGet = isGoogleAppsScriptEchoUrl(url);
  return fetch(url, {
    method: useGet ? "GET" : "POST",
    headers: useGet
      ? { accept: "application/json, text/plain, */*" }
      : postHeaders,
    body: useGet ? undefined : jsonBody,
    redirect: "manual",
  });
}
