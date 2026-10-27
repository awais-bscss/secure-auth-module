import React from 'react';
import { Link } from 'react-router-dom';
import { Ban, ArrowLeft } from 'lucide-react';

export const Forbidden: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#1c44b6] text-white">
      <div className="w-full max-w-md bg-[#2353cf] border border-white/20 rounded-lg p-8 text-center shadow-md">
        <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-300/40 text-rose-200 mx-auto flex items-center justify-center mb-5">
          <Ban className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2 tracking-wide">403 - Forbidden</h1>
        <p className="text-white/90 text-sm sm:text-base mb-6 leading-relaxed">
          You don't have access to this resource. Your role lacks the necessary permissions to view or perform actions here.
        </p>

        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-100 text-[#2353cf] rounded-md text-sm font-bold tracking-wide uppercase transition shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default Forbidden;
