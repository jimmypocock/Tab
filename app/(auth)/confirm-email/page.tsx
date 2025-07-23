export default function ConfirmEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Check your email
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            We&apos;ve sent you a confirmation email. Please check your inbox and click the link to confirm your account.
          </p>
          
          <div className="mt-8 bg-blue-50 rounded-lg p-6">
            <p className="text-sm text-blue-800 font-medium mb-2">
              Local Development Tip:
            </p>
            <p className="text-sm text-blue-700">
              Visit <a href="http://localhost:54324" className="underline font-medium" target="_blank" rel="noopener noreferrer">
                http://localhost:54324
              </a> to view test emails sent by your local Supabase instance.
            </p>
          </div>
          
          <div className="mt-6">
            <a
              href="/login"
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Return to login
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}