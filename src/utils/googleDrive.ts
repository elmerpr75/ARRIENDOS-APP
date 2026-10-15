/**
 * Google Drive Backup & Restore Client
 */

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  modifiedTime: string;
  size?: string;
}

export interface PruneBackupsResult {
  totalScanned: number;
  deletedCount: number;
  keptCount: number;
  deletedFileNames: string[];
  cutoffDateIso: string;
}

/**
 * Deletes a file permanently from Google Drive (or cleans up obsolete app backups)
 */
export async function deleteFileFromDrive(
  accessToken: string,
  fileId: string
): Promise<boolean> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (response.status === 401) {
    throw new Error('AUTH_EXPIRED: Token de Google Drive expirado o no autorizado.');
  }

  // 204 No Content, 200 OK, or 404 Not Found (already deleted)
  return response.status === 204 || response.status === 200 || response.status === 404;
}

/**
 * Extracts a clean Google Drive folder ID from a folder ID or a full Google Drive URL
 * e.g. "https://drive.google.com/drive/folders/1Px4VzDkrEMDuVh5dmKCWGaArul_ZVcO1?usp=drive_link"
 * -> "1Px4VzDkrEMDuVh5dmKCWGaArul_ZVcO1"
 */
export function extractFolderId(inputOrUrl: string): string {
  if (!inputOrUrl) return '';
  const trimmed = inputOrUrl.trim();
  const folderMatch = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) {
    return folderMatch[1];
  }
  const idMatch = trimmed.match(/id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }
  // If it's already an ID
  return trimmed.split('?')[0].replace(/\/$/, '');
}

/**
 * Searches for backup files in Google Drive, prioritizing the given targetFolderId
 */
export async function listBackupsFromDrive(
  accessToken: string,
  targetFolderId?: string,
  fetchAll = false
): Promise<DriveBackupFile[]> {
  const cleanFolderId = targetFolderId ? extractFolderId(targetFolderId) : '';
  const filesMap = new Map<string, DriveBackupFile>();

  const executeSearch = async (q: string): Promise<DriveBackupFile[]> => {
    let pageToken: string | undefined = undefined;
    const results: DriveBackupFile[] = [];

    do {
      const url = new URL('https://www.googleapis.com/drive/v3/files');
      url.searchParams.set('q', q);
      url.searchParams.set('fields', 'nextPageToken, files(id, name, createdTime, modifiedTime, size)');
      url.searchParams.set('orderBy', 'modifiedTime desc');
      url.searchParams.set('pageSize', fetchAll ? '100' : '50');
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (res.status === 401) {
        throw new Error('AUTH_EXPIRED: Token de Google Drive expirado o no autorizado.');
      }

      if (!res.ok) {
        break;
      }

      const data = await res.json();
      if (data.files && Array.isArray(data.files)) {
        results.push(...data.files);
      }
      pageToken = fetchAll ? data.nextPageToken : undefined;
    } while (pageToken);

    return results;
  };

  // 1. If a specific folder ID is provided, search inside that folder
  if (cleanFolderId) {
    try {
      const folderQuery = `'${cleanFolderId}' in parents and trashed = false and (name contains 'respaldo_arrendamientos' or name contains 'respaldo_rentas' or name contains '.json' or mimeType = 'application/json')`;
      const folderFiles = await executeSearch(folderQuery);
      folderFiles.forEach((f) => filesMap.set(f.id, f));
    } catch (e: any) {
      if (e?.message?.includes('AUTH_EXPIRED')) throw e;
      console.warn('Folder search issue:', e);
    }
  }

  // 2. Search for app backups across user's Drive (covers root Drive backups or auto-saved backups)
  try {
    const appQuery = "trashed = false and (name contains 'respaldo_arrendamientos' or name contains 'respaldo_rentas')";
    const appFiles = await executeSearch(appQuery);
    appFiles.forEach((f) => {
      if (!filesMap.has(f.id)) {
        filesMap.set(f.id, f);
      }
    });
  } catch (e: any) {
    if (e?.message?.includes('AUTH_EXPIRED')) throw e;
    console.warn('Drive app search issue:', e);
  }

  // Sort all found backups newest first
  const allFiles = Array.from(filesMap.values()).sort(
    (a, b) => new Date(b.modifiedTime || b.createdTime).getTime() - new Date(a.modifiedTime || a.createdTime).getTime()
  );

  return allFiles;
}

/**
 * Automatically prunes old JSON backups associated with the application from Google Drive.
 * Policy: Retains the latest 350 files OR all files from the last 6 months (whichever retains more).
 * Only deletes files if they are BOTH beyond the 350 newest backups AND older than 6 months.
 */
