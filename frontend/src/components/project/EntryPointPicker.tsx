interface EntryPointPickerProps {
  files: string[];
  entryPoint: string;
  disabled?: boolean;
  onChange: (path: string) => void;
}

export function EntryPointPicker({
  files,
  entryPoint,
  disabled = false,
  onChange,
}: EntryPointPickerProps): JSX.Element {
  return (
    <>
      <span style={{ opacity: 0.65 }}>Entry:</span>
      <select
        value={entryPoint}
        disabled={disabled || files.length === 0}
        onChange={(event) => onChange(event.target.value)}
        title="File executed when you click Run"
        style={{
          background: '#0b1220',
          color: '#e2e8f0',
          border: '1px solid #334155',
          borderRadius: 6,
          padding: '4px 8px',
          fontSize: 12,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          maxWidth: 180,
        }}
      >
        {files.map((path) => (
          <option key={path} value={path}>
            {path}
          </option>
        ))}
      </select>
    </>
  );
}
