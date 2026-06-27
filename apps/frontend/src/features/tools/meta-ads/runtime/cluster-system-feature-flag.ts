/**
 * Feature flag for Meta Ads Cluster System
 * Controls whether the new cluster → angle → awareness system is enabled
 */

const readFeatureFlag = (): boolean => {
  const raw = (import.meta.env.VITE_FF_USE_CLUSTER_SYSTEM as string | undefined)?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
};

export const isClusterSystemEnabled = (): boolean => readFeatureFlag();

export const getCopyLengthFormatDefault = (): 'medium-form' => 'medium-form';
