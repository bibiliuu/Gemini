import React, { useMemo } from 'react';
// @ts-ignore
import * as XLSX from 'xlsx-js-style';
import { TransactionRecord } from '../types';
import { X, FileSpreadsheet, CalendarRange, Download, CheckCheck } from 'lucide-react';

interface Props {
  transactions: TransactionRecord[];
  isOpen: boolean;
  onClose: () => void;
  onMarkAsPaid: (ids: string[]) => Promise<void>;
}

export const EmailReportModal: React.FC<Props> = ({ transactions, isOpen, onClose, onMarkAsPaid }) => {

  // 1. Calculate Beijing Date Range (Previous 3 Days)
  const dateRange = useMemo(() => {
    if (!isOpen) return { subjectStr: '', startStr: '', endStr: '' };

    // Get Beijing Date parts using Intl
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });

    const now = new Date();
    const parts = formatter.formatToParts(now);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1;
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');

    // Construct Beijing "Today" Date Object
    const beijingNow = new Date(year, month, day);

    // Calculate End Date (Yesterday)
    const endDate = new Date(beijingNow);
    endDate.setDate(beijingNow.getDate() - 1); // Yesterday

    // Calculate Start Date (3 days before Yesterday)
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 2); // -2 more days = 3 days total span

    const formatDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    const formatFullDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    return {
      subjectStr: `${formatDate(startDate)}-${formatDate(endDate)} 账单`, // e.g., 11/19-11/21
      startStr: formatFullDate(startDate),
      endStr: formatFullDate(endDate),
      startDateObj: startDate,
      endDateObj: endDate
    };
  }, [isOpen]);

  // 2. Filter Data by SUBMISSION TIMESTAMP (System Time)
  // Requirement: "Based on submission time not approval time"
  const reportData = useMemo(() => {
    if (!isOpen || !dateRange.startDateObj) return [];

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });

    const now = new Date();
    const parts = formatter.formatToParts(now);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1;
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');

    // Beijing Midnight Today (Start of Day in Beijing Time)
    const beijingTodayMidnightUTC = Date.UTC(year, month, day) - (8 * 60 * 60 * 1000);

    // Window: 
    // End of Yesterday (Beijing) = beijingTodayMidnightUTC - 1ms
    const endEpoch = beijingTodayMidnightUTC - 1;

    // Start of 3 days ago (Beijing)
    const startEpoch = beijingTodayMidnightUTC - (3 * 24 * 60 * 60 * 1000);

    return transactions.filter(t => {
      // Include BOTH Approved and Paid items
      if (t.status !== 'approved' && t.status !== 'paid') return false;

      // Filter by timestamp (Submission Time)
      return t.timestamp >= startEpoch && t.timestamp <= endEpoch;
    }).sort((a, b) => a.timestamp - b.timestamp);

  }, [transactions, isOpen, dateRange]);

  // 2.5 Aggregate Data by Person
  const personStats = useMemo(() => {
    const stats = new Map<string, {
      name: string;
      takerIncome: number;
      controllerIncome: number;
      superiorIncome: number;
      totalIncome: number;
      isUnpaid: boolean;
    }>();

    const addIncome = (name: string, type: 'taker' | 'controller' | 'superior', amount: number, status: string) => {
      if (!name || name === '无' || amount <= 0) return;

      const existing = stats.get(name) || {
        name,
        takerIncome: 0,
        controllerIncome: 0,
        superiorIncome: 0,
        totalIncome: 0,
        isUnpaid: false
      };

      if (type === 'taker') existing.takerIncome += amount;
      if (type === 'controller') existing.controllerIncome += amount;
      if (type === 'superior') existing.superiorIncome += amount;
      existing.totalIncome += amount;

      // If any transaction contributing to this person is not paid, mark person as unpaid
      if (status !== 'paid') {
        existing.isUnpaid = true;
      }

      stats.set(name, existing);
    };

    reportData.forEach(t => {
      addIncome(t.taker, 'taker', t.distribution.taker, t.status);
      addIncome(t.controller, 'controller', t.distribution.controller, t.status);
      addIncome(t.superior, 'superior', t.distribution.superior, t.status);
    });

    return Array.from(stats.values()).sort((a, b) => b.totalIncome - a.totalIncome);
  }, [reportData]);

  const totalAmount = personStats.reduce((sum, p) => sum + p.totalIncome, 0);

  // 3. Excel Download Handler
  const [isSaving, setIsSaving] = React.useState(false);

  const handleDownloadExcel = () => {
    // 1. Prepare Data
    const headers = ['状态', '姓名', '接单收入', '场控收入', '直属收入', '总收入'];

    const data = personStats.map((p, i) => [
      !p.isUnpaid ? '已付' : '未付',
      p.name,
      p.takerIncome,
      p.controllerIncome,
      p.superiorIncome,
      p.totalIncome
    ]);

    // Add Total Row
    data.push(['', '总计', 0, 0, 0, totalAmount]);

    // 2. Create Worksheet
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

    // 3. Define Styles
    const headerStyle = {
      fill: { fgColor: { rgb: "99F6E4" } }, // Teal-200
      font: { bold: true, color: { rgb: "115E59" } }, // Teal-800
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "5EEAD4" } },
        bottom: { style: "thin", color: { rgb: "5EEAD4" } },
        left: { style: "thin", color: { rgb: "5EEAD4" } },
        right: { style: "thin", color: { rgb: "5EEAD4" } }
      }
    };

    const cellStyle = {
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "CCFBF1" } },
        bottom: { style: "thin", color: { rgb: "CCFBF1" } },
        left: { style: "thin", color: { rgb: "CCFBF1" } },
        right: { style: "thin", color: { rgb: "CCFBF1" } }
      }
    };

    const paidStyle = { ...cellStyle, font: { bold: true, color: { rgb: "7E22CE" } } }; // Purple
    const unpaidStyle = { ...cellStyle, font: { color: { rgb: "059669" } } }; // Green
    const totalLabelStyle = { ...cellStyle, font: { bold: true }, alignment: { horizontal: "right" } };
    const totalValueStyle = { ...cellStyle, font: { bold: true, color: { rgb: "4F46E5" } } }; // Indigo

    // 4. Apply Styles
    const range = XLSX.utils.decode_range(ws['!ref']!);

    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cell_address]) continue;

        // Header Row
        if (R === 0) {
          ws[cell_address].s = headerStyle;
        }
        // Data Rows
        else if (R <= personStats.length) {
          // Status Column (0)
          if (C === 0) {
            const val = ws[cell_address].v;
            ws[cell_address].s = val === '已付' ? paidStyle : unpaidStyle;
          } else {
            ws[cell_address].s = cellStyle;
          }
        }
        // Total Row
        else {
          if (C === 1) ws[cell_address].s = totalLabelStyle;
          else if (C === 5) ws[cell_address].s = totalValueStyle;
          else ws[cell_address].s = cellStyle;
        }
      }
    }

    // 5. Set Column Widths
    ws['!cols'] = [
      { wch: 10 }, // Status
      { wch: 15 }, // Name
      { wch: 12 }, // Income
      { wch: 12 }, // Income
      { wch: 12 }, // Income
      { wch: 15 }  // Total
    ];

    // 6. Generate File
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "收入统计");

    // Fix: Replace all slashes with dashes for valid filename
    const safeSubject = dateRange.subjectStr.replace(/\//g, '-');
    const filename = `${safeSubject}_人员收入统计.xlsx`;

    XLSX.writeFile(wb, filename);
  };

  const handleMarkAllPaid = async () => {
    const ids = reportData.map(t => t.id);
    if (ids.length > 0) {
      setIsSaving(true);
      try {
        await onMarkAsPaid(ids);
      } finally {
        setIsSaving(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <CalendarRange className="w-5 h-5 text-indigo-600" />
              三日人员收入统计
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              北京时间范围: <span className="font-medium text-indigo-600">{dateRange.startStr} 至 {dateRange.endStr}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content Preview */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-100">
          <div className="bg-white shadow-lg p-8 min-h-[400px] mx-auto max-w-[900px] border border-gray-200">
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold text-gray-900">人员收入统计预览</h1>
              <p className="text-gray-500 mt-2 text-sm">{dateRange.subjectStr}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm border-collapse">
                <thead>
                  <tr className="bg-teal-50 border-b border-teal-200 text-teal-800">
                    <th className="p-2 text-center w-12">状态</th>
                    <th className="p-2 text-center">姓名</th>
                    <th className="p-2 text-right text-green-700">接单收入</th>
                    <th className="p-2 text-right text-blue-700">场控收入</th>
                    <th className="p-2 text-right text-amber-700">直属收入</th>
                    <th className="p-2 text-right text-gray-900">总收入</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {personStats.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-gray-400">该时间段内无已批准的记录</td></tr>
                  ) : (
                    personStats.map((p, i) => (
                      <tr key={p.name} className="hover:bg-gray-50">
                        <td className="p-2 text-center">
                          {!p.isUnpaid ? (
                            <span className="text-xs font-bold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">已付</span>
                          ) : (
                            <span className="text-xs text-green-600 bg-green-100 px-1.5 py-0.5 rounded">未付</span>
                          )}
                        </td>
                        <td className="p-2 text-center font-medium">{p.name}</td>
                        <td className="p-2 text-right text-green-700">¥{p.takerIncome.toFixed(2)}</td>
                        <td className="p-2 text-right text-blue-700">¥{p.controllerIncome.toFixed(2)}</td>
                        <td className="p-2 text-right text-amber-700">¥{p.superiorIncome.toFixed(2)}</td>
                        <td className="p-2 text-right font-bold text-gray-900">¥{p.totalIncome.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {personStats.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-50 font-bold border-t border-gray-200">
                      <td colSpan={5} className="p-3 text-right">总计:</td>
                      <td className="p-3 text-right text-indigo-600">¥{totalAmount.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-100 bg-white rounded-b-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={handleMarkAllPaid}
            disabled={reportData.length === 0 || isSaving}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-400 text-white rounded-xl hover:bg-purple-500 transition-colors shadow-lg shadow-purple-100 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <span className="animate-spin">⏳</span> : <CheckCheck className="w-5 h-5" />}
            {isSaving ? '保存中...' : '全部标记为已付'}
          </button>

          <button
            onClick={handleDownloadExcel}
            disabled={reportData.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-400 text-white rounded-xl hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-100 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="w-5 h-5" />
            下载 Excel 报表
          </button>
        </div>
      </div>
    </div>
  );
};