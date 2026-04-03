/** Strip common Clinic Support markdown for plain-text email bodies. */
export function markdownChatToPlainText(md: string): string {
  let s = md.replace(/\r\n/g, "\n");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/_([^_]+)_/g, "$1");
  return s.trim();
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function plainTextToEmailHtml(plain: string): string {
  const esc = escapeHtml(plain);
  return `<div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.55;color:#18181b">${esc.replace(/\n/g, "<br/>")}</div>`;
}
