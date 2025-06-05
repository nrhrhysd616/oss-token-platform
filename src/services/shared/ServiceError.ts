/**
 * サービス共通エラークラス
 */
export class ServiceError extends Error {
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
    this.name = 'ServiceError'
  }
}

/**
 * 寄付サービス専用エラークラス
 * donationのManager類でも利用しているためここで定義
 */
export class DonationServiceError extends ServiceError {
  constructor(
    message: string,
    code:
      | 'NOT_FOUND'
      | 'UNAUTHORIZED'
      | 'VALIDATION_ERROR'
      | 'DUPLICATE'
      | 'EXPIRED'
      | 'INTERNAL_ERROR',
    statusCode: number
  ) {
    super(message, code, statusCode)
    this.name = 'DonationServiceError'
  }
}
