import { STATE_LABEL, STATES } from '../ui';
import type { State } from '../engine';

/** 현행수준 3택 세그먼트(라디오). 키보드 화살표로 이동 가능. */
export function StateSegmented({
  name,
  value,
  onChange,
  ariaLabel,
}: {
  name: string;
  value: State;
  onChange: (s: State) => void;
  ariaLabel: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={ariaLabel}>
      {STATES.map((s) => (
        <label key={s} className={`seg-item seg-${s}${value === s ? ' on' : ''}`}>
          <input type="radio" name={name} value={s} checked={value === s} onChange={() => onChange(s)} />
          <span>{STATE_LABEL[s]}</span>
        </label>
      ))}
    </div>
  );
}
