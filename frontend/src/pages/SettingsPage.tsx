import { useState } from "react";
import { Pencil, Trash2, Key, X, Check, AlertTriangle } from "lucide-react";

interface User {
  id: number;
  name: string;
  email: string;
  usertype: "admin" | "csr" | "operator";
  password: string;
}

const initialUsers: User[] = [
  { id: 1, name: "Admin User", email: "admin@example.com", usertype: "admin", password: "admin123" },
  { id: 2, name: "CSR Agent", email: "csr@example.com", usertype: "csr", password: "csr123" },
  { id: 3, name: "Operator One", email: "operator@example.com", usertype: "operator", password: "op123" },
];

const USERTYPES = ["admin", "csr", "operator"] as const;

const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generatePassword(length = 10): string {
  let password = "";
  for (let i = 0; i < length; i++) {
    password += ALPHANUMERIC.charAt(Math.floor(Math.random() * ALPHANUMERIC.length));
  }
  return password;
}

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="text-amber-500" size={24} />
          <h3 className="text-lg font-semibold text-gray-800">Confirm</h3>
        </div>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordModal({
  user,
  onClose,
  onSave,
}: {
  user: User;
  onClose: () => void;
  onSave: (newPassword: string) => void;
}) {
  const [password, setPassword] = useState("");

  const handleGenerate = () => {
    setPassword(generatePassword());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            Change Password – {user.name}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter or generate a password"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleGenerate}
          className="w-full mb-4 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition cursor-pointer"
        >
          Generate Password
        </button>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(password)}
            disabled={!password}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; email: string; usertype: User["usertype"] }>({
    name: "",
    email: "",
    usertype: "admin",
  });

  // Confirmation state
  const [confirmAction, setConfirmAction] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Change password modal state
  const [passwordModalUser, setPasswordModalUser] = useState<User | null>(null);

  const handleEdit = (user: User) => {
    setEditingId(user.id);
    setEditForm({ name: user.name, email: user.email, usertype: user.usertype });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = (id: number) => {
    setConfirmAction({
      message: "Are you sure you want to save these changes?",
      onConfirm: () => {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === id
              ? { ...u, name: editForm.name, email: editForm.email, usertype: editForm.usertype }
              : u
          )
        );
        setEditingId(null);
        setConfirmAction(null);
      },
    });
  };

  const handleDelete = (id: number) => {
    const user = users.find((u) => u.id === id);
    setConfirmAction({
      message: `Are you sure you want to delete "${user?.name}"?`,
      onConfirm: () => {
        setUsers((prev) => prev.filter((u) => u.id !== id));
        setConfirmAction(null);
      },
    });
  };

  const handleChangePasswordSave = (newPassword: string) => {
    if (!passwordModalUser) return;
    setUsers((prev) =>
      prev.map((u) =>
        u.id === passwordModalUser.id ? { ...u, password: newPassword } : u
      )
    );
    setPasswordModalUser(null);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Settings</h1>

      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">User Accounts</h2>
      </div>

      {/* Confirmation Dialog */}
      {confirmAction && (
        <ConfirmDialog
          message={confirmAction.message}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Change Password Modal */}
      {passwordModalUser && (
        <ChangePasswordModal
          user={passwordModalUser}
          onClose={() => setPasswordModalUser(null)}
          onSave={handleChangePasswordSave}
        />
      )}

      {/* Users Table */}
      <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-sm font-semibold text-gray-600">Name</th>
              <th className="px-4 py-3 text-sm font-semibold text-gray-600">Email</th>
              <th className="px-4 py-3 text-sm font-semibold text-gray-600">User Type</th>
              <th className="px-4 py-3 text-sm font-semibold text-gray-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                {editingId === user.id ? (
                  <>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={editForm.usertype}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            usertype: e.target.value as User["usertype"],
                          }))
                        }
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {USERTYPES.map((type) => (
                          <option key={type} value={type}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleSaveEdit(user.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 transition cursor-pointer"
                        >
                          <Check size={16} />
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-sm hover:bg-gray-300 transition cursor-pointer"
                        >
                          <X size={16} />
                          Cancel
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-gray-800">{user.name}</td>
                    <td className="px-4 py-3 text-gray-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                        {user.usertype}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition cursor-pointer"
                        >
                          <Pencil size={16} />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 transition cursor-pointer"
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                        <button
                          onClick={() => setPasswordModalUser(user)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm hover:bg-amber-600 transition cursor-pointer"
                        >
                          <Key size={16} />
                          Change Password
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  No user accounts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}