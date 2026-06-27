/**
 * Copy Length Selector for Meta Ads Tool
 * Allows users to select the desired copy length format
 */

import type { CopyLengthFormat } from '@gen-app-2/contracts';
import { appCopy } from '../../../../app/copy/system';
import { uiPrimitives } from '../../../../app/ui/primitives';

type CopyLengthSelectorProps = {
  value: CopyLengthFormat;
  onChange: (format: CopyLengthFormat) => void;
  disabled: boolean;
};

const copyLengthOptions = [
  {
    id: 'short-form' as const,
    label: 'Short Form',
    description: 'Copy conciso per test rapidi e budget limitati',
    characterRange: '400-600 caratteri',
    useCases: ['A/B test iniziali', 'Campagne discovery', 'Budget ridotti'],
    recommended: false,
  },
  {
    id: 'medium-form' as const,
    label: 'Medium Form',
    description: 'Equilibrio tra narrativa e concisione',
    characterRange: '800-1000 caratteri',
    useCases: ['Campagne standard', 'Retargeting', 'Funnel intermedi'],
    recommended: true,
  },
  {
    id: 'long-form' as const,
    label: 'Long Form',
    description: 'Storytelling completo per massima persuasione',
    characterRange: '1200+ caratteri',
    useCases: ['Cold audience', 'Prodotti complessi', 'High-ticket items'],
    recommended: false,
  },
] as const;

export const CopyLengthSelector = ({
  value,
  onChange,
  disabled,
}: CopyLengthSelectorProps) => (
  <fieldset disabled={disabled}>
    <legend>{appCopy.ui.toolPage.form.copyLengthFormatLabel}</legend>
    <div className={uiPrimitives.radioGroup}>
      {copyLengthOptions.map(option => (
        <label key={option.id} className={uiPrimitives.radioRow}>
          <input
            type="radio"
            name="copyLengthFormat"
            value={option.id}
            checked={value === option.id}
            onChange={() => onChange(option.id)}
          />
          <div>
            <span className={uiPrimitives.radioLabel}>
              {option.label}
              {option.recommended ? (
                <span className={uiPrimitives.badge}>Consigliato</span>
              ) : null}
            </span>
            <span className={uiPrimitives.radioDescription}>
              {option.description}
            </span>
            <span className={uiPrimitives.metaLine}>
              {option.characterRange} - {option.useCases.join(', ')}
            </span>
          </div>
        </label>
      ))}
    </div>
  </fieldset>
);
