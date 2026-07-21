import { useEffect, useRef, type KeyboardEvent, useId } from 'react';

interface SlotWheelProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (val: T) => void;
  disabled?: boolean;
  'aria-label'?: string;
  itemHeight?: number;
  formatOption?: (opt: T) => React.ReactNode;
}

export function SlotWheel<T extends string>({ options, value, onChange, disabled, 'aria-label': ariaLabel, itemHeight = 40, formatOption }: SlotWheelProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInteracting = useRef(false);
  const idPrefix = useId();

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (containerRef.current && !isInteracting.current) {
      const idx = options.indexOf(value);
      if (idx >= 0) {
        containerRef.current.scrollTop = idx * itemHeight;
      }
    }
  }, [value, options, itemHeight]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (disabled) return;
    isInteracting.current = true;
    const target = e.currentTarget;
    const scrollCenter = target.scrollTop + itemHeight / 2;
    const idx = Math.max(0, Math.min(options.length - 1, Math.floor(scrollCenter / itemHeight)));
    if (options[idx] !== value) {
      onChange(options[idx]);
    }
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isInteracting.current = false;
    }, 150);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const idx = options.indexOf(value);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (idx < options.length - 1) onChange(options[idx + 1]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx > 0) onChange(options[idx - 1]);
    }
  };

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      role="listbox"
      aria-label={ariaLabel}
      aria-activedescendant={value ? `${idPrefix}-opt-${value}` : undefined}
      style={{
        height: `${itemHeight * 3}px`,
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
      <div style={{ height: `${itemHeight}px` }} aria-hidden="true" />
      {options.map((opt) => (
        <div 
          key={opt}
          id={`${idPrefix}-opt-${opt}`}
          role="option"
          aria-selected={opt === value}
          style={{
            height: `${itemHeight}px`,
            scrollSnapAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: opt === value ? '1.2rem' : '1rem',
            fontWeight: opt === value ? 'bold' : 'normal',
            color: opt === value ? 'var(--color-ink)' : 'var(--color-text-secondary)',
            textTransform: formatOption ? 'none' : 'capitalize'
          }}
        >
          {formatOption ? formatOption(opt) : opt}
        </div>
      ))}
      <div style={{ height: `${itemHeight}px` }} aria-hidden="true" />
    </div>
  );
}
