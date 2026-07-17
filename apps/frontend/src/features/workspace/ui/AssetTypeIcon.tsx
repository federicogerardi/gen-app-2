import {
  Target, User, MessageSquare, Zap, BarChart3, FileText,
  PenTool, Globe, List, Newspaper, Video, FileImage,
} from 'lucide-react';

const ASSET_TYPE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  angle: Target,
  persona: User,
  'brand-voice': MessageSquare,
  hook: Zap,
  'competitor-analysis': BarChart3,
  'creative-brief': FileText,
  'ad-copy': PenTool,
  'landing-page': Globe,
  'article-outline': List,
  article: Newspaper,
  script: Video,
  description: FileImage,
};

interface AssetTypeIconProps {
  type: string;
  size?: number;
  className?: string;
}

export const AssetTypeIcon: React.FC<AssetTypeIconProps> = ({
  type,
  size = 18,
  className,
}) => {
  const Icon = ASSET_TYPE_ICONS[type] || FileText;
  const props: { size?: number; className?: string } = { size };
  if (className !== undefined) {
    props.className = className;
  }
  return <Icon {...props} />;
};
