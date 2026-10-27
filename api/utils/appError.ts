// A refusal from a service, like "item not found" with 404.
// Services know nothing about Express: they throw an AppError,
// and the error handler in app.ts turns it into the answer { message }.
export class AppError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}
