import { useState, useEffect, useCallback } from 'react';
import type { Workspace } from '../types';

export function useWorkspace() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await window.electronAPI.workspace.list();
    setWorkspaces(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const deleteWorkspace = useCallback(
    async (id: string) => {
      await window.electronAPI.workspace.delete(id);
      await refresh();
    },
    [refresh]
  );

  return { workspaces, loading, refresh, deleteWorkspace };
}
