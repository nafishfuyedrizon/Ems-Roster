export async function readApiError(response: Response, fallback = "Request failed"): Promise<string> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    try {
      const json = await response.json();
      if (typeof json?.error === "string" && json.error.trim()) return json.error.trim();
      if (typeof json?.message === "string" && json.message.trim()) return json.message.trim();
    } catch {
      // Fall through to text parsing.
    }
  }

  const text = (await response.text()).trim();
  if (!text) return fallback;

  if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
    if (response.status === 404) {
      return "API route is not live on the backend yet. Redeploy the API service first.";
    }
    return "The API returned an HTML page instead of JSON. Check the API base URL and backend deploy.";
  }

  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}
