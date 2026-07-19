import { useEffect, useRef } from 'react';

interface SlotWheelProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (val: T) => void;
  disabled?: boolean;
}

export function SlotWheel<T extends string>({ options, value, onChange, disabled }: SlotWheelProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ITEM_HEIGHT = 40;

  useEffect(() => {
    if (containerRef.current) {
      const idx = options.indexOf(value);
      if (idx >= 0) {
        containerRef.current.scrollTop = idx * ITEM_HEIGHT;
      }
    }
  }, [value, options]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (disabled) return;
    const target = e.currentTarget;
    const scrollCenter = target.scrollTop + ITEM_HEIGHT / 2;
    const idx = Math.max(0, Math.min(options.length - 1, Math.floor(scrollCenter / ITEM_HEIGHT)));
    if (options[idx] !== value) {
      onChange(options[idx]);
    }
  };

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        height: `${ITEM_HEIGHT * 3}px`,
        overflowY: disabled ? 'hidden' : 'scroll',
        scrollSnapType: 'y mandatory',
        position: 'relative',
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        width: '120px'
      }}
      className="slot-wheel"
      data-testid="slot-wheel"
    >
      <div style={{ height: `${ITEM_HEIGHT}px` }} /> {/* Top padding */}
      {options.map((opt) => (
        <div 
          key={opt}
          style={{
            height: `${ITEM_HEIGHT}px`,
            scrollSnapAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: opt === value ? '1.2rem' : '1rem',
            fontWeight: opt === value ? 'bold' : 'normal',
            color: opt === value ? 'var(--color-ink)' : 'var(--color-text-secondary)',
          }}
        >
          {opt}
        </div>
      ))}
      <div style={{ height: `${ITEM_HEIGHT}px` }} /> {/* Bottom padding */}
    </div>
  );
}
