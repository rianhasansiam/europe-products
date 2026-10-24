export default function PricingUnavailable() {
  return (
    <main className="min-h-[50vh] bg-brand-light-bg px-4 py-16">
      <div role="status" className="mx-auto max-w-xl rounded-2xl border border-brand-border bg-white p-8 text-center">
        <h1 className="text-xl font-bold text-gray-900">Prices are temporarily unavailable</h1>
        <p className="mt-3 text-sm text-gray-600">Please try again later. Your existing orders remain available.</p>
      </div>
    </main>
  );
}
