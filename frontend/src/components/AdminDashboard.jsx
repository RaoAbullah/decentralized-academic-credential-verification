import React, { useState } from 'react';
import {
  FileCheck,
  CheckCircle2,
  Send,
  RefreshCw,
  GraduationCap,
  SearchCheck,
  Settings,
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from 'lucide-react';
import { createCredentialPackage } from '../utils/crypto';
import {
  HARDHAT_ACCOUNTS,
  getSigner,
  getContractInstances,
  parseContractError
} from '../utils/contractService';

export default function AdminDashboard({
  onCredentialIssued,
  onNavigateToStudent,
  onNavigateToVerifier,
  blockchainStatus
}) {
  const [selectedAccountIndex, setSelectedAccountIndex] = useState(1); // Default to MUET Registrar
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedTab, setAdvancedTab] = useState('batch');

  // Student form state - clean 22CS102
  const [formData, setFormData] = useState({
    rollNumber: '22CS102',
    fullName: 'Student 22CS102',
    degree: 'B.E. Computer Systems Engineering',
    cgpa: '3.89',
    graduationDate: '2025-11-20',
    institution: 'Mehran University of Engineering and Technology',
    institutionCode: 'PK-MUET-001',
  });

  const [generatedPackage, setGeneratedPackage] = useState(null);
  const [issuanceResult, setIssuanceResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Revocation state
  const [revokeHash, setRevokeHash] = useState('');
  const [revokeReason, setRevokeReason] = useState('Academic Council Decision 2026-AC-08');
  const [revokeResult, setRevokeResult] = useState(null);

  // Batch issuance state
  const [batchCount, setBatchCount] = useState(5);
  const [batchResult, setBatchResult] = useState(null);

  // Circuit breaker state
  const [isContractPaused, setIsContractPaused] = useState(false);

  // Issue single credential
  const handleIssueCredential = async (e) => {
    e.preventDefault();
    setActionError(null);
    setIssuanceResult(null);

    const pkg = createCredentialPackage(formData);
    setGeneratedPackage(pkg);

    if (!blockchainStatus?.isConnected || !blockchainStatus?.isDeployed) {
      setActionError("System offline. Please ensure the local service is running.");
      return;
    }

    setIsSubmitting(true);
    try {
      const signer = await getSigner(selectedAccountIndex);
      const { credentialRegistry } = getContractInstances(signer);

      const tx = await credentialRegistry.issueCredential(pkg.credentialHash);
      const receipt = await tx.wait();

      const result = {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        issuerAddress: await signer.getAddress(),
        commitmentHash: pkg.credentialHash,
        timestamp: new Date().toLocaleTimeString()
      };

      setIssuanceResult(result);
      if (onCredentialIssued) {
        onCredentialIssued({
          ...pkg,
          onChain: result
        });
      }
    } catch (err) {
      console.error("Issuance failed:", err);
      setActionError(parseContractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Batch issuance
  const handleBatchIssue = async () => {
    setActionError(null);
    setBatchResult(null);
    setIsSubmitting(true);

    try {
      const signer = await getSigner(selectedAccountIndex);
      const { credentialRegistry } = getContractInstances(signer);

      const hashes = [];
      for (let i = 1; i <= batchCount; i++) {
        const dummy = {
          ...formData,
          rollNumber: `22CS${100 + i}`,
          fullName: `Student 22CS${100 + i}`
        };
        const p = createCredentialPackage(dummy);
        hashes.push(p.credentialHash);
      }

      const tx = await credentialRegistry.batchIssueCredentials(hashes);
      const receipt = await tx.wait();

      setBatchResult({
        count: hashes.length,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        avgGas: (Number(receipt.gasUsed) / hashes.length).toFixed(0),
      });
    } catch (err) {
      console.error("Batch issuance failed:", err);
      setActionError(parseContractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Revocation
  const handleRevoke = async (e) => {
    e.preventDefault();
    setActionError(null);
    setRevokeResult(null);
    setIsSubmitting(true);

    try {
      const signer = await getSigner(selectedAccountIndex);
      const { credentialRegistry } = getContractInstances(signer);

      const tx = await credentialRegistry.revokeCredential(revokeHash, revokeReason);
      const receipt = await tx.wait();

      setRevokeResult({
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      });
    } catch (err) {
      console.error("Revocation failed:", err);
      setActionError(parseContractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Circuit breaker toggle
  const handleCircuitBreaker = async () => {
    setActionError(null);
    setIsSubmitting(true);
    try {
      const signer = await getSigner(selectedAccountIndex);
      const { institutionRegistry, credentialRegistry } = getContractInstances(signer);

      if (isContractPaused) {
        await (await institutionRegistry.unpause()).wait();
        await (await credentialRegistry.unpause()).wait();
        setIsContractPaused(false);
      } else {
        await (await institutionRegistry.pause()).wait();
        await (await credentialRegistry.pause()).wait();
        setIsContractPaused(true);
      }
    } catch (err) {
      setActionError(parseContractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy">University Registrar Portal</h2>
          <p className="text-xs text-slate-500 mt-1">
            Issue and register accredited academic degrees on the decentralized registry.
          </p>
        </div>

        {/* Signing account */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-500 font-medium">Signing Authority:</span>
          <select
            value={selectedAccountIndex}
            onChange={(e) => setSelectedAccountIndex(Number(e.target.value))}
            className="bg-slate-bg border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-navy text-xs cursor-pointer focus:outline-none"
          >
            <option value={1}>MUET Examination Branch</option>
            <option value={0}>HEC Consortium Admin</option>
            <option value={5}>External / Unauthorized</option>
          </select>
        </div>
      </div>

      {/* Error Notice */}
      {actionError && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-xl text-xs text-rose-800 flex items-start space-x-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold">Notice</div>
            <div className="mt-1 font-mono text-[11px]">{actionError}</div>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-500 font-bold px-2">✕</button>
        </div>
      )}

      {/* Main Form Card */}
      <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <h3 className="text-base font-bold text-navy flex items-center space-x-2 border-b border-slate-100 pb-3">
          <FileCheck className="w-5 h-5 text-navy" />
          <span>Student Degree Information</span>
        </h3>

        <form onSubmit={handleIssueCredential} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-600 font-medium mb-1.5">Roll Number</label>
              <input
                type="text"
                value={formData.rollNumber}
                onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                className="w-full bg-slate-bg border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold font-mono text-navy focus:outline-none focus:ring-2 focus:ring-navy"
                required
              />
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1.5">Full Name</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full bg-slate-bg border border-slate-200 rounded-xl px-3.5 py-2.5 text-navy font-medium focus:outline-none focus:ring-2 focus:ring-navy"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1.5">Degree Program</label>
            <input
              type="text"
              value={formData.degree}
              onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
              className="w-full bg-slate-bg border border-slate-200 rounded-xl px-3.5 py-2.5 text-navy font-medium focus:outline-none focus:ring-2 focus:ring-navy"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-600 font-medium mb-1.5">Cumulative GPA (CGPA)</label>
              <input
                type="text"
                value={formData.cgpa}
                onChange={(e) => setFormData({ ...formData, cgpa: e.target.value })}
                className="w-full bg-slate-bg border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-navy font-bold focus:outline-none focus:ring-2 focus:ring-navy"
                required
              />
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1.5">Graduation Date</label>
              <input
                type="date"
                value={formData.graduationDate}
                onChange={(e) => setFormData({ ...formData, graduationDate: e.target.value })}
                className="w-full bg-slate-bg border border-slate-200 rounded-xl px-3.5 py-2.5 text-navy font-medium focus:outline-none focus:ring-2 focus:ring-navy"
                required
              />
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-navy hover:bg-navy-light text-white font-bold py-3.5 px-5 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-md cursor-pointer disabled:opacity-50 text-sm"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-gold" />
                  <span>Issuing Degree...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-gold" />
                  <span>Issue & Register Degree</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Success Confirmation Card */}
        {issuanceResult && (
          <div className="mt-5 p-5 bg-emerald-50 border-2 border-emerald-300 rounded-2xl shadow-xs space-y-3 animate-in fade-in">
            <div className="flex items-center space-x-2 text-emerald-800 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Degree Successfully Registered on Ledger</span>
            </div>

            <div className="text-xs text-emerald-950 font-mono space-y-1">
              <div>Student Roll No: <strong>22CS102</strong></div>
              <div>Block Number: #{issuanceResult.blockNumber}</div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                onClick={onNavigateToStudent}
                className="flex-1 py-2.5 bg-navy hover:bg-navy-light text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                <GraduationCap className="w-4 h-4 text-gold" />
                <span>View Student Certificate</span>
              </button>

              <button
                onClick={onNavigateToVerifier}
                className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                <SearchCheck className="w-4 h-4 text-emerald-200" />
                <span>Verify Degree</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Optional Administration Tools */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-6 py-4 flex items-center justify-between text-navy font-bold text-xs hover:bg-slate-bg transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2 text-slate-600">
            <Settings className="w-4 h-4 text-slate-400" />
            <span>Administrative Controls (Batch Issuance & Revocation)</span>
          </span>
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAdvanced && (
          <div className="p-6 border-t border-slate-200 bg-slate-bg/40 space-y-4 text-xs">
            <div className="flex gap-2 border-b border-slate-200 pb-3">
              <button
                onClick={() => setAdvancedTab('batch')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  advancedTab === 'batch' ? 'bg-navy text-white' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                Batch Processing
              </button>
              <button
                onClick={() => setAdvancedTab('revoke')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  advancedTab === 'revoke' ? 'bg-navy text-white' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                Revocation
              </button>
            </div>

            {advancedTab === 'batch' && (
              <div className="space-y-3">
                <p className="text-slate-500">Issue degrees for graduating batches:</p>
                <div className="flex items-center gap-3">
                  <select
                    value={batchCount}
                    onChange={(e) => setBatchCount(Number(e.target.value))}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-2 font-bold text-navy text-xs"
                  >
                    <option value={5}>Batch of 5</option>
                    <option value={10}>Batch of 10</option>
                    <option value={20}>Batch of 20</option>
                  </select>
                  <button
                    onClick={handleBatchIssue}
                    disabled={isSubmitting}
                    className="bg-navy hover:bg-navy-light text-white font-bold px-4 py-2 rounded-lg cursor-pointer"
                  >
                    Run Batch
                  </button>
                </div>
                {batchResult && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
                    Successfully issued batch of {batchResult.count} credentials.
                  </div>
                )}
              </div>
            )}

            {advancedTab === 'revoke' && (
              <form onSubmit={handleRevoke} className="space-y-3 max-w-md">
                <input
                  type="text"
                  placeholder="Credential Commitment Hash (0x...)"
                  value={revokeHash}
                  onChange={(e) => setRevokeHash(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono"
                  required
                />
                <input
                  type="text"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2"
                  required
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-lg cursor-pointer"
                >
                  Revoke Credential
                </button>
                {revokeResult && (
                  <div className="p-2 bg-rose-50 text-rose-900 rounded border border-rose-200">
                    Credential revoked on ledger.
                  </div>
                )}
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
