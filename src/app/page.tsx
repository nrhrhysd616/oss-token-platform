import WalletLinkStepper from '@/components/WalletLinkStepper'
import Header from '@/components/Header'

export default function Home() {
  return (
    <>
      <Header />
      <main className="min-h-screen py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">OSSトークンプラットフォーム</h1>
            <p className="text-gray-300 text-lg">
              GitHubとXRPLを連携したOSSトークン化プラットフォームへようこそ
            </p>
          </div>
          <WalletLinkStepper />
        </div>
      </main>
    </>
  )
}
