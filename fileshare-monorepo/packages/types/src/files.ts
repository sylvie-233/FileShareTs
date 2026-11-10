/** 上传目录中的单个文件。 */
export interface FileInfo {
  name: string;
  /** 文件大小（字节）。 */
  size: number;
  /** 最后修改时间（Unix 秒，含小数）。 */
  modified: number;
}

/** GET /api/v1/files */
export interface FileListResponse {
  files: FileInfo[];
}

/** POST /api/v1/upload */
export interface UploadResponse {
  filename: string;
  status: 'success';
}

/** DELETE /api/v1/files/{filename} */
export interface DeleteResponse {
  status: 'success';
  filename: string;
}

/** DELETE /api/v1/files */
export interface ClearAllResponse {
  status: 'success';
  count: number;
}

/** GET /api/v1/server-info */
export interface ServerInfoResponse {
  server_url: string;
}
