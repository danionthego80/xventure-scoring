// Shared utility functions

/**
 * Generates a URL slug from a session title
 * e.g. "Team Away Day" -> "team-away-day"
 */
export function generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
}

/**
 * Calculates all 6 session time fields from a host start time.
 * Cadence: Host +10min end, Scoring starts +15min, ends +20min,
 * VirtualWorld same as Scoring.
 * Returns times formatted as dd/mm/yyyy hh:mm:ss AM/PM
 */
export function calculateSessionTimes(hostStart: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    const format = (d: Date): string => {
          const day = pad(d.getDate());
          const month = pad(d.getMonth() + 1);
          const year = d.getFullYear();
          let hours = d.getHours();
          const minutes = pad(d.getMinutes());
          const seconds = pad(d.getSeconds());
          const ampm = hours >= 12 ? 'PM' : 'AM';
          hours = hours % 12 || 12;
          return `${day}/${month}/${year} ${pad(hours)}:${minutes}:${seconds} ${ampm}`;
    };
    const addMins = (d: Date, m: number) => new Date(d.getTime() + m * 60000);
    return {
          HostStartTime: format(hostStart),
          HostEndTime: format(addMins(hostStart, 10)),
          ScoringStartTime: format(addMins(hostStart, 15)),
          ScoringEndTime: format(addMins(hostStart, 20)),
          VirtualWorldStartTime: format(addMins(hostStart, 15)),
          VirtualWorldEndTime: format(addMins(hostStart, 20)),
    };
}