export async function pruneOldBackupsFromDrive(
  accessToken: string,
  targetFolderId?: string,
  options?: {
    minFilesToKeep?: number; // Defaults to 350
    minMonthsToKeep?: number; // Defaults to 6
  }
): Promise<PruneBackupsResult> {
  const minFilesToKeep = options?.minFilesToKeep ?? 350;
  const minMonthsToKeep = options?.minMonthsToKeep ?? 6;

  // 1. Fetch all app backup files (full pagination)
  const allBackups = await listBackupsFromDrive(accessToken, targetFolderId, true);

  // Sort strictly newest first
  allBackups.sort((a, b) => {
    const timeA = new Date(a.modifiedTime || a.createdTime).getTime();
    const timeB = new Date(b.modifiedTime || b.createdTime).getTime();
    return timeB - timeA;
  });

  // Calculate cutoff date (6 months prior to today)
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - minMonthsToKeep);
  const cutoffTime = cutoffDate.getTime();

  const toDelete: DriveBackupFile[] = [];
  const toKeep: DriveBackupFile[] = [];

  for (let i = 0; i < allBackups.length; i++) {
    const file = allBackups[i];
    const fileTime = new Date(file.modifiedTime || file.createdTime).getTime();

    // Retention policy: "Más allá de los últimos 350 archivos, o 6 meses (lo que sea mayor)"
    // Kept if it's within the 350 newest OR created within the last 6 months.
    const isWithinNewest350 = i < minFilesToKeep;
    const isWithin6Months = fileTime >= cutoffTime;

    if (isWithinNewest350 || isWithin6Months) {
      toKeep.push(file);
    } else {
      // Safety condition: Only purge files that clearly match application backup naming
      const lower = file.name.toLowerCase();
      if (
        lower.startsWith('respaldo_arrendamientos_') ||
        lower.startsWith('respaldo_rentas_') ||
        lower.startsWith('arriendos-respaldo-') ||
        (targetFolderId && lower.endsWith('.json'))
      ) {
        toDelete.push(file);
      } else {
        toKeep.push(file);
      }
    }
  }

  const deletedFileNames: string[] = [];

  // Delete obsolete files sequentially with error tolerance
  for (const file of toDelete) {
    try {
      const ok = await deleteFileFromDrive(accessToken, file.id);
      if (ok) {
        deletedFileNames.push(file.name);
      }
    } catch (err) {
      console.warn(`Could not delete obsolete backup file ${file.name} (${file.id}):`, err);
    }
  }

  return {
    totalScanned: allBackups.length,
    deletedCount: deletedFileNames.length,
    keptCount: toKeep.length,
    deletedFileNames,
    cutoffDateIso: cutoffDate.toISOString(),
  };
}

/**
 * Uploads a JSON backup file to Google Drive.
 * If targetFolderId is provided, places it directly in that folder.
 * After uploading, automatically applies the retention policy to clean up obsolete backups.
 */
export async function uploadBackupToDrive(
  accessToken: string,
  backupJsonContent: string,
  targetFolderId?: string
): Promise<{
  fileId: string;
  fileName: string;
  webViewLink?: string;
  isRootBackup?: boolean;
  pruneResult?: PruneBackupsResult;
}> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `respaldo_arrendamientos_${timestamp}.json`;

  const cleanFolderId = targetFolderId ? extractFolderId(targetFolderId) : '';

  const executeUpload = async (folderId?: string) => {
    const metadata: Record<string, any> = {
      name: fileName,
      mimeType: 'application/json',
      description: 'Respaldo de Base de Datos - ARRIENDOS - Rent Manager',
    };

    if (folderId) {
      metadata.parents = [folderId];
    }

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      backupJsonContent +
      closeDelimiter;

    return await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,parents',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      }
    );
  };

  // Attempt upload to folder first if provided
  let response = await executeUpload(cleanFolderId || undefined);

  // If folder upload returned 403 (insufficient scopes for custom folder) or 404, fallback to user's root Drive!
  let usedRoot = false;
  if (!response.ok && cleanFolderId) {
    console.warn('Upload to specific folder failed, falling back to root Drive upload...');
    response = await executeUpload(undefined);
    usedRoot = true;
  }

  if (response.status === 401) {
    throw new Error('AUTH_EXPIRED: Token de Google Drive expirado o no autorizado.');
  }

  if (!response.ok) {
    const errorText = await response.text();
    let message = 'Error al subir el archivo a Google Drive.';
    try {
      const errJson = JSON.parse(errorText);
      if (errJson.error?.message) {
        message = `${message} (${errJson.error.message})`;
      }
    } catch {
      message = `${message} (${errorText})`;
    }
    throw new Error(message);
  }

  const data = await response.json();

  // Automatic retention cleanup: Keep latest 350 files or 6 months (whichever is greater), prune older ones
  let pruneResult: PruneBackupsResult | undefined = undefined;
  try {
    pruneResult = await pruneOldBackupsFromDrive(accessToken, cleanFolderId || undefined);
  } catch (pruneErr) {
    console.warn('Auto-pruning obsolete backups warning (non-fatal):', pruneErr);
  }

  return {
    fileId: data.id,
    fileName: data.name,
    webViewLink: data.webViewLink,
    isRootBackup: usedRoot || !cleanFolderId,
    pruneResult,
  };
}

/**
 * Downloads the content of a specific backup file by fileId
 */
export async function downloadBackupFromDrive(
  accessToken: string,
  fileId: string
): Promise<string> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (response.status === 401) {
    throw new Error('AUTH_EXPIRED: Token de Google Drive expirado o no autorizado.');
  }

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Error al descargar el respaldo de Google Drive: ${err}`);
  }

  return await response.text();
}
