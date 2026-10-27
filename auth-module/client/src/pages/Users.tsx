import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { User, getUsers, deleteUser } from '../api/auth';
import { useAuth } from '../auth/useAuth';
import { useCan } from '../auth/Can';
import { isCancelled, AppError } from '../api/errors';

export const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { user: currentUser } = useAuth();
  const canDelete = useCan('users:delete');
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    async function fetchUsers() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const data = await getUsers(controller.signal);
        if (!controller.signal.aborted) {
          setUsers(data);
        }
      } catch (err) {
        if (!controller.signal.aborted && !isCancelled(err)) {
          if (err instanceof AppError) {
            setErrorMessage(err.message);
          } else {
            setErrorMessage('Failed to load user list.');
          }
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchUsers();

    return () => {
      controller.abort();
    };
  }, []);

  const handleDelete = async (targetUser: User) => {
    if (!window.confirm(`Are you sure you want to delete user "${targetUser.name}" (${targetUser.email})?`)) {
      return;
    }

    setDeletingId(targetUser.id);
    try {
      await deleteUser(targetUser.id);
      setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
    } catch (err) {
      if (err instanceof AppError) {
        alert(`Error: ${err.message}`);
      } else {
        alert('An unexpected error occurred while deleting user.');
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#1c44b6] text-white p-6 md:p-10 lg:p-12">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/20">
          <div>
            <div className="flex items-center gap-2">
              <Link
                to="/dashboard"
                className="text-white/80 hover:text-white transition flex items-center gap-1 text-sm sm:text-base font-medium"
              >
                <ChevronLeft className="w-4 h-4" />
                Dashboard
              </Link>
              <span className="text-white/40">/</span>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                Users Management
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-white/85 mt-1 font-medium">
              Active directory accounts and role assignments
            </p>
          </div>
        </header>

        {/* Error */}
        {errorMessage && (
          <div className="p-3.5 bg-rose-500/25 border border-rose-300/40 rounded-md text-rose-100 text-xs sm:text-sm flex items-center justify-between shadow-sm">
            <span>{errorMessage}</span>
            <button
              onClick={() => window.location.reload()}
              className="text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-md font-medium transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-[#2353cf] border border-white/20 rounded-lg overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#183ca0] border-b border-white/20 text-xs font-semibold uppercase tracking-wider text-white">
                <tr>
                  <th scope="col" className="px-5 py-3">User</th>
                  <th scope="col" className="px-5 py-3">Role</th>
                  <th scope="col" className="px-5 py-3">Email</th>
                  <th scope="col" className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/15">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-24 text-center">
                      <div className="flex flex-col items-center justify-center gap-3.5 mx-auto">
                        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs sm:text-sm text-white/90 font-medium">
                          Loading user directory...
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-14 text-center text-white/80 text-sm">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((item) => {
                    const isSelf = item.id === currentUser?.id;
                    const isDeletingThis = deletingId === item.id;

                    let deleteTitle = '';
                    if (!canDelete) {
                      deleteTitle = 'Requires admin permission to delete';
                    } else if (isSelf) {
                      deleteTitle = 'Cannot delete your own account';
                    }

                    const isDisabled = !canDelete || isSelf || isDeletingThis;

                    return (
                      <tr key={item.id} className="hover:bg-white/5 transition">
                        <td className="px-5 py-3">
                          <div className="text-sm sm:text-base font-semibold text-white">{item.name}</div>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] sm:text-xs font-semibold uppercase tracking-wider border ${
                              item.role === 'admin'
                                ? 'bg-white/20 text-white border-white/40'
                                : item.role === 'manager'
                                ? 'bg-emerald-400/30 text-emerald-100 border-emerald-300/50'
                                : 'bg-sky-400/30 text-sky-100 border-sky-300/50'
                            }`}
                          >
                            {item.role}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs sm:text-sm text-white/90 font-normal">
                            {item.email}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            disabled={isDisabled}
                            title={deleteTitle}
                            onClick={() => handleDelete(item)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                              isDisabled
                                ? 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed opacity-40'
                                : 'bg-rose-500/20 hover:bg-rose-500/35 text-rose-100 border border-rose-400/40 hover:border-rose-300 shadow-sm'
                            }`}
                          >
                            {isDeletingThis ? 'Deleting...' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Users;
