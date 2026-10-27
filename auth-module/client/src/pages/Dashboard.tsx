import React from 'react';
import { Link } from 'react-router-dom';
import { Users as UsersIcon, LogOut, User as UserIcon, ShieldCheck, Check } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { Can } from '../auth/Can';
import { ROLE_PERMISSIONS } from '../auth/permissions';

function getRoleBadgeColor(role?: string): string {
  switch (role) {
    case 'admin':
      return 'bg-white/25 text-white border-white/50 shadow-sm';
    case 'manager':
      return 'bg-emerald-400/30 text-emerald-100 border-emerald-300/50 shadow-sm';
    case 'viewer':
    default:
      return 'bg-sky-400/30 text-sky-100 border-sky-300/50 shadow-sm';
  }
}

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();

  const userPermissions = user ? ROLE_PERMISSIONS[user.role] || [] : [];

  return (
    <div className="min-h-screen bg-[#1c44b6] text-white p-6 md:p-10 lg:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/20">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-wide text-white">
                Enterprise Console
              </h1>
              <span
                className={`text-[11px] sm:text-xs uppercase font-semibold px-2.5 py-0.5 rounded-md border ${getRoleBadgeColor(
                  user?.role
                )}`}
              >
                {user?.role}
              </span>
            </div>
            <p className="text-sm sm:text-base text-white/90 mt-1.5 font-medium">
              Welcome back, <span className="text-white font-semibold">{user?.name}</span> ({user?.email})
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Can permission="users:read">
              <Link
                to="/users"
                className="px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white font-medium border border-white/30 rounded-md text-xs sm:text-sm transition flex items-center gap-1.5 shadow-sm"
              >
                <UsersIcon className="w-4 h-4 text-white" />
                Manage Users
              </Link>
            </Can>

            <button
              onClick={() => logout()}
              className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500/35 text-rose-100 font-medium border border-rose-300/40 rounded-md text-xs sm:text-sm transition flex items-center gap-1.5 shadow-sm"
            >
              <LogOut className="w-4 h-4 text-rose-200" />
              Logout
            </button>
          </div>
        </header>

        {/* Content Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          
          {/* Identity Info */}
          <div className="bg-[#2353cf] border border-white/20 rounded-lg p-5 sm:p-6 shadow-md">
            <h2 className="text-base sm:text-lg font-semibold text-white mb-5 flex items-center gap-2.5">
              <div className="p-2 rounded-md bg-white/15 text-white border border-white/20">
                <UserIcon className="w-4 h-4" />
              </div>
              Identity & Session Info
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-white/15">
                <span className="text-white/80 font-medium text-xs sm:text-sm">User ID</span>
                <span className="text-white font-mono text-xs bg-white/15 px-2.5 py-0.5 rounded border border-white/25">
                  {user?.id}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/15">
                <span className="text-white/80 font-medium text-xs sm:text-sm">Full Name</span>
                <span className="text-white font-semibold text-sm sm:text-base">{user?.name}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/15">
                <span className="text-white/80 font-medium text-xs sm:text-sm">Email</span>
                <span className="text-white font-medium text-sm sm:text-base">{user?.email}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/15">
                <span className="text-white/80 font-medium text-xs sm:text-sm">Assigned Role</span>
                <span className="text-white font-semibold uppercase text-[11px] sm:text-xs tracking-wider bg-white/20 px-2.5 py-0.5 rounded-md border border-white/30">
                  {user?.role}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-white/80 font-medium text-xs sm:text-sm">Token Storage</span>
                <span className="text-emerald-300 text-xs sm:text-sm font-mono font-medium">
                  In-Memory (Non-extractable)
                </span>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div className="bg-[#2353cf] border border-white/20 rounded-lg p-5 sm:p-6 shadow-md flex flex-col justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-white mb-2 flex items-center gap-2.5">
                <div className="p-2 rounded-md bg-white/15 text-white border border-white/20">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                Role Capabilities
              </h2>
              <p className="text-xs sm:text-sm text-white/85 font-medium mb-5">
                Permissions attached to your current role (<span className="text-white font-semibold">{user?.role}</span>):
              </p>
              
              <div className="space-y-2.5">
                {userPermissions.map((permission) => (
                  <div
                    key={permission}
                    className="flex items-center gap-2.5 p-2.5 sm:p-3 bg-[#183ca0] border border-white/20 rounded-md text-xs sm:text-sm text-white font-medium"
                  >
                    <Check className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                    <code className="text-xs sm:text-sm text-emerald-200 font-mono font-semibold tracking-wide">{permission}</code>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-white/15 text-xs text-white/75 font-normal">
              Note: Client UI checks toggle access, while server middleware strictly enforces RBAC authorization.
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default Dashboard;
