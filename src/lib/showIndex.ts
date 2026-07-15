import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from './firebase';
import { getShowPath, getTestShowPath } from './mode';
import type { LiveActivityState, LiveTriviaState, ShowMeta } from '../types/firebaseContract';
import { LIVE_STATE_MAX_AGE_MS } from './showStatus';

export interface IndexedShow {
  showId: string;
  title: string;
  startDate: string;
  status?: string;
  isTestShow?: boolean;
  is_test?: boolean;
  test?: boolean;
  venueName?: string;
  ticketUrl?: string;
  orgId?: string;
  platformOwner?: 'hollywood-groove';
  schemaVersion?: number;
  publishedAt?: number;
}

export interface IndexedShowWithMode extends IndexedShow {
  isTestShowMode: boolean;
}

type LiveShowState = {
  trivia?: (LiveTriviaState & { updatedAt?: number; timestamp?: number }) | null;
  activity?: (LiveActivityState & { updatedAt?: number; timestamp?: number }) | null;
};

export interface ActiveShowSummary {
  showId: string;
  title: string;
  meta: ShowMeta;
  startedAt: number;
  isTestShow: boolean;
}

export interface UseIndexedShowsResult {
  rows: IndexedShow[];
  loading: boolean;
}

export interface UseActiveShowsResult {
  shows: ActiveShowSummary[];
  loading: boolean;
}

type ActiveShowsOptions = {
  includeProd?: boolean;
  includeTest?: boolean;
  enabled?: boolean;
  onError?: (error: unknown) => void;
};

const EMPTY_INDEXED_SHOWS: IndexedShow[] = [];

export function getShowsIndexBasePath(isTestShow: boolean): string {
  return isTestShow ? 'test/shows_index' : 'shows_index';
}

