import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DatabaseZap, ExternalLink } from 'lucide-react';

interface ErrorContextType {
  showDbError: () => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const showDbError = () => {
    setIsOpen(true);
  };

  return (
    <ErrorContext.Provider value={{ showDbError }}>
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md bg-white/90 backdrop-blur-xl border-white/20 shadow-2xl rounded-3xl">
          <DialogHeader className="flex flex-col items-center text-center sm:text-center space-y-3 pb-2">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-2">
              <DatabaseZap className="w-6 h-6 text-red-600" />
            </div>
            <DialogTitle className="text-xl">数据库连接失败</DialogTitle>
            <DialogDescription className="text-base text-gray-600 leading-relaxed">
              当前网页访问正常，但无法连接到云端数据库。这通常是因为您的免费版数据库已进入 <strong className="text-gray-900 font-semibold">休眠状态 (Paused)</strong>。
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-gray-50 rounded-2xl p-4 my-4 text-sm text-gray-600 space-y-2">
            <p>👉 <strong>如何恢复？</strong></p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>登录 Supabase 官网后台</li>
              <li>找到当前处于 Paused 状态的项目</li>
              <li>点击绿色的 <strong>Restore</strong> 按钮</li>
              <li>等待 1-2 分钟恢复后，刷新本页面即可</li>
            </ol>
          </div>

          <DialogFooter className="sm:justify-center">
            <a 
              href="https://supabase.com/dashboard/projects" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full"
            >
              <button 
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-3 px-4 rounded-xl font-medium hover:bg-gray-800 transition-colors"
              >
                前往 Supabase 唤醒
                <ExternalLink className="w-4 h-4" />
              </button>
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ErrorContext.Provider>
  );
}

export const useError = () => {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};