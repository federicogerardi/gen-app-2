import { TOOL_ASSET_CONTRACTS, type ToolKey, type AssetType } from '@gen-app-2/contracts';

export type ToolProjectAssetPolicyEntry = {
  assetType: string;
  label: string;
  requiredness: 'always-required' | 'optional-by-tool-setting' | 'never-required';
};

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  'angle': 'Angle',
  'persona': 'Persona',
  'brand-voice': 'Brand Voice',
  'hook': 'Hook',
  'competitor-analysis': 'Competitor Analysis',
  'creative-brief': 'Creative Brief',
  'ad-copy': 'Ad Copy',
  'landing-page': 'Landing Page',
  'article-outline': 'Article Outline',
  'article': 'Article',
  'script': 'Script',
  'description': 'Description',
};

export const getToolAssetInputs = (toolKey: ToolKey): ToolProjectAssetPolicyEntry[] => {
  const contract = TOOL_ASSET_CONTRACTS[toolKey];
  if (!contract) return [];

  return contract.consumes.map(assetType => ({
    assetType,
    label: ASSET_TYPE_LABELS[assetType] || assetType,
    requiredness: 'always-required' as const,
  }));
};

export const getProducerToolsForAsset = (assetType: AssetType): ToolKey[] => {
  return (Object.keys(TOOL_ASSET_CONTRACTS) as ToolKey[]).filter(toolKey =>
    TOOL_ASSET_CONTRACTS[toolKey].produces.includes(assetType),
  );
};
