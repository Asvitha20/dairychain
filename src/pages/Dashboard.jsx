import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Milk,
  Bell,
  Boxes,
  Thermometer,
  Download,
  Plus,
  Settings2,
  Radio,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import PageHeader from "../components/PageHeader.jsx";
import StatCard from "../components/StatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import BlockchainBadge from "../components/BlockchainBadge.jsx";
import LivePulse from "../components/LivePulse.jsx";
import BlockchainSimulator from "../components/BlockchainSimulator.jsx";
import DataTable from "../components/DataTable.jsx";
import { useLiveTemperature } from "../hooks/useLiveTemperature";
import { useContract } from "../hooks/useContract";
import {
  recentBatches,
  sensorFeed,
  gridNetworkNodes,
  milk001TemperatureLog,
} from "../data/mockData.js";

const columns = [
  { key: "id", label: "Batch ID" },
  { key: "origin", label: "Origin Cooperative" },
  { key: "volume", label: "Milk Volume", align: "right" },
  { key: "avgTemp", label: "Avg Temp" },
  { key: "route", label: "Route" },
  { key: "contract", label: "Smart Contract" },
  { key: "action", label: "Action", align: "right" },
];

export default function Dashboard() {
  const { createBatch } = useContract();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [form, setForm] = useState({ batchId: "", containerId: "", originCooperative: "", volumeLiters: "" });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const submitBatch = async (event) => {
    event.preventDefault();
    setFeedback(null);
    const data = {
      batchId: form.batchId.trim(),
      containerId: form.containerId.trim(),
      originCooperative: form.originCooperative.trim(),
      volumeLiters: Number(form.volumeLiters),
    };
    if (!data.batchId || !data.containerId || !data.originCooperative || !Number.isSafeInteger(data.volumeLiters) || data.volumeLiters <= 0) {
      setFeedback({ error: true, text: "Enter all fields and a positive whole-number volume." });
      return;
    }
    if (!window.ethereum) {
      setFeedback({ error: true, text: "MetaMask is unavailable. Enable the extension and retry." });
      return;
    }
    setSubmitting(true);
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      if (Number.parseInt(chainId, 16) !== 11155111) {
        setFeedback({ error: true, text: "Switch MetaMask to Sepolia and try again." });
        return;
      }
      const result = await createBatch(data);
      setFeedback({ text: "Batch " + data.batchId + " created on Sepolia. Transaction: " + result.txHash, txHash: result.txHash, batchId: data.batchId });
      setForm({ batchId: "", containerId: "", originCooperative: "", volumeLiters: "" });
    } catch (error) {
      let errorText = error?.shortMessage || error?.reason || error?.message || "Transaction failed.";
      if (error?.code === 4001 || error?.code === "ACTION_REJECTED") errorText = "Transaction rejected in MetaMask.";
      else if (/onlyowner|ownable|not the owner/i.test(errorText)) errorText = "Wrong wallet. Connect the MetaMask account that deployed this contract.";
      setFeedback({ error: true, text: errorText });
    } finally {
      setSubmitting(false);
    }
  };

  const {
    temperature,
    humidity,
    lastUpdate,
    history,
    isConnected,
    mqttConnected,
    relay,
    mode,
    limit,
  } = useLiveTemperature();

  // If live sensor is connected, use real-time hardware data; otherwise provide calibrated simulation telemetry
  const displayHistory = history.length > 0 ? history : milk001TemperatureLog.map((item) => ({
    timestamp: item.time,
    temperature: item.temp,
    label: item.label || item.time,
  }));

  const displayTemp = temperature !== null ? temperature : 3.82;
  const displayHumidity = humidity !== null ? humidity : 64.2;

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-8 py-8 space-y-8">
      <PageHeader
        eyebrow={
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status="safe" label="Blockchain Enabled" filled />
            <span className="text-sm text-ink-muted font-mono">
              Block #18,492
            </span>
            <span className="text-sm text-ink-muted">
              Last Updated 18:42:15 IST
            </span>
          </div>
        }
        title="Supply Chain Telemetry & Milk Fleet Overview"
        actions={
          <>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-navy text-navy text-sm font-medium hover:bg-navy hover:text-white transition-default"
            >
              <Download className="w-4 h-4" />
              Download Cold Chain Audit
            </button>
            <button
              type="button"
              onClick={() => { setFeedback(null); setRegisterOpen(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white text-sm font-medium hover:bg-navy/90 hover:scale-[1.02] transition-default"
            >
              <Plus className="w-4 h-4" />
              Register New Batch
            </button>
          </>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Batches"
          value="42"
          note="↑ 12% vs. Yesterday"
          noteTone="positive"
          icon={Milk}
        />
        <StatCard
          label="Alerts Today"
          value="0"
          note="0 Zero Breaches"
          noteTone="positive"
          icon={Bell}
        />
        <StatCard
          label="Blocks Mined"
          value="18,492"
          note="Consensus: Layer Synchronized"
          noteTone="neutral"
          icon={Boxes}
        />
        {/* Live Temperature Card — powered by ESP32 sensor */}
        <div className="card-hover bg-card border border-border rounded-xl shadow-sm p-6">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Avg. Temperature
            </span>
            <Thermometer className="w-4 h-4 text-ink-muted" />
          </div>
          <div className="mt-2 font-sans font-semibold text-4xl text-ink-primary">
            {displayTemp.toFixed(2)}°C
          </div>
          <p className="mt-1 text-sm text-ink-secondary">💧 {displayHumidity.toFixed(1)}%</p>
          {relay && (
            <p className="mt-1 text-xs text-ink-muted flex items-center gap-1.5 flex-wrap">
              <span>Chiller: <strong className={relay === 'ON' ? 'text-mint font-semibold' : 'text-amber font-semibold'}>{relay}</strong></span>
              {mode && <span className="text-[10px] px-1.5 py-0.5 rounded bg-navy/5 text-navy font-semibold uppercase">{mode}</span>}
              {limit != null && <span className="text-[11px] text-ink-muted">({limit}°C limit)</span>}
            </p>
          )}
          <p className={`mt-1 text-sm font-medium ${isConnected ? 'text-mint' : 'text-amber'}`}>
            {isConnected ? '🟢 Live Hardware' : '⚡ Telemetry Simulation'}
          </p>
          <p className={`text-xs ${mqttConnected ? 'text-mint' : 'text-amber'}`}>
            {mqttConnected ? '📡 MQTT Connected' : '📡 MQTT Offline'}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {lastUpdate ? `Updated ${new Date(lastUpdate).toLocaleTimeString()}` : 'Streaming calibrated node feed'}
          </p>
        </div>
      </div>

      {/* ── Live Temperature Chart ──────────────────────────── */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-ink-primary">
              📡 Live Cold-Chain Temperature Feed
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              Continuous thermal data points streamed from transponder sensors
            </p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
            isConnected
              ? 'bg-mint/10 border-mint/20 text-mint'
              : 'bg-amber/10 border-amber/20 text-amber'
          }`}>
            {isConnected ? '● Hardware Connected' : '● Simulation Feed Active'}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={displayHistory}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(ts) => {
                if (typeof ts === 'string' && ts.length <= 10) return ts;
                try { return new Date(ts).toLocaleTimeString(); } catch { return ts; }
              }}
              tick={{ fontSize: 11, fill: '#94A3B8' }}
              stroke="#E5E7EB"
            />
            <YAxis
              domain={[2, 8]}
              tick={{ fontSize: 11, fill: '#94A3B8' }}
              stroke="#E5E7EB"
              unit="°C"
            />
            <Tooltip
              labelFormatter={(ts) => {
                if (typeof ts === 'string' && ts.length <= 10) return `Time: ${ts}`;
                try { return new Date(ts).toLocaleString(); } catch { return ts; }
              }}
              formatter={(val) => [`${val}°C`, 'Temperature']}
              contentStyle={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                fontSize: '13px',
              }}
            />
            <Line
              type="monotone"
              dataKey="temperature"
              stroke="#22C55E"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#22C55E' }}
              activeDot={{ r: 5, fill: '#16A34A' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <BlockchainSimulator />

      {/* Map + Sensor feed */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-ink-primary">
            Tamil Nadu Dairy Grid Network
          </h3>
          <svg viewBox="0 0 400 300" className="w-full h-64 mt-4">
            <rect x="0" y="0" width="400" height="300" rx="12" fill="#F8F9FB" />
            {/* Routes */}
            <path
              d="M 120 210 L 180 150 L 240 90 L 300 60"
              stroke="#D1D5DB"
              strokeWidth="2"
              fill="none"
              strokeDasharray="4 4"
            />
            <path
              d="M 180 150 L 260 200"
              stroke="#D1D5DB"
              strokeWidth="2"
              fill="none"
              strokeDasharray="4 4"
            />
            {gridNetworkNodes.map((node, i) => {
              const positions = [
                [120, 210],
                [180, 150],
                [240, 90],
                [260, 200],
                [300, 60],
              ];
              const [x, y] = positions[i];
              return (
                <g key={node.name}>
                  <circle
                    cx={x}
                    cy={y}
                    r={node.kind === "primary" ? 7 : 5}
                    fill={node.kind === "primary" ? "#22C55E" : "#1E40AF"}
                  />
                  <text
                    x={x + 10}
                    y={y + 4}
                    fontSize="11"
                    fill="#475569"
                    fontFamily="Inter, sans-serif"
                  >
                    {node.name}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="flex items-center gap-4 text-xs text-ink-muted mt-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-mint" /> Primary hub
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-chain-text" /> Collection
              center
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-ink-primary">
              Sensor Telemetry Feed
            </h3>
            <LivePulse />
          </div>
          <div className="mt-4 space-y-4">
            {sensorFeed.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between border-b border-border last:border-0 pb-4 last:pb-0"
              >
                <div>
                  <p className="text-sm font-semibold text-ink-primary">
                    {s.id}
                  </p>
                  <p className="text-xs text-ink-muted">{s.type}</p>
                </div>
                <div className="text-right">
                  <StatusBadge
                    status={s.status}
                    label={`${s.reading} ${s.statusLabel}`}
                  />
                  <p className="text-xs text-ink-muted mt-0.5">
                    {s.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent batches table */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-lg font-semibold text-ink-primary">
            Recent Milk Batches
          </h3>
          <div className="flex items-center gap-3">
            <select className="text-sm border border-border rounded-lg px-3 py-1.5 text-ink-secondary bg-white">
              <option>All Routes</option>
              <option>Erode → Chennai South</option>
              <option>Salem → Vellore Depot</option>
            </select>
            <button
              type="button"
              aria-label="Table settings"
              className="p-1.5 text-ink-muted hover:text-navy transition-default"
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className={`text-xs mb-3 ${mqttConnected ? 'text-mint' : 'text-amber'}`}>
          {mqttConnected ? '📡 Live sensor data connected (smartfarm/field1/sensors)' : '⚠️ Showing cached readings — MQTT offline'}
        </p>

        <div className="mt-4">
          <DataTable
            columns={columns}
            rows={recentBatches}
            renderCell={(row, col) => {
              switch (col.key) {
                case "id":
                  return (
                    <Link
                      to={`/batch/${row.id}`}
                      className="font-mono text-sm text-navy hover:underline"
                    >
                      {row.id}
                    </Link>
                  );
                case "origin":
                  return <span className="text-ink-primary">{row.origin}</span>;
                case "volume":
                  return `${row.volumeLiters.toLocaleString()} L`;
                case "avgTemp": {
                  // Show live MQTT temperature for BATCH-TN-093
                  if (row.id === 'BATCH-TN-093' && mqttConnected && temperature !== null) {
                    const sign = temperature >= 0 ? '+' : '';
                    return (
                      <span className="inline-flex items-center gap-1.5">
                        <StatusBadge
                          status="safe"
                          label={`${sign}${temperature.toFixed(1)}°C`}
                        />
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-mint/10 border border-mint/20 text-[10px] font-bold uppercase tracking-wider text-mint">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint" />
                          </span>
                          Live
                        </span>
                      </span>
                    );
                  }
                  return (
                    <StatusBadge
                      status={row.status}
                      label={`+${row.avgTemp.toFixed(1)}°C${
                        row.statusNote ? ` ${row.statusNote}` : ""
                      }`}
                    />
                  );
                }
                case "route":
                  return row.route;
                case "contract":
                  return <BlockchainBadge blockNumber={row.block} />;
                case "action":
                  return row.action === "audit" ? (
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg bg-danger text-white text-xs font-medium hover:bg-danger/90 transition-default"
                    >
                      Audit Batch
                    </button>
                  ) : (
                    <Link
                      to={`/batch/${row.id}`}
                      className="px-3 py-1.5 rounded-lg border border-border text-ink-secondary text-xs font-medium hover:border-navy hover:text-navy transition-default inline-block"
                    >
                      Inspect
                    </Link>
                  );
                default:
                  return null;
              }
            }}
          />
        </div>
      </div>

      {registerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="register-batch-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Sepolia Smart Contract</p><h2 id="register-batch-title" className="mt-1 text-2xl font-semibold text-slate-900">Register New Milk Batch</h2><p className="mt-1 text-sm text-slate-500">Confirm the transaction in MetaMask to register this batch on-chain.</p></div>
              <button type="button" disabled={submitting} onClick={() => setRegisterOpen(false)} aria-label="Close" className="rounded-lg px-3 py-1 text-xl text-slate-500">×</button>
            </div>
            <form onSubmit={submitBatch} className="space-y-4">
              <div><label htmlFor="register-batch-id" className="mb-1 block text-sm font-medium text-slate-700">Batch ID</label><input id="register-batch-id" required maxLength={64} value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })} placeholder="MILK001" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900" /></div>
              <div><label htmlFor="register-container-id" className="mb-1 block text-sm font-medium text-slate-700">Container ID</label><input id="register-container-id" required maxLength={64} value={form.containerId} onChange={(e) => setForm({ ...form, containerId: e.target.value })} placeholder="CONT001" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900" /></div>
              <div><label htmlFor="register-origin" className="mb-1 block text-sm font-medium text-slate-700">Origin Cooperative</label><input id="register-origin" required maxLength={120} value={form.originCooperative} onChange={(e) => setForm({ ...form, originCooperative: e.target.value })} placeholder="Erode Dairy Cluster" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900" /></div>
              <div><label htmlFor="register-volume" className="mb-1 block text-sm font-medium text-slate-700">Milk Volume (litres)</label><input id="register-volume" type="number" min="1" step="1" required value={form.volumeLiters} onChange={(e) => setForm({ ...form, volumeLiters: e.target.value })} placeholder="100" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900" /></div>
              {feedback && <div role="status" className={"break-words rounded-lg border p-3 text-sm " + (feedback.error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-900")}><p>{feedback.text}</p>{feedback.txHash && <a className="mt-2 inline-block underline" href={"https://sepolia.etherscan.io/tx/" + feedback.txHash} target="_blank" rel="noreferrer">View transaction on Etherscan ↗</a>}{feedback.batchId && <p className="mt-2">Now open Verify and enter <strong>{feedback.batchId}</strong>.</p>}</div>}
              <div className="flex justify-end gap-3 pt-2"><button type="button" disabled={submitting} onClick={() => setRegisterOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-700">Cancel</button><button type="submit" disabled={submitting} className="rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{submitting ? "Waiting for blockchain..." : "Create Batch on Blockchain"}</button></div>
              <p className="text-xs text-slate-500">Requires Sepolia ETH and the MetaMask account that deployed the contract.</p>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
