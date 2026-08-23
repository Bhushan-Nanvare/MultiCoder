import type { CSSProperties } from 'react';
import { pathDepth, sortProjectPaths } from '@/realtime/projectOps';

interface FileTreeProps {
  files: string[];
  activeFile: string;
  entryPoint: string;
  disabled?: boolean;
  onSelect: (path: string) => void;
  onNewFile: () => void;
  onRename: (path: string) => void;
  onDelete: (path: string) => void;
}

export function FileTree({
  files,
  activeFile,
  entryPoint,
  disabled = false,
  onSelect,
  onNewFile,
  onRename,
  onDelete,
}: FileTreeProps): JSX.Element {
  const sorted = sortProjectPaths(files);

  return (
    <aside
      style={{
        width: 220,
        minWidth: 220,
        borderRight: '1px solid #1f2937',
        background: '#0b1220',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: '1px solid #1f2937',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: '#94a3b8',
        }}
      >
        <span>Files</span>
        <button
          type="button"
          disabled={disabled}
          onClick={onNewFile}
          title="New file"
          style={{
            background: 'transparent',
            color: '#e2e8f0',
            border: '1px solid #334155',
            borderRadius: 4,
            width: 24,
            height: 24,
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: 16,
            lineHeight: 1,
          }}
        >
          +
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {sorted.map((path) => {
          const isActive = path === activeFile;
          const depth = pathDepth(path);
          const fileName = path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path;

          return (
            <div
              key={path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                paddingLeft: 8 + depth * 12,
                paddingRight: 6,
              }}
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(path)}
                title={path}
                style={{
                  flex: 1,
                  textAlign: 'left',
                  background: isActive ? '#1e293b' : 'transparent',
                  color: isActive ? '#f8fafc' : '#cbd5e1',
                  border: 'none',
                  borderRadius: 4,
                  padding: '6px 8px',
                  fontSize: 12,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {fileName}
                {path === entryPoint ? ' ▶' : ''}
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRename(path)}
                title="Rename"
                style={iconButtonStyle(disabled)}
              >
                ✎
              </button>
              <button
                type="button"
                disabled={disabled || files.length <= 1}
                onClick={() => onDelete(path)}
                title="Delete"
                style={iconButtonStyle(disabled || files.length <= 1)}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function iconButtonStyle(disabled: boolean): CSSProperties {
  return {
    background: 'transparent',
    color: disabled ? '#475569' : '#94a3b8',
    border: 'none',
    borderRadius: 4,
    width: 22,
    height: 22,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 12,
    flexShrink: 0,
  };
}
