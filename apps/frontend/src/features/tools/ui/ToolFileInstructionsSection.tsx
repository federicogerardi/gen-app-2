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

  return (
    <Surface as="section" className="ui-tool-instructions-panel">
      <details className="ui-tool-instructions-accordion" data-testid="tool-file-instructions-accordion">
        <summary className="ui-tool-instructions-summary">
          <span className="ui-tool-instructions-title">{instructions.title}</span>
        </summary>

        <div className={uiPrimitives.stack}>
          <div className="ui-tool-instructions-groups">
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