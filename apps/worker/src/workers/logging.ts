const successLogsEnabled =
  process.env.WORKER_SUCCESS_LOGS === "1" ||
  (process.env.WORKER_SUCCESS_LOGS == null && process.env.NODE_ENV !== "production");

export function logWorkerSuccess(message: string): void {
  if (successLogsEnabled) {
    console.log(message);
  }
}
