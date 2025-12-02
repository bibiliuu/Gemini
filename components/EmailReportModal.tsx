import React, { useMemo } from 'react';
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

  const totalAmount = reportData.reduce((sum, t) => sum + t.amount, 0);

  // 3. Excel Download Handler
  const [isSaving, setIsSaving] = React.useState(false);

  const handleDownloadExcel = () => {
    // UPDATED COLUMNS: Date, Taker, Taker Income, Controller Income, Superior Income, Total
    const headers = ['序号', '下单日期', '接单人', '接单收入', '场控收入', '直属收入', '总金额'];
    const titleText = `Muse Club 账单报告 (${dateRange.subjectStr})`;

    // CSS for Excel Styling
    const styles = `
      <style>
        body { font-family: 'Microsoft YaHei', 'SimHei', sans-serif; }
        table { border-collapse: collapse; width: 100%; }
        th { 
          background-color: #99f6e4; /* Teal-200 */
          color: #115e59; /* Teal-800 */
          border: 1px solid #5eead4; 
          padding: 10px; 
          text-align: center; 
          font-weight: bold;
        }
        td { 
          border: 1px solid #ccfbf1; 
          padding: 8px; 
          color: #333;
          text-align: center;
        }
        .title-row {
            font-size: 18px;
            font-weight: bold;
            background-color: #ffffff;
            color: #000000;
            border: none;
            padding: 15px;
        }
        tr:nth-child(even) { background-color: #f0fdfa; }
        .amount { font-weight: bold; }
        .income-col { color: #555; }
      </style>
    `;

    const tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        ${styles}
      </head>
      <body>
        <table>
          <thead>
            <tr><th colspan="7" class="title-row">${titleText}</th></tr>
            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${reportData.map((t, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${t.orderDate || ''}</td>
                <td>${t.taker}</td>
                <td class="income-col">${t.distribution.taker.toFixed(2)}</td>
                <td class="income-col">${t.distribution.controller.toFixed(2)}</td>
                <td class="income-col">${t.distribution.superior.toFixed(2)}</td>
                <td class="amount">${t.amount.toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr>
                <td colspan="6" style="text-align:right; font-weight:bold; border-top: 2px solid #99f6e4;">总计:</td>
                <td style="font-weight:bold; border-top: 2px solid #99f6e4;">¥${totalAmount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\uFEFF', tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    // Fix: Replace all slashes with dashes for valid filename
    const safeSubject = dateRange.subjectStr.replace(/\//g, '-');
    const filename = `${safeSubject}_账单报告.xls`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
              三日账单
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
              <h1 className="text-xl font-bold text-gray-900">Excel 报表预览</h1>
              <p className="text-gray-500 mt-2 text-sm">{dateRange.subjectStr}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm border-collapse">
                <thead>
                  <tr className="bg-teal-50 border-b border-teal-200 text-teal-800">
                    <th className="p-2 text-center w-12">状态</th>
                    <th className="p-2 text-center">日期</th>
                    <th className="p-2 text-center">接单人</th>
                    <th className="p-2 text-right text-green-700">接单收入</th>
                    <th className="p-2 text-right text-blue-700">场控收入</th>
                    <th className="p-2 text-right text-amber-700">直属收入</th>
                    <th className="p-2 text-right text-gray-900">总金额</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reportData.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-gray-400">该时间段内无已批准的记录</td></tr>
                  ) : (
                    reportData.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="p-2 text-center">
                          {t.status === 'paid' ? (
                            <span className="text-xs font-bold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">已付</span>
                          ) : (
                            <span className="text-xs text-green-600 bg-green-100 px-1.5 py-0.5 rounded">未付</span>
                          )}
                        </td>
                        <td className="p-2 text-center font-medium">{t.orderDate}</td>
                        <td className="p-2 text-center">{t.taker}</td>
                        <td className="p-2 text-right text-green-700">¥{t.distribution.taker.toFixed(2)}</td>
                        <td className="p-2 text-right text-blue-700">¥{t.distribution.controller.toFixed(2)}</td>
                        <td className="p-2 text-right text-amber-700">¥{t.distribution.superior.toFixed(2)}</td>
                        <td className="p-2 text-right font-bold text-gray-900">¥{t.amount.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {reportData.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-50 font-bold border-t border-gray-200">
                      <td colSpan={6} className="p-3 text-right">总计:</td>
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