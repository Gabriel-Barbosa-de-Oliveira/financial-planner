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

export class AccountNotFoundError extends DomainError {
  constructor() {
    super('ACCOUNT_NOT_FOUND', 404, 'Conta não encontrada');
  }
}

export class UsedAccountNameError extends DomainError {
  constructor() {
    super('USED_ACCOUNT_NAME', 409, 'Já existe uma conta com este nome');
  }
}

export class WorkspaceUnavailableError extends DomainError {
  constructor() {
    super('WORKSPACE_UNAVAILABLE', 422, 'Workspace padrão não encontrado');
  }
}

export class ClassificationNotFoundError extends DomainError {
  constructor() {
    super('CLASSIFICATION_NOT_FOUND', 404, 'Classificação não encontrada');
  }
}

export class UsedClassificationNameError extends DomainError {
  constructor() {
    super('USED_CLASSIFICATION_NAME', 409, 'Já existe uma classificação com este nome');
  }
}

export class ClassificationAlreadyActiveError extends DomainError {
  constructor() {
    super('CLASSIFICATION_ALREADY_ACTIVE', 409, 'Classificação já está ativa');
  }
}

export class CategoryNotFoundError extends DomainError {
  constructor() {
    super('CATEGORY_NOT_FOUND', 404, 'Categoria não encontrada');
  }
}

export class UsedCategoryNameError extends DomainError {
  constructor() {
    super('USED_CATEGORY_NAME', 409, 'Já existe uma categoria com este nome para este tipo');
  }
}

export class CategoryAlreadyActiveError extends DomainError {
  constructor() {
    super('CATEGORY_ALREADY_ACTIVE', 409, 'Categoria já está ativa');
  }
}

// Classificação informada no corpo de uma categoria não existe ou está desativada
export class InvalidClassificationError extends DomainError {
  constructor() {
    super('INVALID_CLASSIFICATION', 422, 'Classificação não encontrada');
  }
}
