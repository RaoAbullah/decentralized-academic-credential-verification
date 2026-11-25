import React, { useState, useEffect } from 'react';
import {
  SearchCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Upload,
  RefreshCw,
  FileCheck
} from 'lucide-react';
import { computePayloadHash, computeCredentialCommitment } from '../utils/crypto';
import { getProvider, getContractInstances, parseContractError } from '../utils/contractService';

export default function VerifierPortal({ prefillPackage, blockchainStatus }) {
  const [transcriptInput, setTranscriptInput] = useState(JSON.stringify({
    institution: "Mehran University of Engineering and Technology",
    institutionCode: "PK-MUET-001",
    rollNumber: "22CS102",
    fullName: "Student 22CS102",
    degree: "B.E. Computer Systems Engineering",
    cgpa: "3.89",
    graduationDate: "2025-11-20"
  }, null, 2));

  const [saltInput, setSaltInput] = useState('0x27b700000000000000000000000000000000000000000000000000000000a888');
  const [verificationResult, setVerificationResult] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [verificationError, setVerificationError] = useState(null);

  useEffect(() => {
    if (prefillPackage) {
      if (prefillPackage.canonicalPayload) {
        setTranscriptInput(JSON.stringify(prefillPackage.canonicalPayload, null, 2));
      } else if (prefillPackage.transcriptPayload) {
        setTranscriptInput(JSON.stringify(prefillPackage.transcriptPayload, null, 2));
      }
      if (prefillPackage.salt) {
        setSaltInput(prefillPackage.salt);
      } else if (prefillPackage.disclosedSalt) {
        setSaltInput(prefillPackage.disclosedSalt);
      }
      setVerificationResult(null);
      setVerificationError(null);
    }
  }, [prefillPackage]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.transcriptPayload && parsed.disclosedSalt) {
          setTranscriptInput(JSON.stringify(parsed.transcriptPayload, null, 2));
          setSaltInput(parsed.disclosedSalt);
        } else if (parsed.canonicalPayload && parsed.salt) {
          setTranscriptInput(JSON.stringify(parsed.canonicalPayload, null, 2));
          setSaltInput(parsed.salt);
        } else {
          setTranscriptInput(JSON.stringify(parsed, null, 2));
        }
        setVerificationResult(null);
        setVerificationError(null);
      } catch (err) {
        setVerificationError("Invalid verification file format.");
      }
    };
    reader.readAsText(file);
  };

  const loadPreset = (type) => {
    setVerificationResult(null);
    setVerificationError(null);

    if (type === 'valid') {
      setTranscriptInput(JSON.stringify({
        institution: "Mehran University of Engineering and Technology",
        institutionCode: "PK-MUET-001",
        rollNumber: "22CS102",
        fullName: "Student 22CS102",
        degree: "B.E. Computer Systems Engineering",
        cgpa: "3.89",
        graduationDate: "2025-11-20"
      }, null, 2));
      setSaltInput('0x27b700000000000000000000000000000000000000000000000000000000a888');
    } else if (type === 'tampered') {
      setTranscriptInput(JSON.stringify({
        institution: "Mehran University of Engineering and Technology",
        institutionCode: "PK-MUET-001",
        rollNumber: "22CS102",
        fullName: "Student 22CS102",
        degree: "B.E. Computer Systems Engineering",
        cgpa: "4.00",
        graduationDate: "2025-11-20"
      }, null, 2));
      setSaltInput('0x27b700000000000000000000000000000000000000000000000000000000a888');
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setVerificationError(null);
    setVerificationResult(null);
    setIsEvaluating(true);

    try {
      const parsedTranscript = JSON.parse(transcriptInput);
      const { payloadHash } = computePayloadHash(parsedTranscript);
      const calculatedCommitment = computeCredentialCommitment(payloadHash, saltInput);

      if (!blockchainStatus?.isConnected || !blockchainStatus?.isDeployed) {
        throw new Error("System offline. Please check connection.");
      }

      const provider = getProvider();
      const { verificationGateway } = getContractInstances(provider);

      const result = await verificationGateway.verifyCredential(calculatedCommitment);

      setVerificationResult({
        isValid: result.isValid,
        statusMessage: result.statusMessage,
        institutionName: result.institutionName,
        accreditationCode: result.accreditationCode,
        issuerAddress: result.issuerAddress,
        issuedAt: Number(result.issuedAt),
        isRevoked: result.isRevoked
      });
    } catch (err) {
      setVerificationError(parseContractError(err));
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy">Degree Verification Portal</h2>
          <p className="text-xs text-slate-500 mt-1">
            Verify academic credentials directly against the university ledger.
          </p>
        </div>

        {/* Upload & Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs px-3.5 py-2 bg-navy hover:bg-navy-light text-white font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-xs transition-colors">
            <Upload className="w-3.5 h-3.5 text-gold" />
            <span>Upload Degree File</span>
            <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
          </label>

          <button
            onClick={() => loadPreset('valid')}
            className="text-xs px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl border border-emerald-200 transition-all cursor-pointer"
          >
            Load 22CS102 Record
          </button>

          <button
            onClick={() => loadPreset('tampered')}
            className="text-xs px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl border border-amber-200 transition-all cursor-pointer"
          >
            Test Forged GPA
          </button>
        </div>
      </div>

      {verificationError && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-xl text-xs text-rose-800 flex items-start space-x-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold">Notice</div>
            <div className="mt-1 font-mono text-[11px]">{verificationError}</div>
          </div>
        </div>
      )}

      {/* Main Verification Card */}
      <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <h3 className="text-base font-bold text-navy flex items-center space-x-2 border-b border-slate-100 pb-3">
          <FileCheck className="w-5 h-5 text-navy" />
          <span>Credential Data</span>
        </h3>

        <form onSubmit={handleVerify} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-600 font-medium mb-1.5">Academic Transcript (JSON)</label>
            <textarea
              rows={6}
              value={transcriptInput}
              onChange={(e) => setTranscriptInput(e.target.value)}
              className="w-full font-mono text-[11px] bg-slate-bg border border-slate-200 rounded-xl p-3 text-navy focus:outline-none focus:ring-2 focus:ring-navy leading-relaxed"
              required
            />
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1.5">Verification Key (Salt)</label>
            <input
              type="text"
              value={saltInput}
              onChange={(e) => setSaltInput(e.target.value)}
              className="w-full font-mono text-[11px] bg-slate-bg border border-slate-200 rounded-xl px-3.5 py-2.5 text-navy focus:outline-none focus:ring-2 focus:ring-navy"
              required
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isEvaluating}
              className="w-full bg-navy hover:bg-navy-light text-white font-bold py-3.5 px-5 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-md cursor-pointer disabled:opacity-50 text-sm"
            >
              {isEvaluating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-gold" />
                  <span>Verifying on Blockchain...</span>
                </>
              ) : (
                <>
                  <SearchCheck className="w-4 h-4 text-gold" />
                  <span>Verify Credential Authenticity</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Verification Result */}
        {verificationResult && (
          <div className={`mt-5 p-6 rounded-2xl border-2 shadow-xs space-y-3 animate-in fade-in ${
            verificationResult.isValid
              ? 'bg-emerald-50 border-emerald-300'
              : 'bg-rose-50 border-rose-300'
          }`}>
            <div className="flex items-center space-x-3 border-b pb-3 border-slate-200">
              {verificationResult.isValid ? (
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              ) : (
                <XCircle className="w-7 h-7 text-rose-600" />
              )}
              <div>
                <h4 className="text-base font-bold text-navy">
                  {verificationResult.isValid ? 'CREDENTIAL AUTHENTIC & VALID' : 'VERIFICATION FAILED'}
                </h4>
                <span className="text-xs text-slate-600">
                  {verificationResult.statusMessage}
                </span>
              </div>
            </div>

            {verificationResult.isValid && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Issuing University</span>
                  <span className="font-bold text-navy">{verificationResult.institutionName}</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Accreditation Code</span>
                  <span className="font-mono font-bold text-navy">{verificationResult.accreditationCode}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
