import React from 'react';
import { XIcon, TrashIcon } from './Icons';

interface DiscardModalProps {
    onConfirm: () => void;
    onCancel: () => void;
}

const DiscardModal: React.FC<DiscardModalProps> = ({ onConfirm, onCancel }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            {/* Glassmorphism Window */}
            <div className="relative w-full max-w-md bg-[#121212]/80 backdrop-blur-xl border border-white/10 rounded-[30px] shadow-2xl overflow-hidden flex flex-col p-8">

                <div className="flex flex-col items-center text-center space-y-6">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-2">
                        <TrashIcon className="w-8 h-8 text-red-500" />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-white">Discard Project?</h2>
                        <p className="text-zinc-400">
                            Are you sure you want to discard this project? All generated subtitles and edits will be permanently lost.
                        </p>
                    </div>

                    <div className="flex gap-3 w-full pt-2">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors border border-white/5"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-colors shadow-lg shadow-red-500/20"
                        >
                            Discard
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default DiscardModal;
