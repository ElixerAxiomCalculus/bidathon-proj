import { useState, useCallback, useRef, useEffect } from 'react';
import DashboardNavbar from '../components/dashboard/DashboardNavbar';
import ChatSidebar from '../components/dashboard/ChatSidebar';
import ChatArea from '../components/dashboard/ChatArea';
import MarketPanel from '../components/dashboard/MarketPanel';
import PaymentOverlay from '../components/dashboard/PaymentOverlay';
import {
  agentQuery,
  executeOrder,
  getUser,
  getConversations,
  createConversation,
  addMessageToConversation,
  deleteConversation,
  clearAllConversations,
  generateChatTitle,
  getConversation,
  getWalletBalance,
  addWalletFunds,
} from '../services/api';
import './Dashboard.css';

const Dashboard = () => {
  const isMobile = () => window.innerWidth <= 768;
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile());
  const [marketPanelOpen, setMarketPanelOpen] = useState(!isMobile());
  const [activeChat, setActiveChat] = useState(null);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const activeChatRef = useRef(null);
  const user = getUser();
  const [walletBalance, setWalletBalance] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  useEffect(() => {
    getWalletBalance()
      .then((data) => setWalletBalance(data.wallet_balance))
      .catch(() => { });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (isMobile()) {
        setSidebarOpen(false);
        setMarketPanelOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [chats, setChats] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const convos = await getConversations();
        if (convos && convos.length > 0) {
          setChats(
            convos.map((c) => ({
              id: c.id,
              title: c.title || 'Untitled',
              preview: c.preview || '',
              date: c.updated_at || c.created_at || new Date().toISOString(),
              messages: [],
              loaded: false,
            }))
          );
        }
      } catch {
      }
    })();
  }, []);

  const handleNewChat = useCallback(async () => {
    try {
      const data = await createConversation();
      const newChat = {
        id: data.id,
        title: 'New Chat',
        preview: '',
        date: new Date().toISOString(),
        messages: [],
        loaded: true,
      };
      setChats((prev) => [newChat, ...prev]);
      setActiveChat(data.id);
      activeChatRef.current = data.id;
    } catch {
      const newChat = {
        id: `local-${Date.now()}`,
        title: 'New Chat',
        preview: '',
        date: new Date().toISOString(),
        messages: [],
        loaded: true,
      };
      setChats((prev) => [newChat, ...prev]);
      setActiveChat(newChat.id);
      activeChatRef.current = newChat.id;
    }
  }, []);

  const handleSelectChat = useCallback(async (chatId) => {
    setActiveChat(chatId);
    activeChatRef.current = chatId;
    if (isMobile()) setSidebarOpen(false);

    setChats((prev) => {
      const chat = prev.find((c) => c.id === chatId);
      if (chat && !chat.loaded && !chatId.startsWith('local-')) {
        getConversation(chatId)
          .then((data) => {
            setChats((p) =>
              p.map((c) =>
                c.id === chatId
                  ? {
                    ...c,
                    messages: (data.messages || []).map((m) => ({
                      role: m.role,
                      content: m.content,
                      timestamp: m.timestamp
                        ? new Date(m.timestamp).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })
                        : '',
                    })),
                    loaded: true,
                  }
                  : c
              )
            );
          })
          .catch(() => { });
      }
      return prev;
    });
  }, []);

  const handleDeleteChat = useCallback(async (chatId) => {
    try {
      if (!chatId.startsWith('local-')) {
        await deleteConversation(chatId);
      }
    } catch {
    }
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    if (activeChatRef.current === chatId) {
      setActiveChat(null);
      activeChatRef.current = null;
    }
  }, []);

  const handleSendMessage = useCallback(async (message, language = 'en') => {
    let chatId = activeChatRef.current;

    // Auto-create a new chat if none is active (e.g. typing on welcome screen)
    if (!chatId) {
      try {
        const data = await createConversation();
        const newChat = {
          id: data.id,
          title: 'New Chat',
          preview: '',
          date: new Date().toISOString(),
          messages: [],
          loaded: true,
        };
        setChats((prev) => [newChat, ...prev]);
        setActiveChat(data.id);
        activeChatRef.current = data.id;
        chatId = data.id;
      } catch {
        const lid = `local-${Date.now()}`;
        const newChat = {
          id: lid,
          title: 'New Chat',
          preview: '',
          date: new Date().toISOString(),
          messages: [],
          loaded: true,
        };
        setChats((prev) => [newChat, ...prev]);
        setActiveChat(lid);
        activeChatRef.current = lid;
        chatId = lid;
      }
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat;
        return {
          ...chat,
          messages: [...chat.messages, { role: 'user', content: message, timestamp: timeStr }],
          title: chat.messages.length === 0 ? message.slice(0, 30) + (message.length > 30 ? '...' : '') : chat.title,
          preview: message.slice(0, 40),
        };
      })
    );

    if (!chatId.startsWith('local-')) {
      addMessageToConversation(chatId, 'user', message).catch(() => { });
    }

    setIsAgentTyping(true);

    try {
      const data = await agentQuery(message, language);
      const ts = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== chatId) return chat;
          return {
            ...chat,
            messages: [
              ...chat.messages,
              {
                role: 'assistant',
                content: data.response,
                timestamp: ts,
                meta: {
                  intent: data.intent,
                  tools: data.tools_used,
                  tickers: data.tickers,
                  chart_data: data.chart_data || null,
                  trade_preview: data.trade_preview || null,
                },
              },
            ],
          };
        })
      );

      if (!chatId.startsWith('local-')) {
        addMessageToConversation(chatId, 'assistant', data.response).catch(() => { });

        // Auto-generate a smart title after first exchange
        setChats((prev) => {
          const chat = prev.find((c) => c.id === chatId);
          if (chat && chat.messages.length <= 2) {
            generateChatTitle(chatId)
              .then((res) => {
                if (res.title) {
                  setChats((p) =>
                    p.map((c) => (c.id === chatId ? { ...c, title: res.title } : c))
                  );
                }
              })
              .catch(() => { });
          }
          return prev;
        });
      }
    } catch (err) {
      const ts = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== chatId) return chat;
          return {
            ...chat,
            messages: [
              ...chat.messages,
              {
                role: 'assistant',
                content: `Sorry, I couldn't process that request. ${err.message || 'The server may be offline.'}  Please try again.`,
                timestamp: ts,
                isError: true,
              },
            ],
          };
        })
      );
    } finally {
      setIsAgentTyping(false);
    }
  }, []);

  const handleClearChat = useCallback(() => {
    const chatId = activeChatRef.current;
    if (!chatId) return;
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, messages: [], preview: '' } : c))
    );
  }, []);

  const handleClearAllChats = useCallback(async () => {
    try {
      await clearAllConversations();
    } catch { }
    setChats([]);
    setActiveChat(null);
    activeChatRef.current = null;
  }, []);

  const activeChatData = chats.find((c) => c.id === activeChat);

  const handleTradeConfirm = useCallback(async (preview, msgIndex) => {
    try {
      await executeOrder(preview.ticker, preview.side, preview.quantity);
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== activeChatRef.current) return chat;
          const updated = [...chat.messages];
          if (updated[msgIndex]?.meta) {
            updated[msgIndex] = {
              ...updated[msgIndex],
              meta: { ...updated[msgIndex].meta, trade_confirmed: true },
            };
          }
          return { ...chat, messages: updated };
        })
      );
    } catch (err) {
      const ts = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== activeChatRef.current) return chat;
          return {
            ...chat,
            messages: [
              ...chat.messages,
              {
                role: 'assistant',
                content: `Trade failed: ${err.message || 'Unknown error'}`,
                timestamp: ts,
                isError: true,
              },
            ],
          };
        })
      );
    }
  }, []);

  return (
    <div className="dashboard">
      <DashboardNavbar
        onToggleSidebar={() => setSidebarOpen((p) => !p)}
        onToggleMarket={() => setMarketPanelOpen((p) => !p)}
        sidebarOpen={sidebarOpen}
        marketPanelOpen={marketPanelOpen}
        user={user}
        walletBalance={walletBalance}
        onAddMoney={() => setPaymentOpen(true)}
      />
      <div className="dashboard__body">
        <ChatSidebar
          isOpen={sidebarOpen}
          chats={chats}
          activeChat={activeChat}
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          onDeleteChat={handleDeleteChat}
          onClose={() => setSidebarOpen(false)}
        />
        <ChatArea
          chat={activeChatData}
          onSendMessage={handleSendMessage}
          onNewChat={handleNewChat}
          sidebarOpen={sidebarOpen}
          marketPanelOpen={marketPanelOpen}
          isAgentTyping={isAgentTyping}
          onTradeConfirm={handleTradeConfirm}
          onClearChat={handleClearChat}
        />
        <MarketPanel
          isOpen={marketPanelOpen}
          onClose={() => setMarketPanelOpen(false)}
        />
      </div>
      <PaymentOverlay
        isOpen={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        currentBalance={walletBalance}
        onSuccess={async (amount) => {
          const data = await addWalletFunds(amount);
          setWalletBalance(data.wallet_balance);
        }}
      />
    </div>
  );
};

export default Dashboard;
