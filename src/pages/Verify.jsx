import { useState } from "react";
import { useContract } from "../hooks/useContract.js";
import { Search, X } from "lucide-react";
import StatusBadge from "../components/StatusBadge.jsx";
import { custodyTimeline } from "../data/mockData.js";

const sampleQueries = ["MILK001", "TN-8800-401", "0X8F3C...9B2"];

export default function Verify() {
  const [query, setQuery] = useState("");
  const { batchExists } = useContract();
const [result, setResult] = useState(null);
const [checking, setChecking] = useState(false);

const handleVerify = async () => {
  if (!query.trim()) return;

  setChecking(true);
  setResult(null);

  try {
    const exists = await batchExists(query.trim());

    setResult({
      success: exists,
      message: exists
        ? `Batch ${query.trim()} exists on the Sepolia blockchain.`
        : `Batch ${query.trim()} was not found on the blockchain.`,
    });
  } catch (error) {
    console.error("Blockchain verification failed:", error);

    setResult({
      success: false,
      message: error?.message || "Unable to connect to the blockchain.",
    });
  } finally {
    setChecking(false);
  }
};

  return (
    <div className="mx-auto max-w-4xl px-4 md:px-8 py-12 space-y-10">
      <div className="text-center">
        <StatusBadge status="safe" label="PUBLIC BLOCKCHAIN AUDIT" filled />
        <h1 className="mt-4 font-serif text-3xl md:text-4xl text-ink-primary">
          Verify Milk Batch Authenticity
        </h1>
        <p className="mt-3 text-ink-secondary max-w-xl mx-auto leading-relaxed">
          Enter the batch ID stamped on your milk packet, paste a transaction
          hash, or scan the on-pack QR code to inspect complete cold chain
          telemetry.
        </p>
      </div>

      {/* Search row */}
      <div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Batch ID (MILK001)"
              className="w-full pl-11 pr-10 py-3 rounded-lg border border-border bg-white text-sm text-ink-primary placeholder:text-ink-muted focus:border-navy transition-default"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-navy font-mono text-xs"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
  type="button"
  onClick={handleVerify}
  disabled={checking}
  className="px-6 py-3 rounded-lg bg-navy text-white text-sm font-medium hover:bg-navy/90 hover:scale-[1.02] transition-default disabled:opacity-60"
>
  {checking ? "Checking..." : "Verify Batch"}
</button>
        </div>

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Sample Queries:
          </span>
          {sampleQueries.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQuery(q)}
              className="px-3 py-1 rounded-full border border-border font-mono text-xs text-ink-secondary hover:border-navy hover:text-navy transition-default"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {result && (
  <div
    className={`mt-4 rounded-lg border p-4 text-sm ${
      result.success
        ? "border-green-200 bg-green-50 text-green-800"
        : "border-red-200 bg-red-50 text-red-800"
    }`}
  >
    {result.message}
  </div>
)}


      {/* Custody timeline */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-lg font-semibold text-ink-primary">
            Immutable Custody Timeline
          </h3>
          <StatusBadge
            status="safe"
            label={`${custodyTimeline.length} Milestones Confirmed`}
            filled
          />
        </div>
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {custodyTimeline.map((step) => (
            <div
              key={step.batchId}
              className={`card-hover border rounded-xl p-4 ${
                step.active
                  ? "bg-navy text-white border-navy"
                  : "bg-card border-border"
              }`}
            >
              <p
                className={`text-sm font-semibold ${
                  step.active ? "text-white" : "text-ink-primary"
                }`}
              >
                {step.title}
              </p>
              <p
                className={`text-xs font-mono mt-1 ${
                  step.active ? "text-white/70" : "text-ink-muted"
                }`}
              >
                {step.batchId}
              </p>
              <p
                className={`text-xs mt-2 ${
                  step.active ? "text-white/80" : "text-ink-secondary"
                }`}
              >
                {step.note}
              </p>
              <p
                className={`text-xs mt-2 ${
                  step.active ? "text-white/60" : "text-ink-muted"
                }`}
              >
                {step.timestamp}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
