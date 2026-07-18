import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { appCopy } from '../../../../app/copy/system';

type GateStatus = 'healthy' | 'needs-attention' | 'blocked';

export const QUALITY_GATE_CONFIG: Record<GateStatus, {
  icon: typeof CheckCircle;
  color: 'success' | 'warning' | 'error';
  label: string;
}> = {
  healthy: {
    icon: CheckCircle,
    color: 'success',
    label: appCopy.ui.workspace.contextHeader.qualityStatusHealthy,
  },
  'needs-attention': {
    icon: AlertTriangle,
    color: 'warning',
    label: appCopy.ui.workspace.contextHeader.qualityStatusNeedsAttention,
  },
  blocked: {
    icon: XCircle,
    color: 'error',
    label: appCopy.ui.workspace.contextHeader.qualityStatusBlocked,
  },
};
