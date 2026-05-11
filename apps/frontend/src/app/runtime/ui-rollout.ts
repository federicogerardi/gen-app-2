const DEFAULT_UI_ROLLOUT_MODE = 'mui';

const resolveUiRolloutMode = (): 'mui' | 'legacy' => {
  const rawMode = import.meta.env.VITE_UI_ROLLOUT_MODE?.trim().toLowerCase();

  if (rawMode === 'legacy') {
    return 'legacy';
  }

  return DEFAULT_UI_ROLLOUT_MODE;
};

export const uiRolloutMode = resolveUiRolloutMode();

export const isMuiUiRolloutEnabled = uiRolloutMode === 'mui';
