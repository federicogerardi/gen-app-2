/**
 * Cluster System Export Utilities
 * Provides export functionality for specific clusters, angles, or awareness levels
 */

import type { AwarenessLevel, Cluster, Angle, ClusterSystemOutput } from './cluster-system-parser';

export type ExportFormat = 'markdown' | 'text' | 'json';

export type ExportSelection = {
  clusterIndex?: number;
  angleIndex?: number;
  awarenessLevel?: AwarenessLevel;
};

/**
 * Export the entire cluster system output
 */
export const exportFullClusterSystem = (
  output: ClusterSystemOutput,
  format: ExportFormat = 'markdown',
): string => {
  switch (format) {
    case 'markdown':
      return exportToMarkdown(output);
    case 'text':
      return exportToText(output);
    case 'json':
      return exportToJson(output);
  }
};

/**
 * Export a specific cluster
 */
export const exportCluster = (
  output: ClusterSystemOutput,
  clusterIndex: number,
  format: ExportFormat = 'markdown',
): string => {
  const cluster = output.clusters[clusterIndex];
  if (!cluster) {
    return '';
  }

  const singleClusterOutput: ClusterSystemOutput = {
    clusters: [cluster],
    copyLengthFormat: output.copyLengthFormat,
    brandFacts: output.brandFacts,
  };

  return exportFullClusterSystem(singleClusterOutput, format);
};

/**
 * Export a specific angle from a cluster
 */
export const exportAngle = (
  output: ClusterSystemOutput,
  clusterIndex: number,
  angleIndex: number,
  format: ExportFormat = 'markdown',
): string => {
  const cluster = output.clusters[clusterIndex];
  if (!cluster) {
    return '';
  }

  const angle = cluster.angles[angleIndex];
  if (!angle) {
    return '';
  }

  const singleAngleCluster: Cluster = {
    name: cluster.name,
    description: cluster.description,
    angles: [angle],
  };

  const singleAngleOutput: ClusterSystemOutput = {
    clusters: [singleAngleCluster],
    copyLengthFormat: output.copyLengthFormat,
    brandFacts: output.brandFacts,
  };

  return exportFullClusterSystem(singleAngleOutput, format);
};

/**
 * Export a specific awareness level from an angle
 */
export const exportAwarenessLevel = (
  output: ClusterSystemOutput,
  clusterIndex: number,
  angleIndex: number,
  awarenessLevel: AwarenessLevel,
  format: ExportFormat = 'markdown',
): string => {
  const cluster = output.clusters[clusterIndex];
  if (!cluster) {
    return '';
  }

  const angle = cluster.angles[angleIndex];
  if (!angle) {
    return '';
  }

  const version = angle.versions.find((v) => v.level === awarenessLevel);
  if (!version) {
    return '';
  }

  const singleVersionAngle: Angle = {
    name: angle.name,
    versions: [version],
  };

  const singleVersionCluster: Cluster = {
    name: cluster.name,
    description: cluster.description,
    angles: [singleVersionAngle],
  };

  const singleVersionOutput: ClusterSystemOutput = {
    clusters: [singleVersionCluster],
    copyLengthFormat: output.copyLengthFormat,
    brandFacts: output.brandFacts,
  };

  return exportFullClusterSystem(singleVersionOutput, format);
};

/**
 * Export to Markdown format
 */
const exportToMarkdown = (output: ClusterSystemOutput): string => {
  let markdown = `# Libreria Copy Meta Ads (${output.copyLengthFormat} format)\n\n`;
  markdown += `Schema: Cluster → Angolo → versioni declinate per livello di consapevolezza\n\n`;

  if (output.brandFacts.length > 0) {
    markdown += `Brand facts utilizzati in modo coerente:\n`;
    for (const fact of output.brandFacts) {
      markdown += `- ${fact}\n`;
    }
    markdown += '\n';
  }

  for (const cluster of output.clusters) {
    markdown += `## CLUSTER — ${cluster.name}\n\n`;
    if (cluster.description) {
      markdown += `${cluster.description}\n\n`;
    }

    for (const angle of cluster.angles) {
      markdown += `### Angolo — ${angle.name}\n\n`;

      for (const version of angle.versions) {
        const awarenessLabel = formatAwarenessLevelLabel(version.level);
        markdown += `**› Versione ${awarenessLabel}**\n\n`;
        markdown += `**Primary Text**\n${version.primaryText}\n\n`;
        markdown += `**Headline:** ${version.headline}\n`;
        markdown += `**Description:** ${version.description}\n\n`;
      }

      markdown += '---\n\n';
    }
  }

  return markdown;
};

/**
 * Export to plain text format
 */
const exportToText = (output: ClusterSystemOutput): string => {
  let text = `Libreria Copy Meta Ads (${output.copyLengthFormat} format)\n`;
  text += `Schema: Cluster → Angolo → versioni declinate per livello di consapevolezza\n\n`;

  for (const cluster of output.clusters) {
    text += `CLUSTER — ${cluster.name}\n`;
    if (cluster.description) {
      text += `${cluster.description}\n`;
    }
    text += '\n';

    for (const angle of cluster.angles) {
      text += `  Angolo — ${angle.name}\n\n`;

      for (const version of angle.versions) {
        const awarenessLabel = formatAwarenessLevelLabel(version.level);
        text += `    Versione ${awarenessLabel}\n`;
        text += `    Primary Text:\n${version.primaryText}\n\n`;
        text += `    Headline: ${version.headline}\n`;
        text += `    Description: ${version.description}\n\n`;
      }
    }
  }

  return text;
};

/**
 * Export to JSON format
 */
const exportToJson = (output: ClusterSystemOutput): string => {
  return JSON.stringify(output, null, 2);
};

/**
 * Format awareness level for display
 */
const formatAwarenessLevelLabel = (level: AwarenessLevel): string => {
  switch (level) {
    case 'problem-aware':
      return 'Problem Aware (PAS pieno)';
    case 'solution-aware':
      return 'Solution Aware (peso sulla differenziazione)';
    case 'product-aware':
      return 'Product Aware (offerta + prova, PAS spento)';
  }
};

/**
 * Download exported content as file
 */
export const downloadExport = (content: string, filename: string, format: ExportFormat): void => {
  const mimeTypes: Record<ExportFormat, string> = {
    markdown: 'text/markdown',
    text: 'text/plain',
    json: 'application/json',
  };

  const extensions: Record<ExportFormat, string> = {
    markdown: '.md',
    text: '.txt',
    json: '.json',
  };

  const blob = new Blob([content], { type: mimeTypes[format] });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}${extensions[format]}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
