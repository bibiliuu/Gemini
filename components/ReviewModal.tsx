import React, { useState, useEffect } from 'react';
import { TransactionRaw, IncomeDistribution, TransactionRecord, DistributionConfig } from '../types';
import { Calculator, CheckCircle, X, User, Users, Crown, FileInput, Save, Calendar, Ban, Split, Settings, ZoomIn } from 'lucide-react';

interface Props {
  // Can be raw data (new upload) or existing record (approval)
  initialData: TransactionRaw | TransactionRecord;
  // Optional: The saved config from a previous step (e.g. during upload)
  initialConfig?: DistributionConfig;
  imageUrl: string;
  mode: 'create' | 'approve';
  isAdmin: boolean;
  // Updated signature to accept an Array of records
  onSave: (finalData: Omit<TransactionRecord, 'id' | 'timestamp' | 'imageUrl' | 'status'>[]) => void;
  onReject: () => void; 
  onCancel: () => void; 
  checkDuplicate: (date: string, taker: string, amount: number) => boolean;
}

export const ReviewModal: React.FC<Props> = ({ initialData, initialConfig, imageUrl, mode, isAdmin, onSave, onReject, onCancel, checkDuplicate }) => {
  const [amount, setAmount] = useState<number>(initialData.amount);
  
  // Names
  const [taker, setTaker] = useState(initialData.taker);
  const [controller, setController] = useState(initialData.controller);
  const [superior, setSuperior] = useState(initialData.superior);
  const [orderDate, setOrderDate] = useState(initialData.orderDate || "");

  // Split Logic State
  const [takerList, setTakerList] = useState<string[]>([]);
  const [perPersonAmount, setPerPersonAmount] = useState<number>(0);
  
  // Admin Config State (LOCAL SCOPE)
  const [showSettings, setShowSettings] = useState(false);
  
  // Image Zoom State
  const [isZoomed, setIsZoomed] = useState(false);
  
  // Initialize with passed config OR defaults
  const [localConfig, setLocalConfig] = useState<DistributionConfig>(initialConfig || {
    takerPercentage: 80,
    controllerPercentage: 15,
    superiorPercentage: 5
  });
  
  const { takerPercentage, controllerPercentage, superiorPercentage } = localConfig;
  
  const [distribution, setDistribution] = useState<IncomeDistribution>({
    taker: 0, controller: 0, superior: 0, pool: 0, platform: 0
  });

  // Helper to check if superior is valid (not empty/none)
  const isSuperiorValid = (name: string) => {
    if (!name) return false;
    const n = name.trim().toLowerCase();
    return n !== '' && n !== '无' && n !== 'none' && n !== '未知' && n !== 'unknown';
  };

  // Effect: Parse Taker List & Calculate Distribution
  useEffect(() => {
    // 1. Parse names from comma/space separated string
    const names = taker.split(/[,，/]/)
      .map(t => t.trim())
      .filter(t => t.length > 0);
    
    const count = names.length > 0 ? names.length : 1;
    setTakerList(names);

    // 2. Calculate Amount Per Person
    // If there are 3 people and total is 300, each person's "Order" is effectively 100
    const splitAmount = amount / count;
    setPerPersonAmount(splitAmount);

    // 3. Calculate Distribution based on the SPLIT amount and CONFIG percentages
    const poolPercentage = (100 - takerPercentage) / 100;
    const pool = splitAmount * poolPercentage; 
    const takerShare = splitAmount * (takerPercentage / 100); 
    
    const controllerShare = pool * (controllerPercentage / 100);
    
    const hasSuperior = isSuperiorValid(superior);
    const superiorShare = hasSuperior ? (pool * (superiorPercentage / 100)) : 0;

    const platform = pool - controllerShare - superiorShare;

    setDistribution({
      taker: takerShare,
      controller: controllerShare,
      superior: superiorShare,
      pool,
      platform
    });
  }, [amount, taker, superior, takerPercentage, controllerPercentage, superiorPercentage]);

  // Dynamic Duplicate Check
  // If multiple people, we check if ANY of them creates a duplicate
  const duplicateName = takerList.find(name => checkDuplicate(orderDate, name, perPersonAmount));
  const isDuplicate = !!duplicateName;
  
  const hasSuperior = isSuperiorValid(superior);

  const handleConfirm = () => {
    if (isDuplicate) return;

    const safeDate = orderDate.trim() === "" ? "无日期" : orderDate.trim();
    const finalNames = takerList.length > 0 ? takerList : ["未知"];

    // Create one record per person
    const records = finalNames.map(name => {
      const finalOrderId = `${safeDate}_${name}_${perPersonAmount.toFixed(2)}`;
      return {
        orderId: finalOrderId,
        amount: perPersonAmount, // Each record gets the split amount
        taker: name,
        controller,
        superior: hasSuperior ? superior : "无",
        orderDate: orderDate, 
        content: initialData.content,
        distribution, // This distribution is already calculated based on perPersonAmount
        distributionConfig: localConfig // SAVE THE CONFIG used for this calculation
      };
    });
    
    onSave(records);
  };

  return (
    <>
      {/* Zoom Modal - High Z-Index to cover everything */}
      {isZoomed && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-2 animate-in fade-in duration-200"
          onClick={() => setIsZoomed(false)}
        >
          <button className="absolute top-4 right-4 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors">
            <X className="w-8 h-8" />
          </button>
          <img 
            src={imageUrl} 
            alt="Full Preview" 
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col md:flex-row overflow-hidden my-8">
          
          {/* Image Preview Side */}
          <div className="w-full md:w-5/12 bg-gray-900 p-4 flex items-center justify-center group relative">
            <img 
              src={imageUrl} 
              alt="Receipt" 
              className="max-h-[40vh] md:max-h-[80vh] object-contain rounded-lg shadow-lg" 
            />
            <button
              type="button" 
              onClick={() => setIsZoomed(true)} 
              className="absolute bottom-4 right-4 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-black/80 transition-colors"
            >
              <ZoomIn className="w-3 h-3" />
              查看大图
            </button>
          </div>

          {/* Form Side */}
          <div className="w-full md:w-7/12 p-6 md:p-8 flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  {mode === 'create' ? (
                     <>
                       <FileInput className="w-6 h-6 text-indigo-600" />
                       确认录入信息
                     </>
                  ) : (
                     <>
                       <Calculator className="w-6 h-6 text-green-600" />
                       财务审核与批准
                     </>
                  )}
                </h2>
                <p className="text-sm text-gray-500">
                   {takerList.length > 1 
                     ? `检测到 ${takerList.length} 位接单人，将自动拆分为 ${takerList.length} 条记录。` 
                     : '请核对信息，确认无误后提交。'}
                </p>
              </div>
              <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-gray-400 hover:text-gray-700" />
              </button>
            </div>

            {isDuplicate && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-pulse shadow-sm">
                <Ban className="w-8 h-8 text-red-600 shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-red-700 text-lg">检测到重复订单</h4>
                  <p className="text-sm text-red-600 mt-1 leading-relaxed font-medium">
                    名字: <b>{duplicateName}</b> 已存在相同金额和日期的记录。
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-6 flex-1 overflow-y-auto pr-2">
              
              {/* Primary Inputs */}
              <div className="grid grid-cols-2 gap-4">
                 <div className="col-span-2">
                    <div className="flex justify-between items-center mb-1">
                       <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide">总金额 (¥)</label>
                       {isAdmin && (
                          <button 
                            onClick={() => setShowSettings(!showSettings)}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${showSettings ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                          >
                            <Settings className="w-3 h-3" /> 分成设置
                          </button>
                       )}
                    </div>
                    
                    {/* Admin Distribution Settings - LOCAL ONLY */}
                    {showSettings && isAdmin && (
                      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4 animate-in fade-in slide-in-from-top-2">
                         <h4 className="text-xs font-bold text-indigo-800 mb-3">分成比例配置 (仅限此单)</h4>
                         <div className="grid grid-cols-3 gap-4">
                            <div>
                               <label className="text-xs text-indigo-600 block mb-1">接单人 (%)</label>
                               <input 
                                 type="number" 
                                 value={localConfig.takerPercentage || ''} 
                                 onChange={(e) => setLocalConfig({...localConfig, takerPercentage: Number(e.target.value)})}
                                 placeholder="0"
                                 className="w-full p-1.5 text-sm font-bold border border-indigo-200 rounded bg-white text-indigo-900 focus:ring-1 focus:ring-indigo-500 outline-none"
                               />
                            </div>
                            <div>
                               <label className="text-xs text-indigo-600 block mb-1">场控 (池%)</label>
                               <input 
                                 type="number" 
                                 value={localConfig.controllerPercentage || ''} 
                                 onChange={(e) => setLocalConfig({...localConfig, controllerPercentage: Number(e.target.value)})}
                                 placeholder="0"
                                 className="w-full p-1.5 text-sm font-bold border border-indigo-200 rounded bg-white text-indigo-900 focus:ring-1 focus:ring-indigo-500 outline-none"
                               />
                            </div>
                            <div>
                               <label className="text-xs text-indigo-600 block mb-1">直属 (池%)</label>
                               <input 
                                 type="number" 
                                 value={localConfig.superiorPercentage || ''} 
                                 onChange={(e) => setLocalConfig({...localConfig, superiorPercentage: Number(e.target.value)})}
                                 placeholder="0"
                                 className="w-full p-1.5 text-sm font-bold border border-indigo-200 rounded bg-white text-indigo-900 focus:ring-1 focus:ring-indigo-500 outline-none"
                               />
                            </div>
                         </div>
                         <div className="text-[10px] text-indigo-400 mt-2">
                            当前逻辑: 接单人拿 {localConfig.takerPercentage || 0}%，剩余 {100 - (localConfig.takerPercentage || 0)}% 进入池。场控拿池的 {localConfig.controllerPercentage || 0}%，直属拿池的 {localConfig.superiorPercentage || 0}%。
                         </div>
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      <input 
                        type="number" 
                        value={amount || ''} 
                        onChange={(e) => setAmount(Number(e.target.value))}
                        className={`flex-1 p-3 text-2xl font-bold text-gray-900 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${isDuplicate ? 'border-red-300 bg-red-50 text-red-900' : 'bg-white border-gray-300'}`}
                      />
                      {takerList.length > 1 && (
                          <div className="bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100 text-right">
                              <div className="text-xs text-indigo-500 font-medium flex items-center gap-1 justify-end">
                                  <Split className="w-3 h-3" />
                                  {takerList.length} 人平分
                              </div>
                              <div className="text-lg font-bold text-indigo-700">
                                  ¥{perPersonAmount.toFixed(2)}<span className="text-xs font-normal text-indigo-400">/人</span>
                              </div>
                          </div>
                      )}
                    </div>
                 </div>
                 
                 <div className="col-span-2">
                   <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                     <Calendar className="w-3 h-3" /> 下单日期
                   </label>
                   <input 
                     type="text" 
                     value={orderDate} 
                     onChange={(e) => setOrderDate(e.target.value)}
                     placeholder="未识别 (可选填)"
                     className={`w-full p-2 border rounded-lg text-sm transition-colors text-gray-900 ${
                          isDuplicate ? 'border-red-300 bg-red-50 text-red-900' : 
                          (!orderDate ? 'border-yellow-300 bg-yellow-50' : 'bg-white border-gray-300')
                     }`}
                   />
                 </div>
              </div>

              {/* People Section */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-4">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-green-600 mt-2" />
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">接单人 (多个人请用逗号分隔)</label>
                    <textarea 
                      value={taker} 
                      onChange={(e) => setTaker(e.target.value)}
                      rows={2}
                      className={`w-full bg-white border rounded-lg p-2 text-sm font-medium ${isDuplicate ? 'border-red-300 text-red-900' : 'border-gray-300 text-gray-900 focus:border-green-500 outline-none'}`}
                    />
                    {takerList.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {takerList.map((t, i) => (
                                <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full border border-green-200">
                                    {t}
                                </span>
                            ))}
                        </div>
                    )}
                  </div>
                  <div className="text-right mt-1">
                      <span className="font-bold text-green-700 block">¥{distribution.taker.toFixed(2)}</span>
                      <span className="text-xs text-gray-400">每人收入</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">场控 (Controller)</label>
                    <input 
                      type="text" 
                      value={controller} 
                      onChange={(e) => setController(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-md px-2 py-1.5 focus:border-blue-500 outline-none text-sm font-medium text-gray-900 shadow-sm"
                    />
                  </div>
                  <span className="font-bold text-blue-700">¥{distribution.controller.toFixed(2)}</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`p-1 rounded ${hasSuperior ? 'bg-amber-100' : 'bg-gray-200'}`}>
                      <Crown className={`w-4 h-4 ${hasSuperior ? 'text-amber-600' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">直属人 (Superior)</label>
                    <input 
                      type="text" 
                      value={superior} 
                      onChange={(e) => setSuperior(e.target.value)}
                      placeholder="无 (No Superior)"
                      className={`w-full border rounded-md px-2 py-1.5 outline-none text-sm font-medium shadow-sm ${hasSuperior ? 'bg-white border-amber-300 text-gray-900' : 'bg-white border-gray-300 text-gray-400'}`}
                    />
                  </div>
                  <span className={`font-bold ${hasSuperior ? 'text-amber-700' : 'text-gray-300'}`}>
                      ¥{distribution.superior.toFixed(2)}
                  </span>
                </div>
              </div>
              
              <div className="text-xs text-gray-400 text-center bg-gray-100 p-2 rounded-lg">
                 注：场控和直属人的分成是基于<b>单人份额</b> (¥{perPersonAmount.toFixed(2)}) 计算的。
              </div>

            </div>

            <div className="mt-8 flex gap-4">
              <button 
                onClick={onReject}
                className="flex-1 py-3 px-4 border border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50 transition-colors flex justify-center items-center gap-2"
              >
                <X className="w-4 h-4" />
                {mode === 'create' ? '取消录入' : '拒绝申请'}
              </button>
              <button 
                onClick={handleConfirm}
                disabled={isDuplicate}
                className={`flex-[2] py-3 px-4 text-white rounded-xl font-medium shadow-lg transition-all flex items-center justify-center gap-2
                  ${isDuplicate
                      ? 'bg-gray-400 cursor-not-allowed shadow-none'
                      : (mode === 'create'
                          ? 'bg-gray-900 hover:bg-black'
                          : 'bg-green-600 hover:bg-green-700 shadow-green-200')
                  }`}
              >
                {isDuplicate ? (
                    <>
                      <Ban className="w-5 h-5" />
                      重复订单 (禁止提交)
                    </>
                ) : (
                    <>
                      {mode === 'create' ? <Save className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                      {mode === 'create' ? (takerList.length > 1 ? `拆分并提交 (${takerList.length}单)` : '确认提交') : (takerList.length > 1 ? `拆分并批准 (${takerList.length}单)` : '批准并入账')}
                    </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};