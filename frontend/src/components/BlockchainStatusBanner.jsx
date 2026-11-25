import React from 'react';
import { ShieldAlert, Server, Activity, CheckCircle2, XCircle, FileCode } from 'lucide-react';

export default function BlockchainStatusBanner({ status }) {
  const isConnected = status?.isConnected;
  const isDeployed = status?.isDeployed;

  return (
    <div className="bg-navy-dark text-slate-300 border-b border-navy-light/40 px-4 py-2.5 text-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Academic Status & Notice */}
        <div className="flex items-center space-x-2 flex-wrap">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-900/60 text-amber-300 border border-amber-700/50">
            <ShieldAlert className="w-3.5 h-3.5 mr-1" />
            Phase 2: Live Local Node Integration
          </span>
          <span className="text-slate-400">
            MUET CS-491 Complex Engineering Problem. Connected to local Hardhat EVM (Ethers v6). Private salts remain strictly in-memory.
          </span>
        </div>

        {/* Right: Real Node Metrics */}
        <div className="flex items-center space-x-4 flex-wrap text-[11px]">
          <div className="flex items-center space-x-1.5 font-mono">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span>{status?.rpcUrl || "127.0.0.1:8545"}</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
            <span className={isConnected ? "text-emerald-400 font-medium" : "text-rose-400 font-medium"}>
              {isConnected ? `Hardhat Node (Chain ID ${status?.chainId})` : 'Node Disconnected'}
            </span>
          </div>

          {isConnected && (
            <div className="flex items-center space-x-1.5 font-mono text-slate-300">
              <span className="text-slate-500">Block:</span>
              <span className="bg-navy px-1.5 py-0.5 rounded border border-navy-light text-gold font-bold">
                #{status?.blockNumber ?? 0}
              </span>
            </div>
          )}

          <div className="flex items-center space-x-1">
            {isDeployed ? (
              <span className="inline-flex items-center text-emerald-400 text-[10px] bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Contracts Deployed
              </span>
            ) : (
              <span className="inline-flex items-center text-rose-400 text-[10px] bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800">
                <XCircle className="w-3 h-3 mr-1" />
                Not Deployed
              </span>
            )}
          </div>
        </div>
      </div>

      {status?.error && (
        <div className="max-w-7xl mx-auto mt-2 bg-rose-950/70 border border-rose-800/80 rounded p-2 text-rose-200 text-xs">
          <strong>Blockchain Connection Warning:</strong> {status.error}
        </div>
      )}
    </div>
  );
}
