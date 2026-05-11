import { useRef, useEffect, useCallback, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface UseTerminalOptions {
  onExit?: (exitCode: number) => void;
}

export function useTerminal(options: UseTerminalOptions = {}) {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalIdRef = useRef<string | null>(null);
  const onExitRef = useRef(options.onExit);
  onExitRef.current = options.onExit;

  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'error' | 'done'>('idle');

  const initTerminal = useCallback((container: HTMLDivElement) => {
    if (terminalRef.current) return;
    containerRef.current = container;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        selectionBackground: '#264f78',
        black: '#484f58',
        red: '#f85149',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#e6edf3',
        brightBlack: '#6e7681',
        brightRed: '#ff7b72',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);

    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch {
        // container may not have dimensions yet
      }
    });

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch { /* ignore */ }
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch { /* ignore */ }
      const tid = terminalIdRef.current;
      if (tid) {
        window.electronAPI.terminal.resize(tid, term.cols, term.rows);
      }
    });
    resizeObserver.observe(container);
  }, []);

  const createTerminal = useCallback(async (cwd: string, command: string) => {
    const tid = await window.electronAPI.terminal.create(cwd, command);
    terminalIdRef.current = tid;
    setTerminalId(tid);
    setStatus('running');

    const term = terminalRef.current;
    if (term) {
      term.onData((data) => {
        window.electronAPI.terminal.write(tid, data);
      });

      window.electronAPI.terminal.onData((eventTid, data) => {
        if (eventTid === tid && terminalRef.current) {
          terminalRef.current.write(data);
        }
      });

      window.electronAPI.terminal.onExit((eventTid, exitCode) => {
        if (eventTid === tid) {
          setStatus(exitCode === 0 ? 'done' : 'error');
          onExitRef.current?.(exitCode);
        }
      });

      window.electronAPI.terminal.resize(tid, term.cols, term.rows);
    }

    return tid;
  }, []);

  const killTerminal = useCallback(async () => {
    const tid = terminalIdRef.current;
    if (tid) {
      await window.electronAPI.terminal.kill(tid);
      terminalIdRef.current = null;
      setTerminalId(null);
      setStatus('idle');
    }
  }, []);

  const writeToTerminal = useCallback((data: string) => {
    const tid = terminalIdRef.current;
    if (tid) {
      window.electronAPI.terminal.write(tid, data);
    }
  }, []);

  useEffect(() => {
    return () => {
      const tid = terminalIdRef.current;
      if (tid) {
        window.electronAPI.terminal.kill(tid);
      }
      terminalRef.current?.dispose();
      terminalRef.current = null;
    };
  }, []);

  return {
    containerRef: initTerminal,
    createTerminal,
    killTerminal,
    writeToTerminal,
    terminalId,
    status,
  };
}
