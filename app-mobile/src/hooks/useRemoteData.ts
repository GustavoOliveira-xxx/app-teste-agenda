// Carrega dados que só existem online (membros, convites, comentários,
// histórico), com estados de carregando, erro e "puxar para atualizar".
import { useCallback, useEffect, useRef, useState } from 'react';

import { toFriendlyError, type FriendlyError } from '@/utils/errors';

export function useRemoteData<T>(fetcher: () => Promise<T>, deps: unknown[], initial?: T) {
  const [data, setData] = useState<T | undefined>(initial);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const fetcherRef = useRef(fetcher);
  const alive = useRef(true);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Carga automática sempre que as dependências mudam.
  useEffect(() => {
    let current = true;
    fetcher()
      .then((result) => {
        if (current) {
          setData(result);
          setError(null);
        }
      })
      .catch((e) => current && setError(toFriendlyError(e)))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Recarga pedida pela pessoa (botão "Tentar de novo" ou puxar para atualizar).
  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await fetcherRef.current();
      if (alive.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (alive.current) setError(toFriendlyError(e));
    } finally {
      if (alive.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  return { data, setData, loading, refreshing, error, reload: () => load(false), refresh: () => load(true) };
}
