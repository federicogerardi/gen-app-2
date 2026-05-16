import { useState, type MouseEvent } from 'react';
import { Menu, MenuItem } from '@mui/material';
import { ChevronDown, Download } from 'lucide-react';
import { appCopy } from '../../../app/copy/system';
import { cx } from '../../../app/ui/primitives';
import { SecondaryCtaButton } from '../../../app/ui/CtaButtons';
import type { DownloadFormat } from '../runtime/download-client';

const DOWNLOAD_FORMATS: DownloadFormat[] = ['docx', 'md'];

const getFormatExtensionLabel = (format: DownloadFormat): string => {
  if (format === 'md') return '.md';
  return '.docx';
};

const getFormatLabel = (format: DownloadFormat): string => {
  if (format === 'md') return appCopy.ui.actions.downloadAsMarkdown;
  return appCopy.ui.actions.downloadAsDocx;
};

type DownloadFormatDropdownProps = {
  onDownload: (format: DownloadFormat) => void;
  disabled?: boolean;
  triggerVariant?: 'secondary' | 'icon';
  className?: string;
};

export const DownloadFormatDropdown = ({
  onDownload,
  disabled = false,
  triggerVariant = 'secondary',
  className,
}: DownloadFormatDropdownProps) => {
  const [selectedFormat, setSelectedFormat] = useState<DownloadFormat>('docx');
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(anchorEl);

  const handleOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSecondaryClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target;
    const clickedChevron =
      target instanceof Element && target.closest('[data-download-format-trigger="true"]');

    if (clickedChevron) {
      setAnchorEl(event.currentTarget);
      return;
    }

    onDownload(selectedFormat);
  };

  return (
    <>
      {triggerVariant === 'icon' ? (
        <button
          type="button"
          className={cx('ui-view-tab', 'ui-view-tab--icon', className)}
          aria-label={appCopy.ui.actions.download}
          title={appCopy.ui.actions.download}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={handleOpen}
          disabled={disabled}
        >
          <Download size={13} />
        </button>
      ) : (
        <SecondaryCtaButton
          type="button"
          className={cx('ui-download-split-button', className)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={handleSecondaryClick}
          disabled={disabled}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setAnchorEl(event.currentTarget);
            }
          }}
        >
          <span className="ui-download-split-layout">
            <span className="ui-download-split-label-wrap">
              <span className="ui-download-split-label">
                {appCopy.ui.actions.download}
              </span>
            </span>
            <span
              className="ui-download-split-trigger"
              data-download-format-trigger="true"
              aria-label="Seleziona formato download"
              title="Seleziona formato download"
            >
              <ChevronDown size={13} />
              <span className="ui-download-split-format-label">
                {getFormatExtensionLabel(selectedFormat)}
              </span>
            </span>
          </span>
        </SecondaryCtaButton>
      )}

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          list: { 'aria-label': appCopy.ui.actions.download },
          paper: { className: 'ui-download-format-menu' },
        }}
      >
        {DOWNLOAD_FORMATS.map((format) => (
          <MenuItem
            key={format}
            onClick={() => {
              handleClose();
              setSelectedFormat(format);
            }}
          >
            {getFormatLabel(format)}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};