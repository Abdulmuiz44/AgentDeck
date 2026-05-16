import { useState, useCallback, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import TerminalGrid from '../components/TerminalGrid';
import CommandLauncher from '../components/CommandLauncher';
import type { Workspace, Pane } from '../types';

declare global {
  interface Window {
    __talocode_npmScripts?: string[];
  }
}

interface Props {
  workspace: Workspace;
  panes: Pane[];
  onPanesChange: (panes: Pane[]) => void;
  onBack: () => void;
  onSettings: () => void;
}

export default function WorkspaceView({
  workspace,
  panes,
  onPanesChange,
  onBack,
  onSettings,
}: Props) {
  const [npmScripts, setNpmScripts] = useState<string[]>([]);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    window.electronAPI.fs.readPackageJson(workspace.projectPath).then((pkg) => {
      if (pkg && pkg.scripts && typeof pkg.scripts === 'object') {
        setNpmScripts(Object.keys(pkg.scripts));
      }
    });
  }, [workspace.projectPath]);

  const handleAddPane = useCallback(
    (pane: Pane) => {
      onPanesChange([...panes, pane]);
    },
    [panes, onPanesChange]
  );

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <Sidebar
        workspace={workspace}
        panes={panes}
        onBack={onBack}
        onSettings={onSettings}
      />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        <TerminalGrid panes={panes} onPanesChange={onPanesChange} />
        <CommandLauncher
          projectPath={workspace.projectPath}
          npmScripts={npmScripts}
          onAddPane={handleAddPane}
        />
      </div>
    </div>
  );
}
