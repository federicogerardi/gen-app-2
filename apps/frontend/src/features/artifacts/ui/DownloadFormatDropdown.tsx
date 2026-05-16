import { useState, type MouseEvent } from 'react';
import { Menu, MenuItem } from '@mui/material';
import { Download } from 'lucide-react';
import { appCopy } from '../../../app/copy/system';
import { cx } from '../../../app/ui/primitives';
import { SecondaryCtaButton } from '../../../app/ui/CtaButtons';
import type { DownloadFormat } from '../runtime/download-client';

const DOWNLOAD_FORMATS: DownloadFormat[] = ['md', 'docx'];

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
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(anchorEl);

  const handleOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
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
          className={className}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={handleOpen}
          disabled={disabled}
        >
          {appCopy.ui.actions.download}
        </SecondaryCtaButton>
      )}

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleClose}
        MenuListProps={{ 'aria-label': appCopy.ui.actions.download }}
      >
        {DOWNLOAD_FORMATS.map((format) => (
          <MenuItem
            key={format}
            onClick={() => {
              handleClose();
              onDownload(format);
            }}
          >
            {getFormatLabel(format)}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};