import React, { useState, useEffect, useMemo } from 'react';
import { Upload, FileText, Trash2, AlertCircle, Loader2, Search, User, Users, Crown, CheckCircle2, Clock, XCircle, Image as ImageIcon, X, Ban, AlertTriangle, FileSpreadsheet, CheckCheck, Filter, LogOut, Settings } from 'lucide-react';
import { analyzeScreenshot } from './services/geminiService';
import { TransactionRaw, TransactionRecord, DashboardStats, User as AppUser, DistributionConfig } from './types';
import { ReviewModal } from './components/ReviewModal';
import { StatsDisplay } from './components/DashboardStats';
import { EmailReportModal } from './components/EmailReportModal';
import { LoginScreen } from './components/LoginScreen';
import { UserManagementModal } from './components/UserManagementModal';

// Custom Confirmation Modal Component
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ isOpen, title, message, onConfirm, onCancel, isDestructive = false }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-auto transform transition-all scale-100">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6 text-sm leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 px-4 text-white rounded-xl font-medium shadow-lg transition-colors ${isDestructive
              ? 'bg-red-600 hover:bg-red-700 shadow-red-200'
              : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
              }`}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
};

// Rejection Reason Dialog
interface RejectReasonDialogProps {
  isOpen: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

const RejectReasonDialog: React.FC<RejectReasonDialogProps> = ({ isOpen, onConfirm, onCancel }) => {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-auto">
        <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
          <XCircle className="w-5 h-5 text-red-600" />
          拒绝申请
        </h3>
        <p className="text-gray-600 mb-4 text-sm">请输入拒绝原因，该记录将被移动至“已拒绝”列表。</p>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="例如：金额错误、重复提交..."
          className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none min-h-[100px] text-sm mb-6 bg-white text-gray-900"
          autoFocus
        />

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim()}
            className="flex-1 py-2.5 px-4 text-white rounded-xl font-medium shadow-lg bg-red-600 hover:bg-red-700 shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            确认拒绝
          </button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  // --- AUTH STATE ---
  const [appUsers, setAppUsers] = useState<AppUser[]>(() => {
    const saved = localStorage.getItem('muse_app_users');
    if (saved) return JSON.parse(saved);
    // Default Admin
    return [{
      id: 'default-admin',
      username: 'admin',
      password: '123456',
      name: '超级管理员',
      role: 'admin'
    }];
  });

  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const sess = sessionStorage.getItem('muse_current_user');
    return sess ? JSON.parse(sess) : null;
  });

  // --- APP STATE ---
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);

  // Fetch transactions on load
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const API_URL = import.meta.env.DEV ? 'http://localhost:3000/api/transactions' : '/api/transactions';
        const res = await fetch(API_URL);
        if (res.ok) {
          const data = await res.json();
          setTransactions(data);
        }
      } catch (e) {
        console.error("Failed to fetch transactions", e);
      }
    };
    fetchTransactions();
  }, []);

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'paid'>('all');

  // Review Modal State
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'approve';
    data: TransactionRaw | TransactionRecord;
    imageUrl: string;
  } | null>(null);

  // Simple Image Viewer State
  const [viewImage, setViewImage] = useState<string | null>(null);

  // Confirmation Dialog State
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDestructive?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

  // Reject Reason Dialog State
  const [rejectDialog, setRejectDialog] = useState<{
    isOpen: boolean;
    targetId: string | null;
  }>({ isOpen: false, targetId: null });

  // Email Report Modal State
  const [isReportOpen, setIsReportOpen] = useState(false);

  // User Management Modal
  const [isUserMgmtOpen, setIsUserMgmtOpen] = useState(false);

  // --- EFFECTS ---
  // REMOVED: LocalStorage Sync
  // useEffect(() => {
  //   localStorage.setItem('wechat_transactions_v2', JSON.stringify(transactions));
  // }, [transactions]);

  useEffect(() => {
    localStorage.setItem('muse_app_users', JSON.stringify(appUsers));
  }, [appUsers]);

  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem('muse_current_user', JSON.stringify(currentUser));
    } else {
      sessionStorage.removeItem('muse_current_user');
    }
  }, [currentUser]);

  // --- COMPUTED ---
  const filteredList = useMemo(() => {
    let list = transactions;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = transactions.filter(t => {
        return (
          t.taker?.toLowerCase().includes(term) ||
          t.controller?.toLowerCase().includes(term) ||
          t.superior?.toLowerCase().includes(term) ||
          t.content?.toLowerCase().includes(term) ||
          t.orderDate?.toLowerCase().includes(term)
        );
      });
    }
    return list;
  }, [transactions, searchTerm]);

  const activeTransactions = useMemo(() =>
    filteredList.filter(t => t.status !== 'rejected'),
    [filteredList]);

  const rejectedTransactions = useMemo(() =>
    filteredList.filter(t => t.status === 'rejected'),
    [filteredList]);

  const visibleTransactions = useMemo(() => {
    if (statusFilter === 'all') return activeTransactions;
    return activeTransactions.filter(t => t.status === statusFilter);
  }, [activeTransactions, statusFilter]);

  const approvedTransactions = useMemo(() =>
    activeTransactions.filter(t => t.status === 'approved' || t.status === 'paid'),
    [activeTransactions]);

  const stats: DashboardStats = useMemo(() => {
    return approvedTransactions.reduce((acc, curr) => ({
      totalRevenue: acc.totalRevenue + curr.amount,
      totalTaker: acc.totalTaker + curr.distribution.taker,
      totalController: acc.totalController + curr.distribution.controller,
      totalSuperior: acc.totalSuperior + curr.distribution.superior,
      orderCount: acc.orderCount + 1,
    }), {
      totalRevenue: 0, totalTaker: 0, totalController: 0, totalSuperior: 0, orderCount: 0
    });
  }, [approvedTransactions]);

  // --- PERMISSIONS ---
  const isAdmin = currentUser?.role === 'admin';
  const isUser = currentUser?.role === 'user';

  // --- HANDLERS ---

  const handleLogin = (user: AppUser) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setStatusFilter('all');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        try {
          const analysis = await analyzeScreenshot(base64Data, file.type);
          setModalState({
            isOpen: true,
            mode: 'create',
            data: analysis,
            imageUrl: base64String
          });
        } catch (err: any) {
          console.error(err);
          setError("识别失败。请确保 API Key 配置正确，且图片清晰。");
        } finally {
          setIsProcessing(false);
          event.target.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (e) {
      setError("文件读取失败。");
      setIsProcessing(false);
    }
  };


  const handleSaveModal = (dataArray: Omit<TransactionRecord, 'id' | 'timestamp' | 'imageUrl' | 'status'>[]) => {
    if (!modalState) return;

    const API_URL = import.meta.env.DEV ? 'http://localhost:3000/api/transactions' : '/api/transactions';

    const saveToBackend = async (records: TransactionRecord[]) => {
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(records)
        });
        if (!res.ok) throw new Error("Failed to save");
        const savedData = await res.json();
        return savedData;
      } catch (e) {
        console.error(e);
        alert("保存失败，请检查网络");
      }
    };

    const generateUUID = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    if (modalState.mode === 'create') {
      const newRecords: TransactionRecord[] = dataArray.map(d => ({
        id: generateUUID(),
        timestamp: Date.now(),
        imageUrl: modalState.imageUrl,
        status: 'pending',
        ...d
      }));

      saveToBackend(newRecords).then(() => {
        setTransactions(prev => [...newRecords, ...prev]);
      });

    } else {
      // Only Admin can approve usually, but this function is called by ReviewModal
      const originalRecord = modalState.data as TransactionRecord;
      const existingId = originalRecord.id;
      const submissionTimestamp = originalRecord.timestamp || Date.now();

      const approvedRecords: TransactionRecord[] = dataArray.map(d => ({
        id: generateUUID(),
        timestamp: submissionTimestamp,
        imageUrl: modalState.imageUrl,
        status: 'approved',
        ...d
      }));

      // NOTE: For update/approve, our simple backend 'create' endpoint might not be enough if we want to DELETE the old pending one.
      // But for this MVP, we will just add the new Approved ones.
      // TODO: Add a real 'update' or 'delete' endpoint later.

      saveToBackend(approvedRecords).then(() => {
        setTransactions(prev => {
          const filtered = prev.filter(t => t.id !== existingId);
          return [...approvedRecords, ...filtered];
        });
      });
    }
    setModalState(null);
  };


  const handleBatchMarkAsPaid = (ids: string[]) => {
    if (!isAdmin) return;
    setTransactions(prev => prev.map(t =>
      ids.includes(t.id) ? { ...t, status: 'paid' } : t
    ));
  };

  const handleRejectModal = () => {
    if (!modalState) return;
    if (modalState.mode === 'approve') {
      // Check Admin Permission
      if (!isAdmin) return;
      const id = (modalState.data as TransactionRecord).id;
      setRejectDialog({ isOpen: true, targetId: id });
    } else {
      setModalState(null);
    }
  };

  const handleConfirmReject = (reason: string) => {
    if (!rejectDialog.targetId) return;
    if (!isAdmin) return;
    setTransactions(prev => prev.map(t =>
      t.id === rejectDialog.targetId
        ? { ...t, status: 'rejected', notes: reason }
        : t
    ));
    setRejectDialog({ isOpen: false, targetId: null });
    setModalState(null);
  };

  const handleDelete = (id: string) => {
    if (!isAdmin) return;
    setConfirmState({
      isOpen: true,
      title: '永久删除',
      message: '确定要永久删除这条记录吗？此操作无法撤销。',
      isDestructive: true,
      onConfirm: () => {
        setTransactions(prev => prev.filter(t => t.id !== id));
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteAllRejected = () => {
    if (!isAdmin) return;
    if (rejectedTransactions.length === 0) return;
    setConfirmState({
      isOpen: true,
      title: '清空已拒绝记录',
      message: `确定要永久删除所有 ${rejectedTransactions.length} 条已拒绝的记录吗？`,
      isDestructive: true,
      onConfirm: () => {
        setTransactions(prev => prev.filter(t => t.status !== 'rejected'));
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteVisible = () => {
    if (!isAdmin) return;
    if (visibleTransactions.length === 0) return;
    const filterName =
      statusFilter === 'all' ? '当前列表' :
        statusFilter === 'pending' ? '待审核' :
          statusFilter === 'approved' ? '已批准' : '已付';

    setConfirmState({
      isOpen: true,
      title: `清空${filterName}记录`,
      message: `危险操作：确定要清空当前筛选出的 ${visibleTransactions.length} 条记录吗？`,
      isDestructive: true,
      onConfirm: () => {
        const visibleIds = new Set(visibleTransactions.map(t => t.id));
        setTransactions(prev => prev.filter(t => !visibleIds.has(t.id)));
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const openApproveModal = (record: TransactionRecord) => {
    if (!isAdmin) return;
    setModalState({
      isOpen: true,
      mode: 'approve',
      data: record,
      imageUrl: record.imageUrl || ''
    });
  };

  const checkDuplicate = (date: string, taker: string, amount: number) => {
    const currentId = modalState?.mode === 'approve' ? (modalState.data as TransactionRecord).id : undefined;
    const cleanString = (str: string) => str?.toLowerCase().replace(/\s/g, '') || "";
    const cleanDate = (str: string) => str?.replace(/[.\/-]/g, '').replace(/\s/g, '') || "";
    const nDateClean = cleanDate(date?.trim() || "");
    const nTakerClean = cleanString(taker);
    const nAmount = amount;

    return transactions.some(t => {
      if (currentId && t.id === currentId) return false;
      if (t.status === 'rejected') return false;
      const tDateClean = cleanDate(t.orderDate?.trim() || "");
      const tTakerClean = cleanString(t.taker);
      const isDateEmpty1 = tDateClean === "" || tDateClean === "无日期";
      const isDateEmpty2 = nDateClean === "" || nDateClean === "无日期";
      const dateMatch = (tDateClean === nDateClean) || (isDateEmpty1 && isDateEmpty2);
      const takerMatch = tTakerClean === nTakerClean;
      const amountMatch = Math.abs(t.amount - nAmount) < 0.01;
      return dateMatch && takerMatch && amountMatch;
    });
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  // --- RENDER LOGIN ---
  if (!currentUser) {
    return <LoginScreen users={appUsers} onLogin={handleLogin} />;
  }

  // --- RENDER APP ---
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">

        <ConfirmDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
          isDestructive={confirmState.isDestructive}
        />

        <RejectReasonDialog
          isOpen={rejectDialog.isOpen}
          onConfirm={handleConfirmReject}
          onCancel={() => setRejectDialog({ isOpen: false, targetId: null })}
        />

        <EmailReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          transactions={transactions}
          onMarkAsPaid={handleBatchMarkAsPaid}
        />

        <UserManagementModal
          isOpen={isUserMgmtOpen}
          onClose={() => setIsUserMgmtOpen(false)}
          users={appUsers}
          onUpdateUsers={setAppUsers}
          currentUser={currentUser}
        />

        {/* Header */}
        <header className="mb-10 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">𝑴𝒖𝒔𝒆 𝑪𝒍𝒖𝒃 接单记账助手</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${isAdmin ? 'bg-indigo-100 text-indigo-700' : 'bg-green-100 text-green-700'}`}>
                {currentUser.name} ({isAdmin ? '管理员' : '用户'})
              </span>
              <p className="text-gray-500 text-sm">自动解析截图，智能计算分成收入。</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Admin Actions */}
            {isAdmin && (
              <>
                <button
                  onClick={() => setIsUserMgmtOpen(true)}
                  className="p-3 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 shadow-sm transition-colors"
                  title="用户管理"
                >
                  <Settings className="w-5 h-5" />
                </button>

                <button
                  onClick={() => setIsReportOpen(true)}
                  className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 shadow-sm transition-colors"
                >
                  <FileSpreadsheet className="w-5 h-5 text-gray-500" />
                  三天账报
                </button>
              </>
            )}

            {/* Common Actions */}
            <div className="relative">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={isProcessing}
              />
              <label
                htmlFor="file-upload"
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white shadow-lg shadow-indigo-200 transition-all cursor-pointer ${isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5'
                  }`}
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                {isProcessing ? 'AI 识别中...' : '上传截图'}
              </label>
            </div>

            <button
              onClick={handleLogout}
              className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              title="退出登录"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Stats Dashboard - AVAILABLE TO ALL, BUT WITH RESTRICTIONS */}
        <StatsDisplay
          stats={stats}
          transactions={approvedTransactions}
          userRole={currentUser.role}
        />

        {/* Review Modal */}
        {modalState && (
          <ReviewModal
            initialData={modalState.data}
            // Pass saved config if in approve mode
            initialConfig={modalState.mode === 'approve' ? (modalState.data as TransactionRecord).distributionConfig : undefined}
            imageUrl={modalState.imageUrl}
            mode={modalState.mode}
            isAdmin={isAdmin}
            checkDuplicate={checkDuplicate}
            onSave={handleSaveModal}
            onReject={handleRejectModal}
            onCancel={() => setModalState(null)}
          />
        )}

        {/* View Image Modal */}
        {viewImage && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={() => setViewImage(null)}
          >
            <button className="absolute top-4 right-4 p-2 bg-white/10 rounded-full text-white hover:bg-white/20">
              <X className="w-6 h-6" />
            </button>
            <img
              src={viewImage}
              alt="Full Screenshot"
              className="max-w-full max-h-full object-contain rounded shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* Active Transactions List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-12">
          {/* Responsive Table Header */}
          <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">

              {/* Title and Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full sm:w-auto overflow-hidden">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 whitespace-nowrap">
                  <FileText className="w-5 h-5 text-gray-400" />
                  账单记录
                </h2>

                {/* Status Filters - Scrollable on mobile */}
                <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 pr-4">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap shrink-0 ${statusFilter === 'all'
                      ? 'bg-gray-800 text-white border-gray-800 shadow-md'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                  >
                    全部 ({activeTransactions.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap shrink-0 ${statusFilter === 'pending'
                      ? 'bg-yellow-500 text-white border-yellow-600 shadow-md'
                      : 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
                      }`}
                  >
                    待审核 ({activeTransactions.filter(t => t.status === 'pending').length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('approved')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap shrink-0 ${statusFilter === 'approved'
                      ? 'bg-green-600 text-white border-green-700 shadow-md'
                      : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                      }`}
                  >
                    已批准 ({activeTransactions.filter(t => t.status === 'approved').length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('paid')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap shrink-0 ${statusFilter === 'paid'
                      ? 'bg-purple-600 text-white border-purple-700 shadow-md'
                      : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                      }`}
                  >
                    已付 ({activeTransactions.filter(t => t.status === 'paid').length})
                  </button>
                </div>
              </div>

              {/* Search & Actions */}
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                {/* Bulk Delete Active/Visible - ADMIN ONLY */}
                {isAdmin && visibleTransactions.length > 0 && (
                  <button
                    onClick={handleDeleteVisible}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    清空{statusFilter !== 'all' ? '当前' : '全部'}
                  </button>
                )}

                {/* Search Bar */}
                <div className="relative w-full md:w-64">
                  <input
                    type="text"
                    placeholder="搜索姓名、内容..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
                  />
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>
          </div>

          {visibleTransactions.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Filter className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>{searchTerm ? '未找到匹配的记录。' : '此状态下暂无记录。'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
                  <tr>
                    <th className="px-6 py-4 w-24">截图</th>
                    <th className="px-6 py-4">状态</th>
                    <th className="px-6 py-4">提交时间 (北京)</th>
                    <th className="px-6 py-4">日期 / 内容</th>
                    <th className="px-6 py-4">相关人员</th>
                    <th className="px-6 py-4 text-right">总金额</th>
                    <th className="px-6 py-4 text-right text-green-600">接单人 (80%)</th>
                    <th className="px-6 py-4 text-right text-blue-600">场控</th>
                    <th className="px-6 py-4 text-right text-amber-600">直属</th>
                    {isAdmin && <th className="px-6 py-4 text-center">操作</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleTransactions.map((t) => {
                    const isPending = t.status === 'pending';
                    const isPaid = t.status === 'paid';
                    return (
                      <tr key={t.id} className={`transition-colors ${isPending ? 'bg-yellow-50/30 hover:bg-yellow-50/60' : (isPaid ? 'bg-purple-50/30 hover:bg-purple-50/60' : 'hover:bg-gray-50/50')}`}>
                        <td className="px-6 py-4">
                          {t.imageUrl ? (
                            <button
                              onClick={() => setViewImage(t.imageUrl!)}
                              className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center hover:scale-105 transition-transform overflow-hidden"
                            >
                              <img src={t.imageUrl} alt="thumb" className="w-full h-full object-cover" />
                            </button>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-gray-300" />
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {isPending ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              <Clock className="w-3 h-3" /> 待审核
                            </span>
                          ) : isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              <CheckCheck className="w-3 h-3" /> 已付
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle2 className="w-3 h-3" /> 已批准
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-500">
                          {formatDate(t.timestamp)}
                        </td>
                        <td className="px-6 py-4">
                          <div className={`font-medium ${!t.orderDate ? 'text-gray-400 italic' : 'text-gray-900'}`}>
                            {t.orderDate || "无日期"}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[150px]" title={t.content}>
                            {t.content || "无内容"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs">
                              <User className="w-3 h-3 text-green-500" />
                              <span className="text-gray-900">{t.taker}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs">
                              <Users className="w-3 h-3 text-blue-500" />
                              <span className="text-gray-600">{t.controller}</span>
                            </div>
                            {(t.distribution.superior > 0 || t.superior !== '无') && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <Crown className="w-3 h-3 text-amber-500" />
                                <span className="text-amber-700">{t.superior === '无' && t.status === 'pending' ? '待确认' : t.superior}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-gray-900 text-base">
                          ¥{t.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-green-700">
                          {isPending ? <span className="text-gray-400 italic">计算中</span> : `¥${t.distribution.taker.toFixed(2)}`}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-blue-700">
                          {isPending ? <span className="text-gray-400 italic">计算中</span> : `¥${t.distribution.controller.toFixed(2)}`}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-amber-700">
                          {isPending ? <span className="text-gray-400 italic">计算中</span> : (
                            t.distribution.superior > 0 ? `¥${t.distribution.superior.toFixed(2)}` : '-'
                          )}
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {isPending && (
                                <button
                                  onClick={() => openApproveModal(t)}
                                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all"
                                >
                                  批准
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(t.id)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="删除记录"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rejected Transactions Section - AVAILABLE TO ALL */}
        {rejectedTransactions.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden mb-12">
            <div className="p-6 bg-red-50/50 border-b border-red-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <XCircle className="w-5 h-5 text-red-500" />
                <h2 className="text-lg font-semibold text-gray-800">已拒绝记录 (Rejected)</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                  {rejectedTransactions.length}
                </span>
              </div>
              {isAdmin && (
                <button
                  onClick={handleDeleteAllRejected}
                  className="text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  清空已拒绝
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
                  <tr>
                    <th className="px-6 py-3 w-20">截图</th>
                    <th className="px-6 py-3">提交时间</th>
                    <th className="px-6 py-3">详情</th>
                    <th className="px-6 py-3">拒绝原因</th>
                    {isAdmin && <th className="px-6 py-3 text-right">操作</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-50">
                  {rejectedTransactions.map(t => (
                    <tr key={t.id} className="hover:bg-red-50/30">
                      <td className="px-6 py-3">
                        {t.imageUrl ? (
                          <button
                            onClick={() => setViewImage(t.imageUrl!)}
                            className="w-8 h-8 rounded bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden opacity-60 hover:opacity-100"
                          >
                            <img src={t.imageUrl} alt="thumb" className="w-full h-full object-cover grayscale" />
                          </button>
                        ) : (
                          <div className="w-8 h-8 rounded bg-gray-50 flex items-center justify-center">
                            <ImageIcon className="w-3 h-3 text-gray-300" />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3 text-xs text-gray-500 font-mono">
                        {formatDate(t.timestamp)}
                      </td>
                      <td className="px-6 py-3">
                        <div className="font-medium text-gray-700">{t.orderDate || "无日期"}</div>
                        <div className="text-xs text-gray-400">接单: {t.taker} | 金额: ¥{t.amount}</div>
                      </td>
                      <td className="px-6 py-3">
                        <div className="text-red-600 text-xs font-medium bg-red-50 px-2 py-1 rounded inline-block max-w-xs truncate" title={t.notes}>
                          {t.notes || "无原因"}
                        </div>
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-3 text-right">
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="text-gray-400 hover:text-red-600 p-1"
                            title="彻底删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default App;