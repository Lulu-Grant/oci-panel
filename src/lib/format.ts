export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatRelativeTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });
  const mins = Math.round(diffMs / 60000);
  const hours = Math.round(diffMs / 3600000);
  const days = Math.round(diffMs / 86400000);
  if (abs < 60000) return "刚刚";
  if (abs < 3600000) return rtf.format(mins, "minute");
  if (abs < 86400000) return rtf.format(hours, "hour");
  return rtf.format(days, "day");
}

export function formatDateTimeWithRelative(value?: string | null) {
  if (!value) return "-";
  return `${formatDateTime(value)} · ${formatRelativeTime(value)}`;
}
