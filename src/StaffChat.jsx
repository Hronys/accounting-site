import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, LogOut, MessageCircle } from 'lucide-react';
import { staffSupabase } from './lib/supabase.js';

const STAFF_EMAIL = 'ivanovwork@abv.bg';
const CHAT_READ_MARKERS_KEY = 'balans-staff-chat-read-at';
const isChatAdmin = (user) => user?.email?.trim().toLowerCase() === STAFF_EMAIL;

function getReadMarkers() {
  try {
    return JSON.parse(window.localStorage.getItem(CHAT_READ_MARKERS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function markConversationRead(conversationId, at = new Date().toISOString()) {
  const markers = getReadMarkers();
  markers[conversationId] = at;
  window.localStorage.setItem(CHAT_READ_MARKERS_KEY, JSON.stringify(markers));
}

function mergeMessages(current, incoming) {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort((left, right) => (
    new Date(left.created_at) - new Date(right.created_at)
  ));
}

export default function StaffChat() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState(STAFF_EMAIL);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [unreadByConversation, setUnreadByConversation] = useState({});
  const [incomingNotice, setIncomingNotice] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!staffSupabase) return undefined;

    let active = true;
    staffSupabase.auth.getSession().then(({ data }) => {
      if (!active || !data.session?.user) return;
      if (isChatAdmin(data.session.user)) setUser(data.session.user);
      else setNotice('Този имейл няма администраторски достъп до чата.');
    });

    const { data: listener } = staffSupabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const signedInUser = session?.user;
      if (isChatAdmin(signedInUser)) setUser(signedInUser);
      else if (!signedInUser) setUser(null);
      else {
        setUser(null);
        setNotice('Този имейл няма администраторски достъп до чата.');
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const loadConversations = useCallback(async () => {
    if (!staffSupabase) return;
    const { data, error } = await staffSupabase
      .from('chat_conversations')
      .select('id, name, company, bulstat, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      setNotice('Не успяхме да заредим разговорите. Проверете администраторския достъп.');
      return;
    }
    const conversationsList = data ?? [];
    if (conversationsList.length) {
      const { data: messageRows, error: messagesError } = await staffSupabase
        .from('chat_messages')
        .select('conversation_id, sender_role, created_at')
        .in('conversation_id', conversationsList.map((conversation) => conversation.id))
        .order('created_at', { ascending: false })
        .limit(10000);

      if (!messagesError) {
        const lastStaffReply = new Map();
        for (const message of messageRows ?? []) {
          if (message.sender_role === 'staff' && !lastStaffReply.has(message.conversation_id)) {
            lastStaffReply.set(message.conversation_id, message.created_at);
          }
        }

        const readMarkers = getReadMarkers();
        const unread = {};
        for (const message of messageRows ?? []) {
          if (message.sender_role !== 'visitor') continue;
          const repliedAt = lastStaffReply.get(message.conversation_id) ?? '';
          const readAt = readMarkers[message.conversation_id] ?? '';
          const lastSeenAt = readAt > repliedAt ? readAt : repliedAt;
          if (message.created_at > lastSeenAt) {
            unread[message.conversation_id] = (unread[message.conversation_id] ?? 0) + 1;
          }
        }
        setUnreadByConversation(unread);
      } else {
        console.error('Could not load unread chat counts:', messagesError);
      }
    } else {
      setUnreadByConversation({});
    }

    setNotice('');
    setConversations(conversationsList);
    setSelectedId((current) => current ?? conversationsList[0]?.id ?? null);
    return conversationsList;
  }, []);

  useEffect(() => {
    if (!user || !staffSupabase) return undefined;

    loadConversations();
    const channel = staffSupabase
      .channel('staff-chat-inbox')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
      }, (payload) => {
        const refresh = loadConversations();
        if (payload.new.conversation_id === selectedId) {
          setMessages((current) => mergeMessages(current, [payload.new]));
          if (payload.new.sender_role === 'visitor') {
            markConversationRead(payload.new.conversation_id, payload.new.created_at);
          }
          setUnreadByConversation((current) => ({ ...current, [payload.new.conversation_id]: 0 }));
        }
        if (payload.new.sender_role === 'visitor' && payload.new.conversation_id !== selectedId) {
          setUnreadByConversation((current) => ({
            ...current,
            [payload.new.conversation_id]: (current[payload.new.conversation_id] ?? 0) + 1,
          }));
          refresh?.then((latest) => {
            const conversation = latest.find((item) => item.id === payload.new.conversation_id);
            setIncomingNotice({
              conversationId: payload.new.conversation_id,
              name: conversation?.name ?? 'Клиент',
              body: payload.new.body,
            });
          });
        }
      })
      .subscribe();

    return () => { staffSupabase.removeChannel(channel); };
  }, [user, selectedId, loadConversations]);

  useEffect(() => {
    if (!user || !staffSupabase) return undefined;

    const channel = staffSupabase.channel('chat-admin-presence', {
      config: { private: true, presence: { key: user.id, enabled: true } },
    });
    const publishPresence = async () => {
      const trackStatus = await channel.track({ role: 'admin', user_id: user.id });
      if (trackStatus !== 'ok') console.error('Could not publish chat admin presence:', trackStatus);
    };
    channel.subscribe(async (status, error) => {
      if (status === 'SUBSCRIBED') {
        await publishPresence();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('Chat admin presence channel failed:', status, error);
      }
    });
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') publishPresence();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      channel.untrack().catch(() => {}).finally(() => staffSupabase.removeChannel(channel));
    };
  }, [user]);

  useEffect(() => {
    if (!user || !selectedId || !staffSupabase) return undefined;

    let active = true;
    const channel = staffSupabase
      .channel(`staff-chat:${selectedId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
        filter: `conversation_id=eq.${selectedId}`,
      }, (payload) => {
        if (active) setMessages((current) => mergeMessages(current, [payload.new]));
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        staffSupabase
          .from('chat_messages')
          .select('id, conversation_id, sender_id, sender_role, body, created_at')
          .eq('conversation_id', selectedId)
          .order('created_at', { ascending: true })
          .limit(200)
          .then(({ data, error }) => {
            if (!active) return;
            if (error) setNotice('Не успяхме да заредим историята на разговора.');
            else setMessages((current) => mergeMessages(current, data ?? []));
          });
      });

    return () => {
      active = false;
      staffSupabase.removeChannel(channel);
    };
  }, [user, selectedId]);

  async function sendLoginLink() {
    if (!staffSupabase) {
      setNotice('Липсват настройките за Supabase.');
      return;
    }
    if (email.trim().toLowerCase() !== STAFF_EMAIL) {
      setNotice(`Въведи администраторския имейл: ${STAFF_EMAIL}`);
      return;
    }

    setLoading(true);
    setNotice('');
    const { error } = await staffSupabase.auth.signInWithOtp({
      email: STAFF_EMAIL,
      options: { emailRedirectTo: `${window.location.origin}/staff-chat` },
    });
    setLoading(false);
    if (error) {
      setNotice(`Не успяхме да изпратим линк за вход: ${error.message}`);
      return;
    }
    setNotice('Изпратихме ти линк за вход. Провери пощата си и отвори го от това устройство.');
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (!staffSupabase) {
      setNotice('Липсват настройките за Supabase.');
      return;
    }
    if (email.trim().toLowerCase() !== STAFF_EMAIL) {
      setNotice(`Въведи администраторския имейл: ${STAFF_EMAIL}`);
      return;
    }
    if (!password) {
      await sendLoginLink();
      return;
    }

    setLoading(true);
    setNotice('');
    const { error } = await staffSupabase.auth.signInWithPassword({
      email: STAFF_EMAIL,
      password,
    });
    setLoading(false);
    if (error) setNotice('Входът не успя. Проверете имейла и паролата.');
  }

  async function handleSetPassword(event) {
    event.preventDefault();
    if (newPassword.length < 8) {
      setNotice('Паролата трябва да е поне 8 знака.');
      return;
    }
    setLoading(true);
    const { error } = await staffSupabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      setNotice(`Не успяхме да зададем паролата: ${error.message}`);
      return;
    }
    setNewPassword('');
    setShowPasswordSetup(false);
    setNotice('Паролата е зададена. Следващия път можеш да влезеш с имейл и парола.');
  }

  async function handleReply(event) {
    event.preventDefault();
    const body = reply.trim();
    if (!body || !selectedId || !user || !staffSupabase || sending) return;

    setSending(true);
    const { error } = await staffSupabase.from('chat_messages').insert({
      conversation_id: selectedId,
      sender_id: user.id,
      sender_role: 'staff',
      body,
    });
    setSending(false);
    if (error) {
      setNotice('Отговорът не беше изпратен. Проверете достъпа и опитайте отново.');
      return;
    }
    markConversationRead(selectedId);
    setUnreadByConversation((current) => ({ ...current, [selectedId]: 0 }));
    setReply('');
  }

  async function handleSignOut() {
    await staffSupabase?.auth.signOut();
    setUser(null);
    setSelectedId(null);
    setMessages([]);
  }

  if (!user) {
    return <main className="staff-login-page">
      <form className="staff-login-card" onSubmit={handleLogin}>
        <div className="staff-brand"><MessageCircle size={22} /> Иванов акаунтинг · Екип</div>
        <h1>Входящи чатове</h1>
        <p>Влез с парола или получи еднократен линк на имейла си.</p>
        <label>Имейл<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Парола<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {notice && <p className="staff-notice" role="alert">{notice}</p>}
        <button className="staff-primary-button" type="submit" disabled={loading}>{loading ? 'Влизаме...' : password ? 'Вход с парола' : 'Изпрати линк за вход'}</button>
        {password && <button className="staff-back-link" type="button" disabled={loading} onClick={sendLoginLink}>Изпрати линк вместо парола</button>}
        <a className="staff-back-link" href="/">Към сайта</a>
      </form>
    </main>;
  }

  const selectedConversation = conversations.find((conversation) => conversation.id === selectedId);
  const totalUnread = Object.values(unreadByConversation).reduce((sum, count) => sum + count, 0);

  function openConversation(conversationId) {
    setSelectedId(conversationId);
    setMessages([]);
    markConversationRead(conversationId);
    setUnreadByConversation((current) => {
      if (!current[conversationId]) return current;
      const next = { ...current };
      delete next[conversationId];
      return next;
    });
    setIncomingNotice((current) => current?.conversationId === conversationId ? null : current);
  }

  return <main className="staff-chat-page">
    <header className="staff-topbar">
      <a className="staff-brand" href="/">Иванов акаунтинг <span>· Чат</span></a>
      <div><span>{user.email}</span><button type="button" onClick={() => { setShowPasswordSetup((show) => !show); setNotice(''); }}>Задай парола</button><button type="button" onClick={handleSignOut}><LogOut size={16} /> Изход</button></div>
    </header>
    {incomingNotice && <button type="button" className="staff-incoming-notice" onClick={() => openConversation(incomingNotice.conversationId)}>
      <strong>Ново съобщение от {incomingNotice.name}</strong>
      <span>{incomingNotice.body}</span>
      <small>Отвори разговора</small>
    </button>}
    <div className="staff-workspace">
      <aside className="staff-inbox">
        {totalUnread > 0 && <p className="staff-unread-total">Непрочетени съобщения: {totalUnread}</p>}
        <div className="staff-inbox-heading"><h1>Разговори</h1><button type="button" onClick={loadConversations}>Обнови</button></div>
        {conversations.length === 0 ? <p className="staff-empty">Още няма разговори.</p> : conversations.map((conversation) => (
          <button
            type="button"
            key={conversation.id}
            className={`staff-conversation${conversation.id === selectedId ? ' is-selected' : ''}`}
            onClick={() => openConversation(conversation.id)}
          >
            <span className="staff-conversation-title"><strong>{conversation.name}</strong>{unreadByConversation[conversation.id] > 0 && <b>{unreadByConversation[conversation.id]}</b>}</span>
            <span>{conversation.company}</span>
            <small>{new Date(conversation.created_at).toLocaleString('bg-BG')}</small>
          </button>
        ))}
      </aside>
      <section className="staff-thread">
        {showPasswordSetup && <form className="staff-reply-form" onSubmit={handleSetPassword}>
          <input aria-label="Нова парола" type="password" autoComplete="new-password" minLength="8" placeholder="Нова парола (поне 8 знака)" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
          <button type="submit" aria-label="Запази паролата" disabled={loading}><ArrowRight size={18} /></button>
        </form>}
        {selectedConversation ? <>
          <header className="staff-thread-heading">
            <div><h2>{selectedConversation.name}</h2><p>{selectedConversation.company} · Булстат {selectedConversation.bulstat}</p></div>
          </header>
          {notice && <p className="staff-notice" role="alert">{notice}</p>}
          <div className="staff-thread-messages" aria-live="polite">
            {messages.map((message) => <article className={`staff-chat-message ${message.sender_role}`} key={message.id}>
              <p>{message.body}</p><time>{new Date(message.created_at).toLocaleString('bg-BG')}</time>
            </article>)}
          </div>
          <form className="staff-reply-form" onSubmit={handleReply}>
            <input aria-label="Отговор" placeholder="Напишете отговор..." maxLength="4000" value={reply} onChange={(event) => setReply(event.target.value)} />
            <button type="submit" aria-label="Изпрати отговор" disabled={!reply.trim() || sending}><ArrowRight size={18} /></button>
          </form>
        </> : <div className="staff-thread-placeholder">Изберете разговор от списъка.</div>}
      </section>
    </div>
  </main>;
}
