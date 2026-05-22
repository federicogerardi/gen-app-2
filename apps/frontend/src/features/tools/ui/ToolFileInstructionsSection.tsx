import { Surface, uiPrimitives } from '../../../app/ui/primitives';
import type { ToolFileInstructionsViewModel } from '../runtime/tool-page-selectors';

type ToolFileInstructionsSectionProps = {
  instructions: ToolFileInstructionsViewModel | null;
};

export const ToolFileInstructionsSection = ({ instructions }: ToolFileInstructionsSectionProps) => {
  if (!instructions) {
    return null;
  }

  const requiredFields = instructions.requiredFields ?? [];

  const renderFileGroup = (
    title: string,
    files: readonly { key: string; label: string; accept: string }[],
  ) => {
    if (files.length === 0) {
      return null;
    }

    return (
      <section className="ui-tool-instructions-group">
        <h4 className="ui-tool-instructions-group-title">{title}</h4>
        <ul className={uiPrimitives.listClean}>
          {files.map((item) => (
            <li key={item.key} className="ui-tool-instructions-item">
              <span className="ui-tool-instructions-bullet" aria-hidden="true">•</span>
              <span className="ui-tool-instructions-item-text">{item.label} ({item.accept.replace(/,/g, ', ')})</span>
            </li>
          ))}
        </ul>
      </section>
    );
  };

  return (
    <Surface as="section" className="ui-tool-instructions-panel">
      <details className="ui-tool-instructions-accordion" data-testid="tool-file-instructions-accordion">
        <summary className="ui-tool-instructions-summary">
          <span className="ui-tool-instructions-title">{instructions.title}</span>
        </summary>

        <div className={uiPrimitives.stack}>
          <div className="ui-tool-instructions-groups">
            {renderFileGroup('File sempre richiesti', instructions.alwaysRequiredFiles)}
            {renderFileGroup('File richiesti dalla configurazione tool', instructions.requiredBySettingFiles)}
            {renderFileGroup('File opzionali dalla configurazione tool', instructions.optionalBySettingFiles)}

            <section className="ui-tool-instructions-group">
              <h4 className="ui-tool-instructions-group-title">Campi obbligatori</h4>
              <ul className={uiPrimitives.listClean}>
                {requiredFields.map((item) => (
                  <li key={item} className="ui-tool-instructions-item">
                    <span className="ui-tool-instructions-bullet" aria-hidden="true">•</span>
                    <span className="ui-tool-instructions-item-text">{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </details>
    </Surface>
  );
};