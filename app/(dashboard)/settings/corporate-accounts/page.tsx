import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { corporateMerchantRelationships, corporateAccounts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export default async function CorporateAccountsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get corporate relationships for this merchant
  const relationships = await db
    .select({
      relationship: corporateMerchantRelationships,
      account: corporateAccounts,
    })
    .from(corporateMerchantRelationships)
    .innerJoin(
      corporateAccounts,
      eq(corporateMerchantRelationships.corporateAccountId, corporateAccounts.id)
    )
    .where(eq(corporateMerchantRelationships.merchantId, user.id))
    .orderBy(corporateMerchantRelationships.createdAt)

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Corporate Accounts</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage your relationships with corporate customers
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            className="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Add Corporate Account
          </button>
        </div>
      </div>

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Account Number
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Company Name
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Credit Limit
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Payment Terms
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Contact
                    </th>
                    <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {relationships.map(({ relationship, account }) => (
                    <tr key={relationship.id}>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                        {account.accountNumber}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                        {account.companyName}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          relationship.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : relationship.status === 'pending_approval'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {relationship.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {relationship.creditLimit ? `$${relationship.creditLimit}` : 'N/A'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {relationship.paymentTerms || 'N/A'}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500">
                        <div>
                          {relationship.billingContactName || account.primaryContactName}
                        </div>
                        <div className="text-gray-400">
                          {relationship.billingContactEmail || account.primaryContactEmail}
                        </div>
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <a
                          href={`/settings/corporate-accounts/${relationship.id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Manage
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {relationships.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-500">
                    No corporate accounts connected yet
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          About Corporate Accounts
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Corporate accounts allow your business customers to:
        </p>
        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
          <li>Create tabs using their corporate API key</li>
          <li>Track all their purchases across your business</li>
          <li>Manage multiple authorized users</li>
          <li>Set up custom payment terms and credit limits</li>
          <li>Receive consolidated invoices</li>
        </ul>
      </div>
    </div>
  )
}