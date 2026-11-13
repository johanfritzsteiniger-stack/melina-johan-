export type List = {
  id: string;
  name: string;
  emoji: string | null;
  expires_on: string | null;
  archived_at: string | null;
  sort: number;
  created_at: string;
};

export type ListItem = {
  id: string;
  list_id: string;
  text: string;
  quantity: string | null;
  done_at: string | null;
  done_by: string | null;
  sort: number;
  created_at: string;
};

export const LIST_COLUMNS = "id, name, emoji, expires_on, archived_at, sort, created_at";
export const ITEM_COLUMNS = "id, list_id, text, quantity, done_at, done_by, sort, created_at";

/** Liste ist im Archiv: manuell archiviert oder Ablaufdatum vorbei. */
export function isListArchived(list: List, today: string): boolean {
  return Boolean(list.archived_at) || Boolean(list.expires_on && today && today > list.expires_on);
}

/** Datum, nach dem im Archiv sortiert wird. */
export function archivedDate(list: List): string {
  return list.archived_at?.slice(0, 10) ?? list.expires_on ?? list.created_at.slice(0, 10);
}
