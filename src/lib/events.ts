export interface EventRow {
  id: string;
  team_id: string;
  title: string;
  starts_at: string;
  location: string;
  opponent: string | null;
  has_transport: boolean;
  type: { name_he: string } | null;
}

export function eventTitle(ev: EventRow): string {
  const base = ev.title || ev.type?.name_he || 'אירוע';
  return ev.opponent ? `${base} מול ${ev.opponent}` : base;
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('he-IL', {
    weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
