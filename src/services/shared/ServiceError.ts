/**
 * サービス共通エラークラス
 */
export class ServiceError extends Error {
  public name = 'ServiceError'
  constructor(
    message: string,
    public code:
      | 'NOT_FOUND'
      | 'UNAUTHORIZED'
      | 'VALIDATION_ERROR'
      | 'DUPLICATE'
      | 'EXPIRED'
      | 'INTERNAL_ERROR',
    public statusCode: number
  ) {
    super(message)
  }
}
