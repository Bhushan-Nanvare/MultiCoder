interface TabBarProps {
  openTabs: string[];
  activeFile: string;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}

export function TabBar({ openTabs, activeFile, onSelect, onClose }: TabBarProps): JSX.Element {
  if (openTabs.length === 0) {
    return (
      <div
        style={{
          padding: '8px 12px',
          background: '#0f172a',
          borderBottom: '1px solid #1f2937',
          color: '#64748b',
          fontSize: 12,
        }}
      >
        No files open
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 2,
        padding: '0 8px',
        background: '#0f172a',
        borderBottom: '1px solid #1f2937',
        overflowX: 'auto',
        minHeight: 36,
      }}
    >
      {openTabs.map((path) => {
        const isActive = path === activeFile;
        const label = path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path;

        return (
          <div
            key={path}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: isActive ? '#111827' : 'transparent',
              borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
              borderTopLeftRadius: 6,
              borderTopRightRadius: 6,
            }}
          >
            <button
              type="button"
              onClick={() => onSelect(path)}
              title={path}
              style={{
                background: 'transparent',
                color: isActive ? '#f8fafc' : '#94a3b8',
                border: 'none',
                padding: '8px 10px',
                fontSize: 12,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                cursor: 'pointer',
                maxWidth: 160,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
            <button
              type="button"
              onClick={() => onClose(path)}
              title="Close tab"
              style={{
                background: 'transparent',
                color: '#64748b',
                border: 'none',
                padding: '0 8px 0 0',
                fontSize: 14,
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
