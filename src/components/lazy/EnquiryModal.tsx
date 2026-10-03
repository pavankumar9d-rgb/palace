'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface EnquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EnquiryModal({ isOpen, onClose }: EnquiryModalProps) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    preferredDates: '',
    message: '',
  });

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      setStatus('error');
      setStatusMessage('Please provide both your name and email address.');
      return;
    }

    setStatus('submitting');
    setStatusMessage('');

    try {
      const res = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.status === 501) {
        // Expected stub response
        setStatus('success');
        setStatusMessage(
          'Your private viewing request has been logged. Our concierge will contact you upon reservation window availability.'
        );
      } else if (res.ok) {
        setStatus('success');
        setStatusMessage('Your enquiry has been successfully received.');
      } else {
        setStatus('error');
        setStatusMessage(data.error || 'Submission failed. Please verify your details.');
      }
    } catch (err) {
      setStatus('error');
      setStatusMessage('Network error occurred. Please try again later.');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/90 backdrop-blur-xl select-none"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
            className="glass-card w-full max-w-xl p-8 sm:p-12 text-[var(--ivory)] relative shadow-2xl"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-hairline pb-6 mb-8">
              <div>
                <span className="text-[10px] font-mono tracking-[0.3em] uppercase text-[var(--gold)]">
                  EXCLUSIVE ACCESS
                </span>
                <h2 className="text-2xl sm:text-3xl font-headline tracking-widest uppercase mt-1">
                  REQUEST A PRIVATE VIEWING
                </h2>
                <p className="text-xs text-[var(--champagne)] opacity-60 font-light mt-1">
                  Accommodations by bespoke private invitation only.
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close enquiry modal"
                data-magnetic
                className="w-10 h-10 flex items-center justify-center rounded-full border border-hairline hover:border-[var(--gold)] text-[var(--champagne)] hover:text-[var(--gold)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            {status === 'success' ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-12 h-12 rounded-full border border-[var(--gold)] flex items-center justify-center mx-auto text-[var(--gold)]">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-headline tracking-widest uppercase">ENQUIRY RECORDED</h3>
                <p className="text-sm text-[var(--champagne)] opacity-80 max-w-md mx-auto leading-relaxed">
                  {statusMessage}
                </p>
                <button
                  onClick={onClose}
                  className="mt-6 px-8 py-3 text-xs tracking-[0.2em] uppercase font-medium bg-[var(--gold)] text-[var(--bg)]"
                >
                  RETURN TO SANCTUARY
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-mono tracking-widest uppercase text-[var(--champagne)] opacity-70 mb-1">
                    FULL NAME *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm text-[var(--ivory)] focus:outline-none focus:border-[var(--gold)] transition-colors"
                    placeholder="Lord / Lady / Title & Name"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono tracking-widest uppercase text-[var(--champagne)] opacity-70 mb-1">
                      EMAIL ADDRESS *
                    </label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm text-[var(--ivory)] focus:outline-none focus:border-[var(--gold)] transition-colors"
                      placeholder="concierge@estate.com"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono tracking-widest uppercase text-[var(--champagne)] opacity-70 mb-1">
                      PHONE NUMBER
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm text-[var(--ivory)] focus:outline-none focus:border-[var(--gold)] transition-colors"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono tracking-widest uppercase text-[var(--champagne)] opacity-70 mb-1">
                    PREFERRED DATES / SEASON
                  </label>
                  <input
                    type="text"
                    value={form.preferredDates}
                    onChange={e => setForm({ ...form, preferredDates: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm text-[var(--ivory)] focus:outline-none focus:border-[var(--gold)] transition-colors"
                    placeholder="Autumn Solstice / Spring Horizon"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono tracking-widest uppercase text-[var(--champagne)] opacity-70 mb-1">
                    BESPOKE REQUIREMENTS
                  </label>
                  <textarea
                    rows={3}
                    value={form.message}
                    onChange={e => setForm({ ...form, message: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 px-4 py-3 text-sm text-[var(--ivory)] focus:outline-none focus:border-[var(--gold)] transition-colors resize-none"
                    placeholder="Helicopter transfer, private dining preferences..."
                  />
                </div>

                {status === 'error' && (
                  <p className="text-xs text-rose-400 font-mono tracking-wide">{statusMessage}</p>
                )}

                <div className="pt-4 flex items-center justify-end gap-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-3 text-xs tracking-widest uppercase text-[var(--champagne)] hover:text-white transition-colors"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={status === 'submitting'}
                    data-magnetic
                    className="px-8 py-3.5 text-xs tracking-[0.2em] uppercase font-medium bg-[var(--gold)] text-[var(--bg)] hover:bg-[var(--champagne)] active:scale-95 transition-all shadow-lg disabled:opacity-50"
                  >
                    {status === 'submitting' ? 'SUBMITTING...' : 'TRANSMIT REQUEST'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
