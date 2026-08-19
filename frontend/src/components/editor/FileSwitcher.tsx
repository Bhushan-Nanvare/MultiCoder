import { MAX_FILES_PER_ROOM } from '@/types/room';

interface FileSwitcherProps {
  files: string[];
  activeFile: string;
  entryPoint: string;
  disabled?: boolean;
  onSelect: (path: string) => void;
  onAddFile?: () => void;
  addFileDisabled?: boolean;
  addFileError?: string | null;
}

export function FileSwitcher({
  files,
  activeFile,
  entryPoint,
  disabled = false,
  onSelect,
  onAddFile,
  addFileDisabled = false,
  addFileError,
}: FileSwitcherProps): JSX.Element {
  const canAdd = Boolean(onAddFile) && files.length < MAX_FILES_PER_ROOM;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px',
        background: '#0b1220',
        borderBottom: '1px solid #1f2937',
        color: '#e2e8f0',
        fontSize: 13,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ opacity: 0.65 }}>File:</span>
      <select
        value={activeFile}
        disabled={disabled || files.length === 0}
        onChange={(event) => onSelect(event.target.value)}
        style={{
          background: '#111827',
          color: '#e2e8f0',
          border: '1px solid #334155',
          borderRadius: 6,
          padding: '6px 10px',
          fontSize: 13,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          minWidth: 160,
        }}
      >
        {files.map((path) => (
          <option key={path} value={path}>
            {path}
            {path === entryPoint ? ' (entry)' : ''}
          </option>
        ))}
      </select>

      {canAdd && (
        <button
          type="button"
          onClick={onAddFile}
          disabled={addFileDisabled}
          style={{
            background: addFileDisabled ? '#1f2937' : '#1e40af',
            color: '#e2e8f0',
            border: 'none',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 13,
            cursor: addFileDisabled ? 'wait' : 'pointer',
          }}
        >
          + Add file
        </button>
      )}

      {addFileError && (
        <span style={{ color: '#f87171', fontSize: 12 }}>{addFileError}</span>
      )}
    </div>
  );
}
