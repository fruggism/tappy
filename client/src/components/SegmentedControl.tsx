export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: Props<T>) {
  return (
    <div
      className={`inline-flex bg-surface2 dark:bg-surface2-dark rounded-full p-1 text-callout ${
        className ?? ""
      }`}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3.5 py-1.5 rounded-full transition-colors ${
            value === o.value
              ? "bg-white dark:bg-black text-ink dark:text-ink-dark shadow"
              : "text-muted dark:text-muted-dark"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
