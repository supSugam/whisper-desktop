import React from 'react';

interface Option {
  value: string;
  label: string;
}

interface SegmentedControlProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  dataKey?: string;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  value,
  onChange,
  dataKey = 'value',
}) => {
  return (
    <div className="segmented-control">
      {options.map((option) => (
        <button
          key={option.value}
          className={`segment-btn ${value === option.value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
          {...{ [`data-${dataKey}`]: option.value }}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};
