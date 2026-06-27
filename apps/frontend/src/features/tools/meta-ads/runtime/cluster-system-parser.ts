/**
 * Cluster System Output Parser
 * Parses the new cluster → angle → awareness output format
 */

export type AwarenessLevel = 'problem-aware' | 'solution-aware' | 'product-aware';

export type AwarenessVersion = {
  level: AwarenessLevel;
  primaryText: string;
  headline: string;
  description: string;
};

export type Angle = {
  name: string;
  versions: AwarenessVersion[];
};

export type Cluster = {
  name: string;
  description: string;
  angles: Angle[];
};

export type ClusterSystemOutput = {
  clusters: Cluster[];
  copyLengthFormat: string;
  brandFacts: string[];
};

/**
 * Parse the cluster system output from markdown content
 */
export const parseClusterSystemOutput = (content: string): ClusterSystemOutput => {
  const clusters: Cluster[] = [];
  let currentCluster: Cluster | null = null;
  let currentAngle: Angle | null = null;
  let currentAwareness: AwarenessLevel | null = null;
  let currentPrimaryText = '';
  let currentHeadline = '';
  let currentDescription = '';
  let copyLengthFormat = 'medium-form';
  const brandFacts: string[] = [];

  const lines = content.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Detect copy length format
    if (trimmedLine.includes('format)') && trimmedLine.includes('Libreria Copy Meta Ads')) {
      const formatMatch = trimmedLine.match(/\(([^)]+)\s+format\)/);
      if (formatMatch?.[1]) {
        copyLengthFormat = formatMatch[1].trim();
      }
    }

    // Detect cluster header
    const clusterMatch = trimmedLine.match(/^##\s+CLUSTER\s+\d+\s+[—–-]\s+(.+)$/);
    if (clusterMatch?.[1]) {
      if (currentCluster) {
        clusters.push(currentCluster);
      }
      currentCluster = {
        name: clusterMatch[1].trim(),
        description: '',
        angles: [],
      };
      currentAngle = null;
      currentAwareness = null;
      continue;
    }

    // Detect angle header
    const angleMatch = trimmedLine.match(/^###\s+Angolo\s+\d+\s+[—–-]\s+(.+)$/);
    if (angleMatch?.[1]) {
      if (currentCluster && currentAngle) {
        currentCluster.angles.push(currentAngle);
      }
      currentAngle = {
        name: angleMatch[1].trim(),
        versions: [],
      };
      currentAwareness = null;
      continue;
    }

    // Detect awareness level
    if (trimmedLine.includes('Versione Problem Aware')) {
      currentAwareness = 'problem-aware';
      continue;
    }
    if (trimmedLine.includes('Versione Solution Aware')) {
      currentAwareness = 'solution-aware';
      continue;
    }
    if (trimmedLine.includes('Versione Product Aware')) {
      currentAwareness = 'product-aware';
      continue;
    }

    // Detect primary text
    if (trimmedLine.startsWith('**Primary Text**')) {
      currentPrimaryText = '';
      continue;
    }

    // Detect headline
    const headlineMatch = trimmedLine.match(/^\*\*Headline:\*\*\s*(.+)$/);
    if (headlineMatch?.[1]) {
      currentHeadline = headlineMatch[1].trim();
      continue;
    }

    // Detect description
    const descriptionMatch = trimmedLine.match(/^\*\*Description:\*\*\s*(.+)$/);
    if (descriptionMatch?.[1]) {
      currentDescription = descriptionMatch[1].trim();

      // Save the complete awareness version
      if (currentAngle && currentAwareness) {
        currentAngle.versions.push({
          level: currentAwareness,
          primaryText: currentPrimaryText.trim(),
          headline: currentHeadline,
          description: currentDescription,
        });
      }

      currentPrimaryText = '';
      currentHeadline = '';
      currentDescription = '';
      currentAwareness = null;
      continue;
    }

    // Accumulate primary text
    if (currentAwareness && !trimmedLine.startsWith('**')) {
      if (currentPrimaryText) {
        currentPrimaryText += '\n';
      }
      currentPrimaryText += line;
    }

    // Detect cluster description
    if (currentCluster && !currentAngle && !trimmedLine.startsWith('##') && !trimmedLine.startsWith('**') && trimmedLine.length > 0) {
      if (currentCluster.description) {
        currentCluster.description += ' ';
      }
      currentCluster.description += trimmedLine;
    }
  }

  // Save last cluster and angle
  if (currentCluster && currentAngle) {
    currentCluster.angles.push(currentAngle);
  }
  if (currentCluster) {
    clusters.push(currentCluster);
  }

  return {
    clusters,
    copyLengthFormat,
    brandFacts,
  };
};

/**
 * Get all awareness levels for a specific angle
 */
export const getAwarenessLevelsForAngle = (angle: Angle): AwarenessLevel[] => {
  return angle.versions.map((v) => v.level);
};

/**
 * Get specific awareness version for an angle
 */
export const getAwarenessVersion = (
  angle: Angle,
  level: AwarenessLevel,
): AwarenessVersion | undefined => {
  return angle.versions.find((v) => v.level === level);
};

/**
 * Format awareness level for display
 */
export const formatAwarenessLevel = (level: AwarenessLevel): string => {
  switch (level) {
    case 'problem-aware':
      return 'Problem Aware';
    case 'solution-aware':
      return 'Solution Aware';
    case 'product-aware':
      return 'Product Aware';
  }
};
