import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthPortalContent } from '../components/auth/AuthPortalModal';

export function Login() {
  const navigate = useNavigate();
  const { currentUser, userProfile, authGateStatus } = useAuth();

  useEffect(() => {
    if (currentUser && authGateStatus === 'AUTHENTICATED' && userProfile) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, authGateStatus, userProfile, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-[520px] space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <AuthPortalContent />
        </div>

        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke Portal Lomba Publik
          </Link>
        </div>
      </div>
    </div>
  );
}
