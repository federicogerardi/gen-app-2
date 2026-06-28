/**
 * Central configuration for UI magic numbers.
 * Import from here instead of scattering literals across components.
 */

export const UI_CONFIG = {
  pagination: {
    /** Number of artifact rows shown per page in ArtifactsListingSection */
    artifactsPageSize: 10,
    /** Number of session rows shown per page in SessionsListingSection */
    sessionsPageSize: 10,
    /** Number of screenshot rows shown per page in GeometricScreenshotsPage */
    geometricScreenshotsPageSize: 10,
  },
  limits: {
    /** Maximum in-memory artifacts kept in GenerationWorkspaceProvider */
    maxLocalArtifactsCache: 200,
    /** Maximum checkpoint history entries kept in the stream machine */
    maxStoredCheckpoints: 100,
    /** Maximum activity-feed items shown in the admin panel */
    adminActivityFeedMaxItems: 20,
    /** Maximum items shown in the dashboard "recent sessions" list */
    dashboardRecentSessionsCount: 5,
  },
  preview: {
    /** Character limit for the content preview stored in a ToolCheckpoint */
    contentPreviewMaxLength: 240,
    /** Character limit for the step preview shown in ToolStepCard */
    toolStepPreviewMaxChars: 500,
  },
  delays: {
    /** How long (ms) the "Copied!" state persists after a clipboard action */
    clipboardFeedbackMs: 2000,
  },
  feedback: {
    /** Auto-dismiss TTLs (ms) for each feedback severity */
    ttl: {
      success: 3500,
      info: 4000,
      warning: 5000,
      error: 6500,
    },
  },
} as const;
