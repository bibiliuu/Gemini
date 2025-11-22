import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { X, Plus, Trash2, Shield, User as UserIcon, Save, Pencil } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onUpdateUsers: (updatedUsers: User[]) => void;
  currentUser: User;
}

export const UserManagementModal: React.FC<Props> = ({ isOpen, onClose, users, onUpdateUsers, currentUser }) => {
  const [formData, setFormData] = useState({ username: '', password: '', name: '', role: 'user' as UserRole });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const resetForm = () => {
      setFormData({ username: '', password: '', name: '', role: 'user' });
      setIsFormOpen(false);
      setEditingId(null);
      setError('');
  };

  const handleStartEdit = (user: User) => {
      setFormData({
          username: user.username,
          password: user.password,
          name: user.name,
          role: user.role
      });
      setEditingId(user.id);
      setIsFormOpen(true);
      setError('');
  };

  const handleSaveUser = () => {
    if (!formData.username || !formData.password || !formData.name) {
      setError('请填写所有字段');
      return;
    }

    // Check for duplicates (exclude current user if editing)
    const duplicate = users.find(u => u.username === formData.username && u.id !== editingId);
    if (duplicate) {
      setError('用户名已存在');
      return;
    }

    if (editingId) {
        // Update existing
        const updatedList = users.map(u => u.id === editingId ? { ...u, ...formData } : u);
        onUpdateUsers(updatedList);
    } else {
        // Add new
        const userToAdd: User = {
          id: crypto.randomUUID(),
          ...formData
        };
        onUpdateUsers([...users, userToAdd]);
    }
    
    resetForm();
  };

  const handleDeleteUser = (id: string) => {
    if (id === currentUser.id) {
      alert("无法删除当前登录的账号");
      return;
    }
    if (confirm('确定要删除该用户吗？')) {
      onUpdateUsers(users.filter(u => u.id !== id));
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            用户权限管理
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto bg-gray-50/50">
          
          {/* Add/Edit User Form */}
          {isFormOpen ? (
            <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm mb-6">
              <h3 className="text-sm font-bold text-gray-700 mb-4">
                  {editingId ? '编辑用户信息' : '添加新用户'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input 
                  placeholder="登录用户名" 
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                  className="p-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <input 
                  placeholder="显示昵称" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="p-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <input 
                  placeholder="密码" 
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="p-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <select 
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                  className="p-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="user">普通用户 (User)</option>
                  <option value="admin">管理员 (Admin)</option>
                </select>
              </div>
              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
              <div className="flex gap-2 mt-4">
                <button onClick={handleSaveUser} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 shadow-sm hover:bg-indigo-700">
                  <Save className="w-3 h-3" /> 保存
                </button>
                <button onClick={resetForm} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300">
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setIsFormOpen(true)}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 font-medium hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all mb-6 flex items-center justify-center gap-2 bg-white"
            >
              <Plus className="w-4 h-4" /> 添加新用户
            </button>
          )}

          {/* User List */}
          <div className="space-y-3">
            {users.map(user => (
              <div key={user.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user.role === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-green-100 text-green-600'}`}>
                    {user.role === 'admin' ? <Shield className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="font-bold text-gray-800 flex items-center gap-2">
                      {user.name}
                      {user.id === currentUser.id && <span className="text-xs bg-gray-200 px-2 rounded-full text-gray-600">我自己</span>}
                    </div>
                    <div className="text-xs text-gray-400">@{user.username} • {user.role === 'admin' ? '管理员' : '普通用户'}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-300 font-mono mr-2">pwd: {user.password}</div>
                  
                  <button 
                    onClick={() => handleStartEdit(user)}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="编辑"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  {user.id !== currentUser.id && (
                    <button 
                      onClick={() => handleDeleteUser(user.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};