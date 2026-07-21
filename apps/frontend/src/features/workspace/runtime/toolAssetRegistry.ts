import { TOOL_ASSET_CONTRACTS, type ToolKey, type AssetType } from '@gen-app-2/contracts';

export type ToolProjectAssetPolicyEntry = {
  assetType: string;
  label: string;
  requiredness: 'always-required' | 'optional-by-tool-setting' | 'never-required';
};

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
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
  'brief': 'Brief',
};

export const getToolAssetInputs = (toolKey: ToolKey): ToolProjectAssetPolicyEntry[] => {
  const contract = TOOL_ASSET_CONTRACTS[toolKey];
  if (!contract) return [];

  return contract.consumes.map(entry => {
    // Strip the '?' optional suffix so the UI renders the canonical asset label
    const assetType = entry.replace(/\?$/, '') as AssetType;
    return {
      assetType,
      label: ASSET_TYPE_LABELS[assetType] || assetType,
      requiredness: assetType === 'brief' ? 'always-required' as const : 'optional-by-tool-setting' as const,
    };
  });
};

export const getProducerToolsForAsset = (assetType: AssetType): ToolKey[] => {
  return (Object.keys(TOOL_ASSET_CONTRACTS) as ToolKey[]).filter(toolKey =>
    TOOL_ASSET_CONTRACTS[toolKey].produces.includes(assetType),
  );
};
