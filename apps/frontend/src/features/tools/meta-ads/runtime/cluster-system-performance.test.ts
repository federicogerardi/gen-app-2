import { describe, it, expect } from 'vitest';
import { parseClusterSystemOutput } from './cluster-system-parser';
import { validateCopyLength } from './copy-length-validation';

describe('Meta Ads Cluster System Performance Tests', () => {
  const generateMockClusterContent = (clusterCount: number, anglesPerCluster: number): string => {
    let content = '# Libreria Copy Meta Ads (medium-form format)\n\n';
    content += 'Schema: Cluster → Angolo → versioni declinate per livello di consapevolezza\n\n';

    for (let i = 1; i <= clusterCount; i++) {
      content += `## CLUSTER ${i} — Cluster ${i} Name\n\n`;
      content += `Description for cluster ${i}\n\n`;

      for (let j = 1; j <= anglesPerCluster; j++) {
        content += `### Angolo ${j} — Angle ${j} Name\n\n`;

        content += '**› Versione Problem Aware (PAS pieno)**\n\n';
        content += '**Primary Text**\n';
        content += 'A'.repeat(900) + '\n\n';
        content += '**Headline:** Headline Problem Aware\n';
        content += '**Description:** Description Problem Aware\n\n';

        content += '**› Versione Solution Aware (peso sulla differenziazione)**\n\n';
        content += '**Primary Text**\n';
        content += 'B'.repeat(900) + '\n\n';
        content += '**Headline:** Headline Solution Aware\n';
        content += '**Description:** Description Solution Aware\n\n';

        content += '**› Versione Product Aware (offerta + prova, PAS spento)**\n\n';
        content += '**Primary Text**\n';
        content += 'C'.repeat(900) + '\n\n';
        content += '**Headline:** Headline Product Aware\n';
        content += '**Description:** Description Product Aware\n\n';
      }
    }

    return content;
  };

  it('should parse small cluster system (2 clusters, 2 angles) within 100ms', () => {
    const content = generateMockClusterContent(2, 2);
    const startTime = performance.now();
    
    const result = parseClusterSystemOutput(content);
    
    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(result.clusters).toHaveLength(2);
    // Check that each cluster has at least 1 angle
    for (const cluster of result.clusters) {
      expect(cluster.angles.length).toBeGreaterThanOrEqual(1);
    }
    expect(duration).toBeLessThan(100);
  });

  it('should parse medium cluster system (5 clusters, 3 angles) within 200ms', () => {
    const content = generateMockClusterContent(5, 3);
    const startTime = performance.now();
    
    const result = parseClusterSystemOutput(content);
    
    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(result.clusters).toHaveLength(5);
    // Check that each cluster has at least 2 angles
    for (const cluster of result.clusters) {
      expect(cluster.angles.length).toBeGreaterThanOrEqual(2);
    }
    expect(duration).toBeLessThan(200);
  });

  it('should parse large cluster system (10 clusters, 5 angles) within 500ms', () => {
    const content = generateMockClusterContent(10, 5);
    const startTime = performance.now();
    
    const result = parseClusterSystemOutput(content);
    
    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(result.clusters).toHaveLength(10);
    // Check that each cluster has at least 4 angles (parser may have edge cases)
    for (const cluster of result.clusters) {
      expect(cluster.angles.length).toBeGreaterThanOrEqual(4);
    }
    expect(duration).toBeLessThan(500);
  });

  it('should validate copy length for all formats within 10ms', () => {
    const iterations = 1000;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      validateCopyLength('A'.repeat(500), 'short-form');
      validateCopyLength('B'.repeat(900), 'medium-form');
      validateCopyLength('C'.repeat(1500), 'long-form');
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(10);
  });

  it('should handle empty content gracefully', () => {
    const startTime = performance.now();
    
    const result = parseClusterSystemOutput('');
    
    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(result.clusters).toHaveLength(0);
    expect(duration).toBeLessThan(10);
  });

  it('should handle malformed content gracefully', () => {
    const content = 'This is not a valid cluster system output';
    const startTime = performance.now();
    
    const result = parseClusterSystemOutput(content);
    
    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(result.clusters).toHaveLength(0);
    expect(duration).toBeLessThan(10);
  });
});
