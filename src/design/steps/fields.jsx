import { AXES, optionLabel } from '../model.js';

export function ChoiceGroup({ name, legend, options, value, onChange, note }) {
  return (
    <fieldset className="dp-field">
      <legend>{legend}</legend>
      {note && <p className="dp-field-note">{note}</p>}
      <div className="dp-pills">
        {options.map((o) => (
          <label key={String(o.value)} className={`dp-pill ${o.value === value ? 'selected' : ''}`}>
            <input
              type="radio"
              name={name}
              value={String(o.value)}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
            />
            <span>{o.label}</span>
            {o.hint && <small>{o.hint}</small>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const GROUPS = ['제시', '응답', '지원', '내용'];

// 제시 · 응답 · 지원 · 수 범위 축을 편집한다. diffKeys에 든 축은 '공통과 다름'으로 표시한다.
export function AxisEditor({ idPrefix, config, onChange, diffKeys = [], base, renderAfter }) {
  return (
    <div className="dp-axes">
      {GROUPS.map((group) => (
        <div key={group} className="dp-axis-group">
          <span className="dp-mini-label">{group}</span>
          {AXES.filter((a) => a.group === group).map((axis) => {
            const differs = diffKeys.includes(axis.key);
            return (
              <div key={axis.key} className={`dp-axis ${differs ? 'differs' : ''}`}>
                <ChoiceGroup
                  name={`${idPrefix}-${axis.key}`}
                  legend={axis.label}
                  options={axis.options}
                  value={config[axis.key]}
                  onChange={(v) => onChange(axis.key, v)}
                  note={
                    differs && base ? `공통 설정: ${optionLabel(axis.key, base[axis.key])}` : null
                  }
                />
                {differs && renderAfter?.(axis.key)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function ConfigChips({ config }) {
  return (
    <ul className="dp-chips" aria-label="구성">
      <li>
        <b>제시</b>
        {optionLabel('presentation', config.presentation)}
      </li>
      <li>
        <b>응답</b>
        {optionLabel('response', config.response)}
      </li>
      <li>
        <b>지원</b>
        {optionLabel('support', config.support)}
      </li>
    </ul>
  );
}
