import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FaMoon, FaSun, FaPaperPlane, FaHistory, FaPlus, FaCopy, FaRedo, FaSearch } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
};

const createId = () => Math.random().toString(36).slice(2, 10);

const initialConversation: Conversation = {
  id: createId(),
  title: 'New Chat',
  messages: [],
  createdAt: new Date().toISOString(),
};

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const stored = localStorage.getItem('conversations');
    return stored ? JSON.parse(stored) : [initialConversation];
  });
  const [activeConversationId, setActiveConversationId] = useState<string>(() => {
    const stored = localStorage.getItem('activeConversationId');
    return stored ?? initialConversation.id;
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? conversations[0],
    [conversations, activeConversationId],
  );

  const filteredConversations = useMemo(() => {
    const q = search.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q)));
  }, [conversations, search]);

  useEffect(() => {
    localStorage.setItem('conversations', JSON.stringify(conversations));
    localStorage.setItem('activeConversationId', activeConversationId);
  }, [conversations, activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  const updateConversation = (updater: (conversation: Conversation) => Conversation) => {
    setConversations((prev) => {
      const updated = prev.map((c) => (c.id === activeConversationId ? updater(c) : c));
      return updated;
    });
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: createId(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    const conversationId = activeConversationId;

    updateConversation((conversation) => ({
      ...conversation,
      title: conversation.messages.length === 0 ? input.trim().slice(0, 30) : conversation.title,
      messages: [...conversation.messages, userMessage],
    }));

    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content, conversationId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      const assistantMessage: Message = {
        id: createId(),
        role: 'assistant',
        content: data.reply || 'No response',
        timestamp: new Date().toISOString(),
      };

      updateConversation((conversation) => ({
        ...conversation,
        messages: [...conversation.messages, assistantMessage],
      }));
    } catch (error) {
      const assistantMessage: Message = {
        id: createId(),
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Something went wrong',
        timestamp: new Date().toISOString(),
      };
      updateConversation((conversation) => ({
        ...conversation,
        messages: [...conversation.messages, assistantMessage],
      }));
    } finally {
      setLoading(false);
    }
  };

  const newChat = () => {
    const conversation = { ...initialConversation, id: createId(), createdAt: new Date().toISOString() };
    setConversations((prev) => [conversation, ...prev]);
    setActiveConversationId(conversation.id);
    setIsSidebarOpen(false);
  };

  const deleteConversation = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConversationId === id) {
      const fallback = conversations.find((c) => c.id !== id) ?? initialConversation;
      setActiveConversationId(fallback.id);
    }
  };

  const renameConversation = (id: string) => {
    const title = window.prompt('Rename conversation', conversations.find((c) => c.id === id)?.title ?? '');
    if (!title) return;
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  };

  const exportChat = () => {
    const data = JSON.stringify(activeConversation, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${activeConversation?.title ?? 'chat'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const copyMessage = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <div className="flex h-screen overflow-hidden">
        <aside className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-20 w-72 border-r ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'} transition-transform md:static md:translate-x-0`}>
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-lg font-semibold">Chats</h2>
            <button onClick={newChat} className="rounded-lg bg-violet-600 p-2">
              <FaPlus />
            </button>
          </div>
          <div className="p-3">
            <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${theme === 'dark' ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-100'}`}>
              <FaSearch />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="w-full bg-transparent outline-none" />
            </div>
          </div>
          <div className="space-y-2 overflow-y-auto p-3">
            {filteredConversations.map((conversation) => (
              <div key={conversation.id} className={`rounded-xl p-3 ${activeConversationId === conversation.id ? 'bg-violet-600' : theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <button onClick={() => { setActiveConversationId(conversation.id); setIsSidebarOpen(false); }} className="w-full text-left">
                  <div className="truncate font-medium">{conversation.title}</div>
                  <div className="mt-1 text-xs opacity-70">{new Date(conversation.createdAt).toLocaleString()}</div>
                </button>
                <div className="mt-2 flex gap-2 text-sm">
                  <button onClick={() => renameConversation(conversation.id)} className="opacity-80 hover:opacity-100">Rename</button>
                  <button onClick={() => deleteConversation(conversation.id)} className="opacity-80 hover:opacity-100">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className={`flex items-center justify-between border-b px-4 py-3 ${theme === 'dark' ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white/70'}`}>
            <div className="flex items-center gap-3">
              <button className="rounded-lg p-2 md:hidden" onClick={() => setIsSidebarOpen((v) => !v)}>
                <FaHistory />
              </button>
              <div>
                <div className="font-semibold">{activeConversation?.title ?? 'New Chat'}</div>
                <div className="text-sm opacity-70">AI Assistant</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportChat} className="rounded-lg px-3 py-2 text-sm hover:bg-violet-600">Export</button>
              <button onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} className="rounded-lg p-2 hover:bg-violet-600">
                {theme === 'dark' ? <FaSun /> : <FaMoon />}
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {activeConversation?.messages.length === 0 && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl border p-6 ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
                  <h1 className="text-2xl font-semibold">How can I help today?</h1>
                  <p className="mt-2 text-sm opacity-70">Ask anything and get a polished response with markdown and code support.</p>
                </motion.div>
              )}
              {activeConversation?.messages.map((message) => (
                <motion.div key={message.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl p-4 ${message.role === 'user' ? (theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100') : (theme === 'dark' ? 'bg-slate-900' : 'bg-white')} shadow-sm`}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">{message.role === 'user' ? 'You' : 'Assistant'}</span>
                    {message.role === 'assistant' && (
                      <div className="flex gap-2">
                        <button onClick={() => copyMessage(message.content)}><FaCopy /></button>
                        <button onClick={() => setInput(message.content)}><FaRedo /></button>
                      </div>
                    )}
                  </div>
                  <div className="prose prose-invert max-w-none text-sm">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          const codeText = String(children).replace(/\n$/, '');
                          return match ? (
                            <SyntaxHighlighter language={match[1]} style={oneDark as never} PreTag="div">{codeText}</SyntaxHighlighter>
                          ) : (
                            <code className={className} {...props}>{children}</code>
                          );
                        },
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className={`rounded-2xl p-4 ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}>
                  <div className="text-sm opacity-70">Thinking...</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </main>

          <footer className={`border-t p-4 ${theme === 'dark' ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white/70'}`}>
            <div className={`mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border p-3 ${theme === 'dark' ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-100'}`}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Message AI Assistant"
                className="min-h-[56px] flex-1 resize-none bg-transparent outline-none"
              />
              <button onClick={() => void sendMessage()} className="rounded-xl bg-violet-600 p-3">
                <FaPaperPlane />
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

export default App;
