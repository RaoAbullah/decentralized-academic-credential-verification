import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AdminDashboard from './components/AdminDashboard';
import StudentVault from './components/StudentVault';
import VerifierPortal from './components/VerifierPortal';
import { checkBlockchainStatus } from './utils/contractService';

export default function App() {
  const [activeRole, setActiveRoleState] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role');
    if (['admin', 'student', 'verifier'].includes(roleParam)) {
      return roleParam;
    }
    return 'admin';
  });

  const setActiveRole = (role) => {
    setActiveRoleState(role);
    const url = new URL(window.location);
    url.searchParams.set('role', role);
    window.history.pushState({}, '', url);
  };

  const [sharedPackage, setSharedPackage] = useState(null);
  const [verifierPrefill, setVerifierPrefill] = useState(null);

  const [blockchainStatus, setBlockchainStatus] = useState({
    isConnected: false,
    chainId: null,
    blockNumber: null,
    isDeployed: false,
    rpcUrl: "http://127.0.0.1:8545",
    addresses: {},
    error: null
  });

  const updateStatus = async () => {
    const status = await checkBlockchainStatus();
    setBlockchainStatus(status);
  };

  useEffect(() => {
    updateStatus();
    const timer = setInterval(updateStatus, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleSendToVerifier = (pkg) => {
    setVerifierPrefill(pkg);
    setActiveRole('verifier');
  };

  return (
    <div className="min-h-screen bg-slate-bg flex flex-col justify-between selection:bg-navy selection:text-white font-sans">
      <div>
        {/* Clean Institutional Header */}
        <Navbar
          activeRole={activeRole}
          setActiveRole={setActiveRole}
          isConnected={blockchainStatus.isConnected}
        />

        {/* Main Application Area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeRole === 'admin' && (
            <AdminDashboard
              onCredentialIssued={(pkg) => {
                setSharedPackage(pkg);
                setVerifierPrefill(pkg);
              }}
              onNavigateToStudent={() => setActiveRole('student')}
              onNavigateToVerifier={() => setActiveRole('verifier')}
              blockchainStatus={blockchainStatus}
            />
          )}

          {activeRole === 'student' && (
            <StudentVault
              activePackage={sharedPackage}
              onSendToVerifier={handleSendToVerifier}
            />
          )}

          {activeRole === 'verifier' && (
            <VerifierPortal
              prefillPackage={verifierPrefill}
              blockchainStatus={blockchainStatus}
            />
          )}
        </main>
      </div>

      {/* Professional University Footer */}
      <footer className="bg-white border-t border-slate-200 py-5 text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-2">
          <div>
            <strong>Mehran University of Engineering and Technology (MUET), Jamshoro</strong>
          </div>
          <div className="text-slate-400 text-[11px]">
            &copy; 2026 Department of Computer Systems Engineering. All Rights Reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
