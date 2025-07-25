// Date formatting utilities for activity table

// Get relative time string for tooltip usage
function formatTimeAgo(
  timestamp: number,
  options: { long?: boolean } = {},
): string {
  const now = Date.now();
  const diffMs = now - timestamp * 1000;
  const { long = false } = options;

  // Handle future dates
  if (diffMs < 0) {
    return long ? 'In the future' : 'Future';
  }

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 10) {
    return long ? 'Just now' : 'Now';
  } else if (diffSeconds < 60) {
    return long ? `${diffSeconds} seconds ago` : `${diffSeconds}s`;
  } else if (diffMinutes < 60) {
    return long
      ? `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
      : `${diffMinutes}m`;
  } else if (diffHours < 24) {
    return long
      ? `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
      : `${diffHours}h`;
  } else if (diffDays < 7) {
    return long
      ? `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
      : `${diffDays}d`;
  } else if (diffWeeks < 4) {
    return long
      ? `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`
      : `${diffWeeks}w`;
  } else if (diffMonths < 12) {
    return long
      ? `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`
      : `${diffMonths}mo`;
  } else {
    return long
      ? `${diffYears} year${diffYears === 1 ? '' : 's'} ago`
      : `${diffYears}y`;
  }
}

// Format for activity table - balance between brevity and clarity
export function formatActivityDate(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp * 1000;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    // For older dates, show actual date
    const date = new Date(timestamp * 1000);
    const today = new Date();
    const currentYear = today.getFullYear();
    const dateYear = date.getFullYear();

    if (dateYear === currentYear) {
      // Same year - don't show year
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } else {
      // Different year - show year
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }
}
