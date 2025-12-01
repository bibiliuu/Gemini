import React, { useMemo, useState } from 'react';
import { DashboardStats, TransactionRecord, UserRole } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Trophy, ChevronDown, ChevronUp, Calendar, Filter, Copy, Check, Download } from 'lucide-react';

interface Props {
  stats: DashboardStats;
  transactions: TransactionRecord[];
  userRole: UserRole;
}

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#6366F1'];

export const StatsDisplay: React.FC<Props> = ({ transactions, userRole }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const isAdmin = userRole === 'admin';

  // Calculate Current Month Key (YYYY-MM) for default state based on Beijing Time
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    return `${year}-${month}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

  // Helper to extract YYYY-MM from various date string formats
  const getMonthKey = (dateStr: string): string => {
    if (!dateStr || dateStr === '无日期' || dateStr === '') return 'Unknown';

    // clean string
    const clean = dateStr.replace(/\s/g, '');

    // Try YYYY.MM.DD or YYYY-MM-DD
    const fullMatch = clean.match(/(\d{4})[.\/-](\d{1,2})/);
    if (fullMatch) {
      return `${fullMatch[1]}-${fullMatch[2].padStart(2, '0')}`;
    }

    // Try MM.DD or MM-DD (Assume current year in Beijing)
    const shortMatch = clean.match(/(\d{1,2})[.\/-](\d{1,2})/);
    if (shortMatch) {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
      });
      const year = formatter.format(new Date());
      return `${year}-${shortMatch[1].padStart(2, '0')}`;
    }

    // Try Chinese format: YYYY年MM月 or MM月DD日
    const chineseFullMatch = clean.match(/(\d{4})年(\d{1,2})月/);
    if (chineseFullMatch) {
      return `${chineseFullMatch[1]}-${chineseFullMatch[2].padStart(2, '0')}`;
    }

    const chineseShortMatch = clean.match(/(\d{1,2})月(\d{1,2})日?/);
    if (chineseShortMatch) {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
      });
      const year = formatter.format(new Date());
      return `${year}-${chineseShortMatch[1].padStart(2, '0')}`;
    }

    console.log("Unknown date format:", dateStr);
    return 'Unknown';
  };

  // 1. Extract Available Months
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    // Always add current month to options so it's selectable even if empty
    months.add(currentMonthKey);

    transactions.forEach(t => {
      const m = getMonthKey(t.orderDate);
      if (m !== 'Unknown') months.add(m);
    });
    return Array.from(months).sort().reverse();
  }, [transactions, currentMonthKey]);

  // 2. Filter Transactions
  const filteredTransactions = useMemo(() => {
    if (selectedMonth === 'ALL') return transactions;
    return transactions.filter(t => getMonthKey(t.orderDate) === selectedMonth);
  }, [transactions, selectedMonth]);

  // 3. Calculate Stats for Filtered View
  const currentStats = useMemo(() => {
    return filteredTransactions.reduce((acc, curr) => ({
      totalRevenue: acc.totalRevenue + curr.amount,
      totalTaker: acc.totalTaker + curr.distribution.taker,
      totalController: acc.totalController + curr.distribution.controller,
      totalSuperior: acc.totalSuperior + curr.distribution.superior,
      orderCount: acc.orderCount + 1,
    }), {
      totalRevenue: 0, totalTaker: 0, totalController: 0, totalSuperior: 0, orderCount: 0
    });
  }, [filteredTransactions]);

  // Chart Data
  const chartData = [
    { name: '接单人 (80%)', value: currentStats.totalTaker },
    { name: '场控', value: currentStats.totalController },
    { name: '直属人', value: currentStats.totalSuperior },
    { name: '平台/剩余', value: currentStats.totalRevenue - (currentStats.totalTaker + currentStats.totalController + currentStats.totalSuperior) }
  ].filter(d => d.value > 0);

  const formatCurrency = (val: number) => `¥${val.toFixed(2)}`;

  // 4. Aggregate Income by Person (Top 20)
  const personStats = useMemo(() => {
    const map = new Map<string, { total: number; taker: number; controller: number; superior: number }>();

    const addIncome = (name: string, type: 'taker' | 'controller' | 'superior', amount: number) => {
      if (!name || name === '无' || name === '未知' || amount <= 0) return;
      // Strict cleaning: remove all whitespace to ensure "Alice" and "Alice " merge
      const sanitizedName = name.replace(/\s+/g, '');

      const current = map.get(sanitizedName) || { total: 0, taker: 0, controller: 0, superior: 0 };

      current.total += amount;
      current[type] += amount;

      map.set(sanitizedName, current);
    };

    filteredTransactions.forEach(t => {
      addIncome(t.taker, 'taker', t.distribution.taker);
      addIncome(t.controller, 'controller', t.distribution.controller);
      if (t.distribution.superior > 0) {
        addIncome(t.superior, 'superior', t.distribution.superior);
      }
    });

    // Convert to array, sort by total desc, and take TOP 20
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20); // LIMIT TO TOP 20
  }, [filteredTransactions]);

  // Helper: Generate text for clipboard
  const handleCopyLeaderboard = () => {
    const title = `📅 ${selectedMonth === 'ALL' ? '总榜单' : `${selectedMonth} 月度榜单`} (Top 20)`;
    const lines = personStats.map((p, i) => {
      let rankIcon = `${i + 1}.`;
      if (i === 0) rankIcon = '🥇';
      if (i === 1) rankIcon = '🥈';
      if (i === 2) rankIcon = '🥉';
      return `${rankIcon} ${p.name}  ${formatCurrency(p.total)}`;
    });

    const text = [title, '----------------', ...lines].join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(err => {
        console.error('Clipboard API failed:', err);
        fallbackCopyTextToClipboard(text);
      });
    } else {
      fallbackCopyTextToClipboard(text);
    }
  };

  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;

    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        alert('复制失败，请手动复制');
      }
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
      alert('复制失败，请手动复制');
    }
    document.body.removeChild(textArea);
  };

  // Helper: Export to Excel (Formatted HTML as XLS)
  const handleExportExcel = () => {
    // Headers in Chinese
    const headers = ['排名', '姓名', '总收入', '接单收入', '场控收入', '直属收入'];
    const titleText = selectedMonth === 'ALL' ? '总排行榜' : `${selectedMonth}月排行榜`;

    // CSS for Light Turquoise Light Style 2
    const styles = `
      <style>
        body { font-family: 'Microsoft YaHei', 'SimHei', 'Arial', sans-serif; }
        table { border-collapse: collapse; width: 100%; }
        th { 
          background-color: #99f6e4; /* Teal-200 */
          color: #115e59; /* Teal-800 */
          border: 1px solid #5eead4; /* Teal-300 */
          padding: 10px; 
          text-align: center; 
          font-weight: bold;
        }
        td { 
          border: 1px solid #ccfbf1; /* Teal-100 */
          padding: 8px; 
          color: #333;
          text-align: center; /* CENTER EVERYTHING */
        }
        .title-row {
            font-size: 18px;
            font-weight: bold;
            background-color: #ffffff;
            color: #000000;
            border: none;
            padding: 15px;
        }
        /* Zebra Striping */
        tr:nth-child(even) { background-color: #f0fdfa; } /* Teal-50 */
        tr:nth-child(odd) { background-color: #ffffff; }
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
            <tr>
                <th colspan="6" class="title-row">${titleText}</th>
            </tr>
            <tr>
              ${headers.map(h => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${personStats.map((p, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><b>${p.name}</b></td>
                <td>${p.total.toFixed(2)}</td>
                <td>${p.taker.toFixed(2)}</td>
                <td>${p.controller.toFixed(2)}</td>
                <td>${p.superior.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    // Create Blob with Excel MIME type and BOM for UTF-8 to fix Chinese characters
    const blob = new Blob(['\uFEFF', tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    // Use titleText for filename to match header
    const filename = `${titleText}.xls`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 mb-8">

      {/* Filter Bar - Available to ALL */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-700 font-medium">
          <Filter className="w-5 h-5 text-indigo-600" />
          <span>数据筛选</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">选择月份:</span>
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium cursor-pointer"
            >
              <option value="ALL">全部时间 (All Time)</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <Calendar className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Top Cards & Chart - ADMIN ONLY */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Summary Cards */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-medium text-gray-500">总流水 (Revenue)</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(currentStats.totalRevenue)}</p>
              <p className="text-sm text-gray-400 mt-1">共 {currentStats.orderCount} 单</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-green-100">
              <h3 className="text-sm font-medium text-green-600">接单人总计 (80%)</h3>
              <p className="text-2xl font-bold text-green-700 mt-2">{formatCurrency(currentStats.totalTaker)}</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100">
              <h3 className="text-sm font-medium text-blue-600">场控总计</h3>
              <p className="text-2xl font-bold text-blue-700 mt-2">{formatCurrency(currentStats.totalController)}</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-amber-100">
              <h3 className="text-sm font-medium text-amber-600">直属人总计</h3>
              <p className="text-2xl font-bold text-amber-700 mt-2">{formatCurrency(currentStats.totalSuperior)}</p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">收入分布</h3>
            <div className="w-full h-64">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-300">无数据</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Individual Leaderboard - Available to ALL, but actions restricted */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Responsive Header for Mobile */}
        <div
          className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 hover:bg-gray-50 transition-colors"
        >
          {/* Title Section */}
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <Trophy className="w-5 h-5 text-yellow-500 shrink-0" />
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-gray-800">
                人员收入排行 (Top 20)
              </h3>
              {selectedMonth !== 'ALL' && (
                <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {selectedMonth}
                </span>
              )}
            </div>
          </div>

          {/* Actions Section */}
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            {/* ADMIN ONLY ACTIONS */}
            {isAdmin && (
              <>
                <button
                  onClick={handleExportExcel}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors whitespace-nowrap"
                  title="导出为 Excel (.xls)"
                >
                  <Download className="w-3 h-3" />
                  导出 Excel
                </button>

                <button
                  onClick={handleCopyLeaderboard}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors whitespace-nowrap"
                  title="复制榜单到剪贴板"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? '已复制' : '复制榜单'}
                </button>
              </>
            )}

            <button onClick={() => setIsExpanded(!isExpanded)} className="text-gray-400 p-1 hover:text-gray-600 ml-auto sm:ml-0">
              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
                <tr>
                  <th className="px-6 py-4 w-16 text-center">排名</th>
                  <th className="px-6 py-4">姓名</th>
                  <th className="px-6 py-4 text-right">总收入</th>
                  <th className="px-6 py-4 text-right text-green-600">接单收入</th>
                  <th className="px-6 py-4 text-right text-blue-600">场控收入</th>
                  <th className="px-6 py-4 text-right text-amber-600">直属收入</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {personStats.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                      当前月份无数据
                    </td>
                  </tr>
                ) : (
                  personStats.map((person, index) => (
                    <tr key={person.name} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-center font-medium text-gray-500">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-800 flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${index < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-indigo-100 text-indigo-600'
                          }`}>
                          {index < 3 ? <Trophy className="w-4 h-4" /> : person.name.charAt(0)}
                        </div>
                        {person.name}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900 text-lg">
                        {formatCurrency(person.total)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {person.taker > 0 ? formatCurrency(person.taker) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {person.controller > 0 ? formatCurrency(person.controller) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {person.superior > 0 ? formatCurrency(person.superior) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};