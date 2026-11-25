import React from 'react';
import { Landmark, GraduationCap, SearchCheck, Award } from 'lucide-react';

export default function Navbar({ activeRole, setActiveRole, isConnected }) {
  const roles = [
    {
      id: 'admin',
      label: 'University Registrar',
      icon: Landmark,
    },
    {
      id: 'student',
      label: 'Student Vault',
      icon: GraduationCap,
    },
    {
      id: 'verifier',
      label: 'Verify Credential',
      icon: SearchCheck,
    },
  ];

  return (
    <header className="bg-navy shadow-sm border-b border-navy-light text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center py-3.5 gap-4">
          {/* Institutional Branding */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-navy-light/60 rounded-xl border border-gold/40 shadow-inner flex items-center justify-center">
              <Award className="w-6 h-6 text-gold" />
            </div>
            <div>
              <div className="text-xs font-semibold text-gold tracking-wide">
                Mehran University of Engineering & Technology
              </div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
                Academic Credential Verification System
              </h1>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center space-x-3">
            <nav className="flex space-x-1 bg-navy-dark p-1 rounded-xl border border-navy-light/60">
              {roles.map((role) => {
                const Icon = role.icon;
                const isActive = activeRole === role.id;
                return (
                  <button
                    key={role.id}
                    onClick={() => setActiveRole(role.id)}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs md:text-sm font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-navy-light text-white shadow-sm border border-gold/40 font-semibold'
                        : 'text-slate-300 hover:text-white hover:bg-navy/60'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-gold' : 'text-slate-400'}`} />
                    <span>{role.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Subtle Node Status Indicator */}
            <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 bg-navy-dark rounded-lg border border-navy-light/50 text-[11px] text-slate-300">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
              <span>{isConnected ? 'System Online' : 'Offline'}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
