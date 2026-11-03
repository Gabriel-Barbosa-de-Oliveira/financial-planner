export class DomainError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, statusCode: number, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class UsedEmailError extends DomainError {
  constructor() {
    super('USED_EMAIL', 409, 'E-mail já está em uso');
  }
}

export class UserNotFoundError extends DomainError {
  constructor() {
    super('USER_NOT_FOUND', 404, 'Usuário não encontrado');
  }
}
