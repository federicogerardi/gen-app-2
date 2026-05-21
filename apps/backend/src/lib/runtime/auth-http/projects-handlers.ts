import type { IncomingMessage, ServerResponse } from 'node:http';

import type { AuthRepositoryBundle, UserQueryRepositoryBundle } from '../../adapters';
import type { AuthSessionPrincipal } from '../../types/auth';
import type { ArtifactListFilters, ArtifactReadProjection } from '../../types/artifacts';
import type { ArtifactStatus, ArtifactType } from '../../types/artifact';
import { isArtifactStatus, isArtifactType } from '../../types/artifact';
import { contentTypeForFormat, parseDownloadFormat } from '../downloads/download-format';
import { artifactDownloadFilename, contentDispositionAttachment } from '../downloads/download-filename';
import { serializeArtifactDownload } from '../downloads/download-serializers';

export type ProjectsHandlers = {
  handleProjectsList(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleProjectsCreate(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleProjectById(request: IncomingMessage, response: ServerResponse, projectId: string): Promise<void>;
  handleArtifactsList(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleArtifactById(request: IncomingMessage, response: ServerResponse, artifactId: string): Promise<void>;
  handleArtifactDownload(
    request: IncomingMessage,
    response: ServerResponse,
    artifactId: string,
  ): Promise<void>;
};

type CreateProjectRequestBody = {
  name?: unknown;
  description?: unknown;
};

type WriteError = (
  response: ServerResponse,
  statusCode: number,
  code:
    | 'bad_request'
    | 'unauthorized'
    | 'forbidden'
    | 'method_not_allowed'
    | 'not_found'
    | 'service_unavailable',
  message: string,
) => void;

type WriteSuccess = (response: ServerResponse, statusCode: number, data: Record<string, unknown>) => void;

export type CreateProjectsHandlersDependencies = {
  repositories: AuthRepositoryBundle;
  now: () => Date;
  parseRequestUrl: (request: IncomingMessage) => URL;
  parseJsonBody: <T>(request: IncomingMessage) => Promise<T>;
  requireSessionPrincipal: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<AuthSessionPrincipal | null>;
  requireQueryRepositories: (response: ServerResponse) => UserQueryRepositoryBundle | null;
  writeError: WriteError;
  writeSuccess: WriteSuccess;
};

const parseBooleanQueryFlag = (value: string | null): boolean => {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

export const parseArtifactReadProjection = (searchParams: URLSearchParams): ArtifactReadProjection => {
  return {
    includeInput: parseBooleanQueryFlag(searchParams.get('includeInput')),
    includeContent: parseBooleanQueryFlag(searchParams.get('includeContent')),
  };
};

export const createProjectsHandlers = (deps: CreateProjectsHandlersDependencies): ProjectsHandlers => {
  const {
    repositories,
    now,
    parseRequestUrl,
    parseJsonBody,
    requireSessionPrincipal,
    requireQueryRepositories,
    writeError,
    writeSuccess,
  } = deps;

  const handleProjectsList = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for projects list');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) {
      return;
    }

    const queries = requireQueryRepositories(response);
    if (!queries) {
      return;
    }

    const projects = await queries.projects.listProjectsByUser(principal.user.id);
    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, { projects });
  };

  const handleProjectsCreate = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for create project');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) {
      return;
    }

    const queries = requireQueryRepositories(response);
    if (!queries) {
      return;
    }

    let body: CreateProjectRequestBody;
    try {
      body = await parseJsonBody<CreateProjectRequestBody>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      writeError(response, 400, 'bad_request', 'Project name is required');
      return;
    }

    const description = typeof body.description === 'string' ? body.description.trim() : undefined;
    const project = await queries.projects.createProjectForUser(principal.user.id, {
      name,
      ...(description ? { description } : {}),
    });

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 201, { project });
  };

  const handleProjectById = async (
    request: IncomingMessage,
    response: ServerResponse,
    projectId: string,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for project detail');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) {
      return;
    }

    const queries = requireQueryRepositories(response);
    if (!queries) {
      return;
    }

    const project = await queries.projects.getProjectByIdForUser(principal.user.id, projectId);
    if (!project) {
      writeError(response, 404, 'not_found', 'Project not found');
      return;
    }

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, { project });
  };

  const handleArtifactsList = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for artifacts list');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) {
      return;
    }

    const queries = requireQueryRepositories(response);
    if (!queries) {
      return;
    }

    const url = parseRequestUrl(request);
    const typeRaw = url.searchParams.get('type');
    const statusRaw = url.searchParams.get('status');
    const projectIdRaw = url.searchParams.get('projectId');
    const fromRaw = url.searchParams.get('from');
    const toRaw = url.searchParams.get('to');
    const limitRaw = url.searchParams.get('limit');
    const offsetRaw = url.searchParams.get('offset');

    if (typeRaw && !isArtifactType(typeRaw)) {
      writeError(response, 400, 'bad_request', 'Invalid type filter');
      return;
    }

    if (statusRaw && !isArtifactStatus(statusRaw)) {
      writeError(response, 400, 'bad_request', 'Invalid status filter');
      return;
    }

    if (projectIdRaw !== null && projectIdRaw.trim().length === 0) {
      writeError(response, 400, 'bad_request', 'Invalid projectId filter');
      return;
    }

    if (fromRaw && Number.isNaN(Date.parse(fromRaw))) {
      writeError(response, 400, 'bad_request', 'Invalid from filter');
      return;
    }

    if (toRaw && Number.isNaN(Date.parse(toRaw))) {
      writeError(response, 400, 'bad_request', 'Invalid to filter');
      return;
    }

    if (limitRaw !== null) {
      const limit = Number.parseInt(limitRaw, 10);
      if (!Number.isFinite(limit) || limit <= 0) {
        writeError(response, 400, 'bad_request', 'Invalid limit filter');
        return;
      }
    }

    if (offsetRaw !== null) {
      const offset = Number.parseInt(offsetRaw, 10);
      if (!Number.isFinite(offset) || offset < 0) {
        writeError(response, 400, 'bad_request', 'Invalid offset filter');
        return;
      }
    }

    const filters: ArtifactListFilters = {};
    if (typeRaw) {
      filters.type = typeRaw as ArtifactType;
    }
    if (statusRaw) {
      filters.status = statusRaw as ArtifactStatus;
    }
    if (projectIdRaw) {
      filters.projectId = projectIdRaw;
    }
    if (fromRaw) {
      filters.from = fromRaw;
    }
    if (toRaw) {
      filters.to = toRaw;
    }
    if (limitRaw !== null) {
      filters.limit = Number.parseInt(limitRaw, 10);
    }
    if (offsetRaw !== null) {
      filters.offset = Number.parseInt(offsetRaw, 10);
    }

    const canViewAllArtifacts = principal.user.role === 'admin';
    const artifacts = canViewAllArtifacts
      ? await queries.artifacts.listArtifacts(filters)
      : await queries.artifacts.listArtifactsByUser(principal.user.id, filters);
    const totalResults = canViewAllArtifacts
      ? await queries.artifacts.countArtifacts(filters)
      : await queries.artifacts.countArtifactsByUser(principal.user.id, filters);

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, { artifacts, totalResults });
  };

  const handleArtifactById = async (
    request: IncomingMessage,
    response: ServerResponse,
    artifactId: string,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for artifact detail');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) {
      return;
    }

    const queries = requireQueryRepositories(response);
    if (!queries) {
      return;
    }

    const projection = parseArtifactReadProjection(parseRequestUrl(request).searchParams);
    const canViewAllArtifacts = principal.user.role === 'admin';
    const artifact = canViewAllArtifacts
      ? await queries.artifacts.getArtifactById(artifactId, projection)
      : await queries.artifacts.getArtifactByIdForUser(principal.user.id, artifactId, projection);
    if (!artifact) {
      writeError(response, 404, 'not_found', 'Artifact not found');
      return;
    }

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, { artifact });
  };

  const handleArtifactDownload = async (
    request: IncomingMessage,
    response: ServerResponse,
    artifactId: string,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for artifact download');
      return;
    }

    const url = parseRequestUrl(request);
    const format = parseDownloadFormat(url.searchParams);
    if (!format) {
      writeError(response, 400, 'bad_request', 'format must be one of: md, txt, docx');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) {
      return;
    }

    const queries = requireQueryRepositories(response);
    if (!queries) {
      return;
    }

    const canViewAllArtifacts = principal.user.role === 'admin';
    const artifact = canViewAllArtifacts
      ? await queries.artifacts.getArtifactById(artifactId, { includeContent: true })
      : await queries.artifacts.getArtifactByIdForUser(principal.user.id, artifactId, {
        includeContent: true,
      });
    if (!artifact) {
      writeError(response, 404, 'not_found', 'Artifact not found');
      return;
    }

    const fileBuffer = await serializeArtifactDownload(artifactId, artifact.content ?? '', format);
    const filename = artifactDownloadFilename(artifactId, format);

    await repositories.sessions.touchSession(principal.session.id, now());

    response.statusCode = 200;
    response.setHeader('Content-Type', contentTypeForFormat(format));
    response.setHeader('Content-Disposition', contentDispositionAttachment(filename));
    response.setHeader('Content-Length', fileBuffer.length);
    response.end(fileBuffer);
  };

  return {
    handleProjectsList,
    handleProjectsCreate,
    handleProjectById,
    handleArtifactsList,
    handleArtifactById,
    handleArtifactDownload,
  };
};
