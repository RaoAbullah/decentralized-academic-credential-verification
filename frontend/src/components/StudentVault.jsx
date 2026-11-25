import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Eye,
  EyeOff,
  Download,
  Copy,
  Check,
  Share2,
  Award,
  SearchCheck,
  Lock,
  FileCheck
} from 'lucide-react';
import { createAuthorizedDisclosureBundle, createCredentialPackage } from '../utils/crypto';

export default function StudentVault({ activePackage, onSendToVerifier }) {
  // Synthetic default package held purely in-memory with roll number 22CS102
  const [inMemoryPackage, setInMemoryPackage] = useState(() => {
    return activePackage || createCredentialPackage({
      institution: "Mehran University of Engineering and Technology",
      institutionCode: "PK-MUET-001",
      rollNumber: "22CS102",
      fullName: "Student 22CS102",
      degree: "B.E. Computer Systems Engineering",
      cgpa: "3.89",
      graduationDate: "2025-11-20"
    });
  });

  useEffect(() => {
    if (activePackage) {
      setInMemoryPackage(activePackage);
      setDisclosureBundle(null);
    }
  }, [activePackage]);

  const [revealSalt, setRevealSalt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedSalt, setCopiedSalt] = useState(false);
  const [disclosureBundle, setDisclosureBundle] = useState(null);

  const handleGenerateDisclosure = () => {
    const bundle = createAuthorizedDisclosureBundle(inMemoryPackage, "Prospective Employer");
    setDisclosureBundle(bundle);
  };

  const handleCopyBundle = () => {
    if (disclosureBundle) {
      navigator.clipboard.writeText(JSON.stringify(disclosureBundle, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadBundle = () => {
    const bundleToDownload = disclosureBundle || createAuthorizedDisclosureBundle(inMemoryPackage, "Prospective Employer");
    const blob = new Blob([JSON.stringify(bundleToDownload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MUET-Degree-Verification-${inMemoryPackage.canonicalPayload.student.rollNumber || '22CS102'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleVerifyDirectly = () => {
    if (onSendToVerifier) {
      onSendToVerifier(inMemoryPackage);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy">Student Credential Vault</h2>
          <p className="text-xs text-slate-500">
            Self-sovereign credential storage. Your private salt is stored in memory and never shared without your permission.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleVerifyDirectly}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center space-x-2 shadow-xs transition-all cursor-pointer"
          >
            <SearchCheck className="w-4 h-4 text-emerald-200" />
            <span>Send to Employer Verifier</span>
          </button>

          <button
            onClick={handleDownloadBundle}
            className="px-4 py-2.5 bg-navy hover:bg-navy-light text-white text-xs font-bold rounded-xl flex items-center space-x-2 shadow-xs transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-gold" />
            <span>Download Degree File (.json)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Certificate Display */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white p-8 rounded-2xl border-2 border-slate-200 shadow-md relative overflow-hidden">
            <div className="border border-gold/40 p-6 rounded-xl relative space-y-5 bg-gradient-to-b from-white via-amber-50/20 to-white">
              {/* Seal */}
              <div className="text-center space-y-1 border-b border-gold/30 pb-4">
                <div className="flex justify-center mb-1">
                  <div className="p-2.5 bg-navy rounded-full text-gold shadow-md">
                    <Award className="w-9 h-9" />
                  </div>
                </div>
                <h3 className="text-sm font-bold text-navy uppercase tracking-widest">
                  Mehran University of Engineering and Technology
                </h3>
                <p className="text-[11px] text-slate-500 italic">
                  Jamshoro, Sindh, Pakistan | Department of Computer Systems Engineering
                </p>
              </div>

              {/* Student details */}
              <div className="text-center space-y-3 py-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider">This is to certify that</p>
                <h4 className="text-2xl font-bold text-navy font-serif tracking-wide">
                  {inMemoryPackage.canonicalPayload.student.fullName || 'Student 22CS102'}
                </h4>
                <div className="text-xs font-mono text-slate-700 bg-slate-100 inline-block px-3 py-1 rounded-full border border-slate-200 font-bold">
                  Roll Number: {inMemoryPackage.canonicalPayload.student.rollNumber || '22CS102'}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto pt-1">
                  has fulfilled all requirements prescribed by the academic council for the degree of
                </p>
                <div className="text-base font-bold text-navy uppercase tracking-wide">
                  {inMemoryPackage.canonicalPayload.student.degree}
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-3 gap-2 text-center border-t border-gold/30 pt-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Cumulative GPA</span>
                  <span className="font-bold text-navy text-sm font-mono">{inMemoryPackage.canonicalPayload.student.cgpa} / 4.00</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Conferral Date</span>
                  <span className="font-semibold text-navy">{inMemoryPackage.canonicalPayload.student.graduationDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Consortium Standing</span>
                  <span className="inline-flex items-center text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    Anchored on Blockchain
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Private Salt & Privacy Card */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
            <h3 className="font-bold text-navy flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <Lock className="w-4 h-4 text-gold" />
              <span>Your Privacy Key (Salt)</span>
            </h3>

            <p className="text-slate-500 leading-relaxed">
              This secret 256-bit salt protects your GPA from being guessed or mined on public ledgers:
            </p>

            <div className="p-3 bg-slate-bg font-mono rounded-xl border border-slate-200 text-navy break-all text-[11px] space-y-2">
              <div className="flex justify-between items-center text-slate-400 text-[10px]">
                <span>PRIVATE SALT (32 BYTES):</span>
                <button
                  onClick={() => setRevealSalt(!revealSalt)}
                  className="text-navy hover:text-gold flex items-center gap-1 cursor-pointer font-sans"
                >
                  {revealSalt ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{revealSalt ? 'Mask' : 'Reveal'}</span>
                </button>
              </div>
              <div className="font-bold">
                {revealSalt
                  ? inMemoryPackage.salt
                  : `${inMemoryPackage.salt.slice(0, 8)}••••••••••••••••••••••••${inMemoryPackage.salt.slice(-6)}`}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={handleGenerateDisclosure}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-navy font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-navy" />
                <span>Preview Verifiable JSON Bundle</span>
              </button>
            </div>

            {disclosureBundle && (
              <div className="mt-2 p-2.5 bg-emerald-50 text-emerald-800 rounded-lg text-[10px] font-mono break-all animate-in fade-in">
                Bundle prepared for export! Click "Download Degree File" to save.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
