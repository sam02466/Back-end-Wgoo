export class AppError extends Error { constructor(public readonly code:string,message:string,public readonly statusCode=400){super(message);this.name="AppError";} }
export function assertApp(condition:unknown,code:string,message:string,statusCode=400):asserts condition{if(!condition)throw new AppError(code,message,statusCode);}
