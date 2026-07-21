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

  const entries: ToolProjectAssetPolicyEntry[] = contract.consumes.map(entry => {
    // The '?' suffix in the contract marks optional consumes.
    // No '?' → required for generation; '?' → optional.
    const isOptional = entry.endsWith('?');
    const assetType = (isOptional ? entry.slice(0, -1) : entry) as AssetType;
    const requiredness: ToolProjectAssetPolicyEntry['requiredness'] = isOptional
      ? 'optional-by-tool-setting'
      : 'always-required';
    return { assetType, label: ASSET_TYPE_LABELS[assetType] || assetType, requiredness };
  });

  // Sort: always-required asset types first, then optional-by-tool-setting.
  // Stable order within each group preserves the contract's consumes array order.
  const REQUIRED_ORDER: Record<ToolProjectAssetPolicyEntry['requiredness'], number> = {
    'always-required': 0,
    'optional-by-tool-setting': 1,
    'never-required': 2,
  };

  return entries.sort((a, b) => REQUIRED_ORDER[a.requiredness] - REQUIRED_ORDER[b.requiredness]);
};

export const getProducerToolsForAsset = (assetType: AssetType): ToolKey[] => {
  return (Object.keys(TOOL_ASSET_CONTRACTS) as ToolKey[]).filter(toolKey =>
    TOOL_ASSET_CONTRACTS[toolKey].produces.includes(assetType),
  );
};
