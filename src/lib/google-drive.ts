import { google } from 'googleapis';

type DriveClient = ReturnType<typeof google.drive>;

interface SessionData {
  roomId: string;
  studentName: string;
  roomTopic: string;
  messages: { role: string; content: string }[];
  status?: string;
}

async function getDriveClient(): Promise<DriveClient | null> {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) return null;
  try {
    const credentials = JSON.parse(json);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    return google.drive({ version: 'v3', auth });
  } catch {
    console.error('Google Drive client init failed');
    return null;
  }
}

async function findOrCreateFolder(
  drive: DriveClient,
  name: string,
  parentId?: string
): Promise<string> {
  const parts = [
    `name='${name}'`,
    `mimeType='application/vnd.google-apps.folder'`,
    `trashed=false`,
    parentId ? `'${parentId}' in parents` : null,
  ].filter(Boolean);

  const res = await drive.files.list({ q: parts.join(' and '), fields: 'files(id)' });
  if (res.data.files?.length) return res.data.files[0].id!;

  const folder = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: 'id',
  });
  return folder.data.id!;
}

async function getTargetFolderId(drive: DriveClient): Promise<string> {
  // 환경변수로 폴더 ID를 직접 지정한 경우 바로 사용
  if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
    return process.env.GOOGLE_DRIVE_FOLDER_ID;
  }
  // 없으면 2026 > 클로드 > 분쟁조정위원회 폴더를 생성하거나 찾음
  const folder2026 = await findOrCreateFolder(drive, '2026');
  const folderClaude = await findOrCreateFolder(drive, '클로드', folder2026);
  return findOrCreateFolder(drive, '분쟁조정위원회', folderClaude);
}

export async function saveSessionToDrive(data: SessionData): Promise<void> {
  const drive = await getDriveClient();
  if (!drive) return;

  const { roomId, studentName, roomTopic, messages, status = 'ongoing' } = data;

  try {
    const folderId = await getTargetFolderId(drive);
    const fileName = `방${roomId}_${studentName}.json`;

    const body = JSON.stringify(
      {
        roomId,
        studentName,
        roomTopic,
        messages,
        status,
        messageCount: messages.length,
        lastUpdated: new Date().toISOString(),
      },
      null,
      2
    );

    // 기존 파일 찾기
    const q = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
    const existing = await drive.files.list({ q, fields: 'files(id)' });

    if (existing.data.files?.length) {
      await drive.files.update({
        fileId: existing.data.files[0].id!,
        media: { mimeType: 'application/json', body },
      });
    } else {
      await drive.files.create({
        requestBody: { name: fileName, parents: [folderId] },
        media: { mimeType: 'application/json', body },
        fields: 'id',
      });
    }
  } catch (err) {
    // Drive 저장 실패는 채팅을 막지 않음
    console.error('Google Drive save error:', err);
  }
}
