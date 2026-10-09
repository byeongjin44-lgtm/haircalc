"use client";
export default function DeletionBlockedOverlay({ message, onClose }: { message: string; onClose: () => void }) {
  return <div role="alertdialog" aria-modal="true" aria-label="삭제할 수 없습니다" className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-6 backdrop-blur-sm">
    <div className="flex w-full max-w-[340px] flex-col gap-3 rounded-2xl bg-white p-6 text-center shadow-xl">
      <h2 className="font-semibold">삭제할 수 없습니다.</h2>
      <p className="text-sm text-zinc-600">{message}</p>
      <button autoFocus type="button" onClick={onClose} className="min-h-[48px] rounded-xl bg-zinc-900 text-white">확인</button>
    </div>
  </div>;
}
