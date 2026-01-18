// 重新导出 IPC 服务
export { invokeIPC, invokeIPCFull, isElectronEnv } from './ipcApi';
export { resumeApi } from './resumeIpcService';
export { userApi } from './userIpcService';
export { dedupeApi } from './deduplicationIpcService';
export { versionApi } from './versionIpcService';
export { aiHrAssistantApi } from './aiHrAssistantIpcService';
export { getFilePath, readFileContent, readFileAsArrayBuffer, getFileMimeType, isSupportedFileType } from './fileHelper';