function showPath(showId: string, isTestShow: boolean, suffix?: string): string {
  return isTestShow ? getTestShowPath(showId, suffix) : getShowPath(showId, suffix);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringOrDefault(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function indexedShowFromValue(showId: string, value: unknown, isTestShowMode: boolean): IndexedShow | null {
  if (!isRecord(value)) return null;

  const title = stringOrDefault(value.title).trim();
  if (!title) return null;

  const isTestShow =
    booleanOrDefault(value.isTestShow, booleanOrDefault(value.is_test, booleanOrDefault(value.test, isTestShowMode)));

  return {
    showId,
    title,
    startDate: stringOrDefault(value.startDate),
    status: stringOrDefault(value.status) || undefined,
    isTestShow,
    is_test: isTestShow,
    test: isTestShow,
    venueName: stringOrDefault(value.venueName) || undefined,
    ticketUrl: stringOrDefault(value.ticketUrl) || undefined,
    orgId: stringOrDefault(value.orgId) || undefined,
    platformOwner: value.platformOwner === 'hollywood-groove' ? 'hollywood-groove' : undefined,
    schemaVersion: numberOrDefault(value.schemaVersion, 1),
    publishedAt: numberOrDefault(value.publishedAt, 0),
  };
}

export function indexedShowToMeta(row: IndexedShow, isTestShowMode = false): ShowMeta {
  const isTestShow =
    row.isTestShow ??
    row.is_test ??
    row.test ??
    isTestShowMode;

  return {
    orgId: row.orgId,
    platformOwner: row.platformOwner,
    title: row.title,
    startDate: row.startDate,
    venueName: row.venueName ?? '',
    schemaVersion: row.schemaVersion ?? 1,
    publishedAt: row.publishedAt ?? 0,
    isTestShow,
    ticketUrl: row.ticketUrl,
  };
}

export function useIndexedShows(isTestShow = false, enabled = true): UseIndexedShowsResult {
  const [rows, setRows] = useState<IndexedShow[]>(EMPTY_INDEXED_SHOWS);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setRows(EMPTY_INDEXED_SHOWS);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onValue(
      ref(db, getShowsIndexBasePath(isTestShow)),
      (snapshot) => {
        const value = snapshot.val() as Record<string, unknown> | null;
        const nextRows = value
          ? Object.entries(value).flatMap(([showId, showValue]) => {
              const row = indexedShowFromValue(showId, showValue, isTestShow);
              return row ? [row] : [];
            })
          : EMPTY_INDEXED_SHOWS;

        setRows(nextRows);
        setLoading(false);
      },
      (error) => {
        console.warn('Failed to load show index:', error);
        setRows(EMPTY_INDEXED_SHOWS);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [enabled, isTestShow]);

  return { rows, loading };
}

function modeKey(isTestShow: boolean, showId: string): string {
  return `${isTestShow ? 'test' : 'prod'}:${showId}`;
}

function liveTimestamp(value: unknown): number | null {
  if (!isRecord(value)) return null;
  const timestamp = value.updatedAt ?? value.timestamp ?? value.startedAt;
  return typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : null;
}

function isFresh(timestamp: number | null, now: number): boolean {
  return timestamp !== null && now - timestamp <= LIVE_STATE_MAX_AGE_MS;
}

export function activeStartedAtFromLiveState(live: LiveShowState | null | undefined, now = Date.now()): number | null {
  const trivia = live?.trivia;
  const triviaTimestamp = liveTimestamp(trivia);
  const triviaPhase = trivia?.phase;
  const triviaActive = Boolean(
    triviaPhase &&
    triviaPhase !== 'idle' &&
    isFresh(triviaTimestamp, now),
  );

  const activity = live?.activity;
  const activityTimestamp = liveTimestamp(activity);
  const activityActive = Boolean(
    activity?.status === 'active' &&
    isFresh(activityTimestamp, now),
  );

  const startedAt = Math.max(
    triviaActive ? triviaTimestamp ?? 0 : 0,
    activityActive ? activityTimestamp ?? 0 : 0,
  );

  return startedAt > 0 ? startedAt : null;
}

export function useActiveShows({
  includeProd = true,
  includeTest = false,
  enabled = true,
  onError,
}: ActiveShowsOptions = {}): UseActiveShowsResult {
  const [result, setResult] = useState<UseActiveShowsResult>({
    shows: [],
    loading: enabled,
  });

  useEffect(() => {
    if (!enabled || (!includeProd && !includeTest)) {
      setResult({ shows: [], loading: false });
      return;
    }

    let disposed = false;
    const indexRows: Record<'prod' | 'test', IndexedShow[]> = {
      prod: EMPTY_INDEXED_SHOWS,
      test: EMPTY_INDEXED_SHOWS,
    };
    const indexLoaded = {
      prod: !includeProd,
      test: !includeTest,
    };
    const liveValues = new Map<string, LiveShowState | null>();
    const liveLoaded = new Set<string>();
    const liveUnsubscribes = new Map<string, () => void>();
    const indexUnsubscribes: Array<() => void> = [];

    const desiredRows = (): IndexedShowWithMode[] => [
      ...(includeProd ? indexRows.prod.map((row) => ({ ...row, isTestShowMode: false })) : []),
      ...(includeTest ? indexRows.test.map((row) => ({ ...row, isTestShowMode: true })) : []),
    ];

    const publish = () => {
      if (disposed) return;

      const rows = desiredRows();
      const indexesReady = indexLoaded.prod && indexLoaded.test;
      const liveReady = rows.every((row) => liveLoaded.has(modeKey(row.isTestShowMode, row.showId)));

      if (!indexesReady || !liveReady) {
        setResult((current) => ({ ...current, loading: true }));
        return;
      }

      const now = Date.now();
      const shows = rows.flatMap((row): ActiveShowSummary[] => {
        const startedAt = activeStartedAtFromLiveState(
          liveValues.get(modeKey(row.isTestShowMode, row.showId)),
          now,
        );

        if (startedAt === null) return [];

        return [{
          showId: row.showId,
          title: row.title,
          meta: indexedShowToMeta(row, row.isTestShowMode),
          startedAt,
          isTestShow: row.isTestShowMode,
        }];
      });

      shows.sort((a, b) => {
        if (a.startedAt !== b.startedAt) return b.startedAt - a.startedAt;
        if (a.isTestShow !== b.isTestShow) return a.isTestShow ? -1 : 1;
        return a.showId.localeCompare(b.showId);
      });

      setResult({ shows, loading: false });
    };

    const syncLiveSubscriptions = () => {
      const rows = desiredRows();
      const desiredKeys = new Set(rows.map((row) => modeKey(row.isTestShowMode, row.showId)));

      liveUnsubscribes.forEach((unsubscribe, key) => {
        if (!desiredKeys.has(key)) {
          unsubscribe();
          liveUnsubscribes.delete(key);
          liveValues.delete(key);
          liveLoaded.delete(key);
        }
      });

      rows.forEach((row) => {
        const key = modeKey(row.isTestShowMode, row.showId);
        if (liveUnsubscribes.has(key)) return;

        const unsubscribe = onValue(
          ref(db, showPath(row.showId, row.isTestShowMode, 'live')),
          (snapshot) => {
            liveValues.set(key, snapshot.val() as LiveShowState | null);
            liveLoaded.add(key);
            publish();
          },
          (error) => {
            console.warn('Failed to load show live state:', error);
            if (!disposed) onError?.(error);
            liveValues.set(key, null);
            liveLoaded.add(key);
            publish();
          },
        );

        liveUnsubscribes.set(key, unsubscribe);
      });

      publish();
    };

    const subscribeIndex = (isTestShow: boolean) => {
      const scope = isTestShow ? 'test' : 'prod';
      const unsubscribe = onValue(
        ref(db, getShowsIndexBasePath(isTestShow)),
        (snapshot) => {
          const value = snapshot.val() as Record<string, unknown> | null;
          indexRows[scope] = value
            ? Object.entries(value).flatMap(([showId, showValue]) => {
                const row = indexedShowFromValue(showId, showValue, isTestShow);
                return row ? [row] : [];
              })
            : EMPTY_INDEXED_SHOWS;
          indexLoaded[scope] = true;
          syncLiveSubscriptions();
        },
        (error) => {
          console.warn('Failed to load show index:', error);
          if (!disposed) onError?.(error);
          indexRows[scope] = EMPTY_INDEXED_SHOWS;
          indexLoaded[scope] = true;
          syncLiveSubscriptions();
        },
      );
      indexUnsubscribes.push(unsubscribe);
    };

    setResult({ shows: [], loading: true });
    if (includeProd) subscribeIndex(false);
    if (includeTest) subscribeIndex(true);
    publish();

    return () => {
      disposed = true;
      indexUnsubscribes.forEach((unsubscribe) => unsubscribe());
      liveUnsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [enabled, includeProd, includeTest, onError]);

  return useMemo(() => result, [result]);
}
