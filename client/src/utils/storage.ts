import { useSyncExternalStore } from "react";

/**
 * Small browser-side persistence layer. Everything here lives in the user's
 * own browser (localStorage / sessionStorage): triage decisions, recent
 * searches and the "next lead" list. Every access is wrapped because storage
 * can throw (private mode, quota, disabled cookies) and the app must still work.
 */

export type LeadStatus = "shortlisted" | "skipped";
type StatusMap = Record<string, LeadStatus>;

const STATUS_KEY = "li:lead-status";
const RECENT_KEY = "li:recent-searches";
const LAST_SEARCH_KEY = "li:last-search-id";
const NAV_KEY = "li:nav";
const MAX_RECENT = 5;

function local(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function session(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

function read<T>(store: Storage | undefined, key: string, fallback: T): T {
  try {
    const raw = store?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(store: Storage | undefined, key: string, value: unknown): void {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable or full: the feature degrades, the app does not */
  }
}

/* ---------- Lead status (shortlist / skip) ---------- */

const EMPTY_STATUSES: StatusMap = {};
let statusCache: StatusMap = read<StatusMap>(local(), STATUS_KEY, EMPTY_STATUSES);
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  // Keep multiple tabs in sync.
  window.addEventListener("storage", (event) => {
    if (event.key === STATUS_KEY) {
      statusCache = read<StatusMap>(local(), STATUS_KEY, EMPTY_STATUSES);
      notify();
    }
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setLeadStatus(id: string, status: LeadStatus | null): void {
  const next = { ...statusCache };
  if (status) next[id] = status;
  else delete next[id];
  statusCache = next;
  write(local(), STATUS_KEY, next);
  notify();
}

export function setLeadStatuses(ids: string[], status: LeadStatus | null): void {
  const next = { ...statusCache };
  for (const id of ids) {
    if (status) next[id] = status;
    else delete next[id];
  }
  statusCache = next;
  write(local(), STATUS_KEY, next);
  notify();
}

export function useLeadStatuses(): StatusMap {
  return useSyncExternalStore(
    subscribe,
    () => statusCache,
    () => EMPTY_STATUSES
  );
}

/* ---------- Recent searches ---------- */

export interface RecentSearch {
  query: string;
  location: string;
  product?: string;
}

export function getRecentSearches(): RecentSearch[] {
  const list = read<RecentSearch[]>(local(), RECENT_KEY, []);
  return Array.isArray(list) ? list.slice(0, MAX_RECENT) : [];
}

export function addRecentSearch(
  query: string,
  location: string,
  product?: string
): void {
  const entry = {
    query: query.trim(),
    location: location.trim(),
    product: product?.trim() || undefined,
  };
  if (!entry.query || !entry.location) return;
  const same = (s: RecentSearch) =>
    s.query.toLowerCase() === entry.query.toLowerCase() &&
    s.location.toLowerCase() === entry.location.toLowerCase() &&
    (s.product || "").toLowerCase() === (entry.product || "").toLowerCase();
  const next = [entry, ...getRecentSearches().filter((s) => !same(s))].slice(
    0,
    MAX_RECENT
  );
  write(local(), RECENT_KEY, next);
}

/* ---------- Last search (so "Results" in the header returns to it) ---------- */

export function getLastSearchId(): string | undefined {
  return read<string | null>(local(), LAST_SEARCH_KEY, null) || undefined;
}

export function setLastSearchId(id: string | undefined): void {
  if (id) write(local(), LAST_SEARCH_KEY, id);
}

/* ---------- Review queue (powers Previous / Next on the detail page) ---------- */

interface NavList {
  ids: string[];
  backTo: string;
}

export function setNavList(ids: string[], backTo: string): void {
  const nav: NavList = { ids, backTo };
  write(session(), NAV_KEY, nav);
}

export function getNavList(): NavList | null {
  const nav = read<NavList | null>(session(), NAV_KEY, null);
  return nav && Array.isArray(nav.ids) ? nav : null;
}
