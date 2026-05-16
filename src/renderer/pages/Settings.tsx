import { useState } from 'react';

interface Props {
  onBack: () => void;
}

export default function Settings({ onBack }: Props) {
  const [fontSize, setFontSize] = useState(13);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('talocode:fontSize', String(fontSize));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 24,
        padding: 40,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Settings</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Configure your workspace preferences
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          width: '100%',
          maxWidth: 440,
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius)',
            padding: '16px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
              }}
            >
              Terminal Font Size
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="range"
                min={10}
                max={20}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  minWidth: 30,
                  textAlign: 'center',
                }}
              >
                {fontSize}
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius)',
            padding: '16px',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              marginBottom: 8,
            }}
          >
            Default Shell
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
            PowerShell{' '}
            <span style={{ color: 'var(--text-muted)' }}>
              (Windows default)
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            WSL is also supported — launch it from the command launcher
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            onClick={onBack}
            style={{
              flex: 1,
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius)',
              padding: '12px 20px',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Back
          </button>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              backgroundColor: saved ? 'var(--success)' : 'var(--accent)',
              color: '#ffffff',
              borderRadius: 'var(--radius)',
              padding: '12px 20px',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {saved ? 'Saved ✓' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
