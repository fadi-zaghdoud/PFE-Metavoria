export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentification requise') {
    super(401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Accès refusé') {
    super(403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Ressource introuvable') {
    super(404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflit de données') {
    super(409, message);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Données invalides') {
    super(400, message);
  }
}
