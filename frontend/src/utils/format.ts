export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function timeAgo(dateStr: string): string {
  const time = new Date(dateStr).getTime();
  if (Number.isNaN(time)) return "—";
  const seconds = Math.floor((Date.now() - time) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function daysUntilExpiry(createdAt: string): number {
  const created = new Date(createdAt);
  const expiry = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
  const now = new Date();
  return Math.max(
    0,
    Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );
}
