import { appCopy } from '../../../app/copy/system';
import { uiPrimitives } from '../../../app/ui/primitives';

type ReadinessItemStatus = 'done' | 'missing';

type PreFlightReadinessProps = {
  workspaceName: string | null;
  briefingFileName: string | null;
  isBriefingReady: boolean;
};

const itemStatus = (ready: boolean): ReadinessItemStatus => (ready ? 'done' : 'missing');

const fpCopy = appCopy.ui.toolPage.feedbackPanel;

export const PreFlightReadiness = ({
  workspaceName,
  briefingFileName,
  isBriefingReady,
}: PreFlightReadinessProps) => {
  return (
    <div className="ui-pfr-card" role="status">
      <p className="ui-pfr-title">{fpCopy.preFlightTitle}</p>
      <ul className="ui-pfr-list">
        <li className={`ui-pfr-item ui-pfr-item--${itemStatus(!!workspaceName)}`}>
          <span className="ui-pfr-item-icon" aria-hidden="true" />
          <span className="ui-pfr-item-label">
            <strong>{fpCopy.workspaceLabel}</strong>{' '}
            {workspaceName ?? fpCopy.workspaceMissing}
          </span>
        </li>
        <li className={`ui-pfr-item ui-pfr-item--${itemStatus(isBriefingReady)}`}>
          <span className="ui-pfr-item-icon" aria-hidden="true" />
          <span className="ui-pfr-item-label">
            <strong>{fpCopy.briefingLabel}</strong>{' '}
            {isBriefingReady
              ? (briefingFileName ?? fpCopy.briefingLabel)
              : fpCopy.briefingMissing}
          </span>
        </li>
      </ul>
      {/* ── error slot: populated by parent via ErrorBanner when submit fails ── */}
      <div className={uiPrimitives.error} hidden />
    </div>
  );
};