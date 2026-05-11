import { useState, useCallback } from 'react';
import type { Workspace, Pane } from './types';
import Welcome from './pages/Welcome';
import WorkspaceSelector from './pages/WorkspaceSelector';
import WorkspaceView from './pages/Workspace';
import Settings from './pages/Settings';

type Page = 'welcome' | 'selector' | 'workspace' | 'settings';

export default function App() {
  const [page, setPage] = useState<Page>('welcome');

  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [panes, setPanes] = useState<Pane[]>([]);

  const navigateTo = useCallback((p: Page) => setPage(p), []);

  const handleWorkspaceCreated = useCallback((ws: Workspace) => {
    setActiveWorkspace(ws);
    setPanes(ws.panes || []);
    setPage('workspace');
  }, []);

  const handleWorkspaceOpened = useCallback((ws: Workspace) => {
    setActiveWorkspace(ws);
    setPanes(ws.panes || []);
    setPage('workspace');
  }, []);

  const handlePanesChange = useCallback(
    (updatedPanes: Pane[]) => {
      setPanes(updatedPanes);
      if (activeWorkspace) {
        const updated: Workspace = {
          ...activeWorkspace,
          panes: updatedPanes,
          lastOpened: new Date().toISOString(),
        };
        setActiveWorkspace(updated);
        window.electronAPI.workspace.save(updated);
      }
    },
    [activeWorkspace]
  );

  const handleBackToWelcome = useCallback(() => {
    setActiveWorkspace(null);
    setPanes([]);
    setPage('welcome');
  }, []);

  return (
    <div className="app">
      {page === 'welcome' && (
        <Welcome
          onNewWorkspace={() => navigateTo('selector')}
          onOpenWorkspace={handleWorkspaceOpened}
          onSettings={() => navigateTo('settings')}
        />
      )}
      {page === 'selector' && (
        <WorkspaceSelector
          onCreated={handleWorkspaceCreated}
          onBack={() => navigateTo('welcome')}
        />
      )}
      {page === 'workspace' && activeWorkspace && (
        <WorkspaceView
          workspace={activeWorkspace}
          panes={panes}
          onPanesChange={handlePanesChange}
          onBack={handleBackToWelcome}
          onSettings={() => navigateTo('settings')}
        />
      )}
      {page === 'settings' && (
        <Settings onBack={() => (activeWorkspace ? navigateTo('workspace') : navigateTo('welcome'))} />
      )}
    </div>
  );
}
