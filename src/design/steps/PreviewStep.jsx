import { HardDrive, Printer } from 'lucide-react';
import { AXES, optionLabel } from '../model.js';
import { configOf, diffConfig, versionIds, versionLabel } from '../reducer.js';
import Worksheet from '../worksheet.jsx';

export default function PreviewStep({ state, dispatch }) {
  const ids = versionIds(state);
  const active = ids.includes(state.activeVersion) ? state.activeVersion : 'base';
  const config = configOf(state, active);
  return (
    <section className="dp-panel" aria-labelledby="preview-title">
      <div className="dp-panel-head">
        <span className="dp-mini-label">5단계</span>
        <h2 id="preview-title">같은 데이터에서 버전별 활동지를 봅니다.</h2>
        <p className="muted">
          모든 활동지는 같은 목표와 축 설정에서 그려집니다. 설정을 바꾸려면 3단계로 돌아가세요.
        </p>
      </div>
      <div className="dp-toolbar">
        <div className="dp-switch" role="group" aria-label="미리볼 버전">
          {ids.map((id) => (
            <button
              key={id}
              aria-pressed={id === active}
              onClick={() => dispatch({ type: 'activeVersion', id })}
            >
              {versionLabel(id)}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={17} /> 이 활동지 인쇄
        </button>
      </div>
      <div className="dp-sheet-wrap">
        <Worksheet goal={state.goal} config={config} versionLabel={versionLabel(active)} />
      </div>
      <div className="dp-block">
        <h3 className="dp-block-title">비교 표</h3>
        <p className="dp-field-note">공통 설정과 다른 칸을 표시했습니다.</p>
        <div className="dp-table-scroll">
          <table className="dp-compare">
            <thead>
              <tr>
                <th scope="col">항목</th>
                {ids.map((id) => (
                  <th scope="col" key={id}>
                    {versionLabel(id)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AXES.map((axis) => (
                <tr key={axis.key}>
                  <th scope="row">{axis.label}</th>
                  {ids.map((id) => {
                    const c = configOf(state, id);
                    const differs = id !== 'base' && diffConfig(state.base, c).includes(axis.key);
                    const reason = id !== 'base' ? state.variants[id].reasons[axis.key] : '';
                    return (
                      <td key={id} className={differs ? 'differs' : ''}>
                        {optionLabel(axis.key, c[axis.key])}
                        {differs && <span className="dp-visually-hidden"> (공통과 다름)</span>}
                        {differs && reason && <small>사유: {reason}</small>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="dp-notice">
        <HardDrive size={17} />
        저장은 자동으로 됩니다. 이 브라우저에만 저장되며, 다른 기기나 사람과 공유되지 않습니다.
      </p>
    </section>
  );
}
