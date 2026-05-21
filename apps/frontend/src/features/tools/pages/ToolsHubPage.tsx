import { Link } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { ListingTableSection, type ListingTableColumn } from '../../../app/ui/ListingTableSection';
import { Surface, TopBar, cx, uiPrimitives } from '../../../app/ui/primitives';
import {
  getEnabledToolNavigationItems,
  getToolFormConfig,
  type ToolNavigationItem,
} from '../runtime/tool-form-architecture';

const toolHubColumns: ListingTableColumn[] = [
  { key: 'tool', header: 'Tool' },
  { key: 'description', header: 'Description' },
  { key: 'action', header: 'Action' },
];

export const ToolsHubPage = () => {
  const toolItems = getEnabledToolNavigationItems();

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>{appCopy.ui.navigation.tools}</h2>
      </TopBar>

      <ListingTableSection
        title={appCopy.ui.navigation.tools}
        headingLevel="h3"
        loading={false}
        error={null}
        isEmpty={toolItems.length === 0}
        emptyMessage={appCopy.ui.states.noToolsAvailable}
        columns={toolHubColumns}
        rows={toolItems}
        rowKey={(row) => row.toolKey}
        renderCell={(row: ToolNavigationItem, columnKey) => {
          if (columnKey === 'tool') {
            return row.label;
          }

          if (columnKey === 'description') {
            return getToolFormConfig(row.toolKey).defaultPrompt;
          }

          if (columnKey === 'action') {
            return (
              <Link
                to={row.to}
                className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
              >
                {appCopy.ui.actions.openToolWorkspace}
              </Link>
            );
          }

          return null;
        }}
        />
    </Surface>
  );
};
