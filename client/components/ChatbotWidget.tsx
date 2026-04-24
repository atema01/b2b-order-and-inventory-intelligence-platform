import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type Message = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
};

type ChatbotStatus = {
  configured: boolean;
  suggestedQuestions: string[];
};

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const ChatbotWidget: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<ChatbotStatus | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: makeId(),
      role: 'assistant',
      text: 'Ask me how this website works. I can help with pages, routes, and where to find features.'
    }
  ]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const currentPageTitle = useMemo(() => {
    const path = location.pathname || '/';
    if (path === '/') return user?.role === 'Buyer' ? 'Buyer Dashboard' : 'Dashboard';
    return path.split('/').filter(Boolean).join(' / ');
  }, [location.pathname, user?.role]);

  const hasSiblingFab = useMemo(() => {
    const path = location.pathname || '/';
    return path === '/orders' || path === '/returns' || path === '/products';
  }, [location.pathname]);

  const canShowSuggestions = messages.length <= 1 && !isLoading;

  useEffect(() => {
    if (!isAuthenticated) return;

    const loadStatus = async () => {
      try {
        const response = await fetch('/api/ai/status', {
          credentials: 'include'
        });

        if (!response.ok) return;
        const data = await response.json();
        setStatus(data);
      } catch (err) {
        console.error('Failed to load chatbot status:', err);
      }
    };

    void loadStatus();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  if (!isAuthenticated) {
    return null;
  }

  const sendMessage = async (messageText: string) => {
    const trimmed = messageText.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = { id: makeId(), role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: trimmed,
          currentPath: location.pathname || '/',
          currentPageTitle
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Chat request failed.');
      }

      const assistantMessage: Message = {
        id: makeId(),
        role: 'assistant',
        text: data.answer || 'I could not generate a response.'
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const nextError = err instanceof Error ? err.message : 'Something went wrong while contacting the assistant.';
      setError(nextError);
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: 'assistant',
          text: 'I ran into a problem answering that. Please try again in a moment.'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await sendMessage(input);
  };

  const resetConversation = () => {
    setMessages([
      {
        id: makeId(),
        role: 'assistant',
        text: 'Ask me how this website works. I can help with pages, routes, and where to find features.'
      }
    ]);
    setError('');
    setInput('');
    inputRef.current?.focus();
  };

  return (
    <div
      className={`fixed z-50 transition-all ${
        hasSiblingFab
          ? 'bottom-4 right-[5.75rem] sm:bottom-6 sm:right-[6.5rem]'
          : 'bottom-4 right-4 sm:bottom-6 sm:right-6'
      }`}
    >
      {isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] md:hidden"
          aria-label="Close chatbot backdrop"
        />
      )}

      {isOpen && (
        <div className="fixed inset-x-2 bottom-2 top-2 flex flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 sm:inset-x-4 sm:bottom-4 sm:top-4 md:absolute md:inset-auto md:bottom-20 md:right-0 md:top-auto md:h-[min(42rem,calc(100vh-7rem))] md:w-[34rem] md:max-w-[calc(100vw-2rem)] md:rounded-[28px] lg:w-[38rem]">
          <div className="shrink-0 border-b border-slate-100 bg-slate-950 px-4 py-4 text-white sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-300">Website Assistant</p>
                <p className="mt-1 text-sm text-slate-200">
                  Ask about pages, features, and where to go next.
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  {currentPageTitle}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={resetConversation}
                  className="rounded-xl p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Start a new chat"
                  title="New chat"
                >
                  <span className="material-symbols-outlined text-xl">refresh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Close chatbot"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
            </div>
            {status && !status.configured && (
              <p className="mt-3 rounded-2xl bg-amber-400/15 px-3 py-2 text-xs font-semibold leading-5 text-amber-100">
                The server still needs a `GEMINI_API_KEY` before the chatbot can answer.
              </p>
            )}
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-slate-50 to-white px-4 py-4 sm:px-5">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[90%] rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm ${
                  message.role === 'user'
                    ? 'ml-auto rounded-br-xl bg-cyan-600 text-white'
                    : 'rounded-bl-xl border border-slate-100 bg-white text-slate-700'
                }`}
              >
                <p className={`mb-1 text-[11px] font-black uppercase tracking-[0.16em] ${
                  message.role === 'user' ? 'text-cyan-100' : 'text-slate-400'
                }`}>
                  {message.role === 'user' ? 'You' : 'Assistant'}
                </p>
                {message.text}
              </div>
            ))}

            {isLoading && (
              <div className="max-w-[90%] rounded-3xl rounded-bl-xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                <p className="mb-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Assistant</p>
                Thinking...
              </div>
            )}
          </div>

          {canShowSuggestions && status?.suggestedQuestions?.length ? (
            <div className="border-t border-slate-100 bg-white px-4 py-3 sm:px-5">
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                Try one of these
              </p>
              <div className="-mx-1 overflow-x-auto pb-1 scrollbar-hide">
                <div className="flex min-w-max gap-2 px-1">
                {status.suggestedQuestions.slice(0, 4).map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void sendMessage(question)}
                    className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-bold text-slate-600 transition-colors hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700"
                  >
                    {question}
                  </button>
                ))}
                </div>
              </div>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="shrink-0 border-t border-slate-100 bg-white p-4 sm:p-5">
            <div className="flex items-end gap-2">
              <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={1}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage(input);
                }
              }}
              placeholder="Ask about this website..."
              className="max-h-28 min-h-[2.75rem] flex-1 resize-none rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-cyan-600 px-4 text-sm font-black text-white transition-all hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <span className="material-symbols-outlined text-base">send</span>
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>
            <div className="mt-2 flex items-start justify-between gap-3">
              <div className="min-h-[1.25rem] flex-1 text-xs font-medium text-red-500">
                {error}
              </div>
              <p className="text-right text-[11px] font-medium text-slate-400">
                Enter to send
              </p>
            </div>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-14 min-w-[3.5rem] items-center justify-center gap-2 rounded-full border-4 border-white bg-cyan-600 px-4 text-white shadow-2xl shadow-cyan-600/30 transition-all hover:bg-cyan-700 active:scale-95 sm:h-16"
        title="Open website assistant"
      >
        <span className="material-symbols-outlined text-3xl font-light">smart_toy</span>
        <span className="hidden text-sm font-black sm:inline">{isOpen ? 'Close' : 'Ask'}</span>
      </button>
    </div>
  );
};

export default ChatbotWidget;
