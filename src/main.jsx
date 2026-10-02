import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Menu,
  Sparkles,
  X,
} from 'lucide-react';
import './style.css';
import { supabase } from './lib/supabase.js';
import StaffChat from './StaffChat.jsx';

const ADMIN_PRESENCE_GRACE_MS = 45_000;

function mergeChatMessages(current, incoming) {
  const messagesById = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => messagesById.set(message.id, message));
  return [...messagesById.values()].sort((left, right) => (
    new Date(left.created_at) - new Date(right.created_at)
  ));
}

const services = [
  {
    number: '01',
    href: '/uslugi/online-schetovodstvo/',
    title: 'Онлайн счетоводно обслужване',
    description: 'Процесът започва с изпращане на необходимите счетоводни документи по имейл, Viber или чрез електронната система за документооборот. Получените документи се преглеждат, систематизират и обработват съобразно дейността на Вашата фирма. Ние следим за необходимите счетоводни и данъчни срокове и подготвяме съответните справки, декларации и отчети. При необходимост от допълнителна информация или документи се свързваме с Вас дистанционно. По този начин счетоводното обслужване се извършва изцяло онлайн, бързо, организирано и без необходимост от посещение в офис.',
    symbol: '↗',
  },
  {
    number: '02',
    href: '/uslugi/trz-i-lichen-sastav/',
    title: 'ТРЗ и личен състав',
    description: 'Заплати, договори и администриране на екипа — навреме и коректно. Поемаме цялостното администриране на трудовите и осигурителните отношения във Вашата фирма. Изготвяме трудови договори, допълнителни споразумения, заповеди и необходимите документи за персонала. Обработваме месечните възнаграждения и изчисляваме дължимите осигуровки и данъци. Подготвяме и подаваме необходимите декларации и документи в съответните срокове. Целта ни е да осигурим коректно и навременно ТРЗ обслужване, за да можете да се концентрирате върху развитието на бизнеса си.',
    symbol: '✳',
  },
  {
    number: '03',
    href: '/uslugi/danachni-konsultacii/',
    title: 'Данъчни консултации',
    description: 'Предоставяме данъчни консултации, съобразени с конкретната дейност и ситуация на Вашия бизнес. Разясняваме приложимите данъчни правила и възможните последици при вземането на конкретни решения. Съдействаме при въпроси, свързани с ДДС, корпоративното и подоходното облагане и текущите данъчни задължения. Търсим практични и законосъобразни решения, съобразени с действащото законодателство. Целта ни е да разполагате с ясна информация и сигурна основа за вземане на информирани бизнес решения.',
    symbol: '◉',
  },
];

const plans = [
  {
    name: 'Старт',
    description: 'За свободни професии и малък бизнес',
    price: '120',
    services: [
      { label: 'СОЛ / свободна професия — 50 евро/м', price: '50' },
      { label: 'Малка фирма, нерегистрирана по ДДС — 100 евро/м · до 10 фактури', price: '100', features: ['Счетоводно обслужване до 10 фактури/м', 'ТРЗ на 1 служител', 'Годишно счетоводно приключване'] },
      { label: 'Малка фирма, нерегистрирана по ДДС — 130 евро/м · до 20 фактури', price: '130', features: ['Счетоводно обслужване до 20 фактури/м', 'ТРЗ на 3 служители', 'Годишно счетоводно приключване'] },
      { label: 'Малка фирма, нерегистрирана по ДДС — 150 евро/м · до 30 фактури', price: '150', features: ['Счетоводно обслужване до 30 фактури/м', 'ТРЗ на 5 служители', 'Годишно счетоводно приключване'] },
    ],
    features: ['До 30 документа месечно', 'ДДС консултации', 'Месечна справка'],
  },
  {
    name: 'Растеж',
    description: 'За екипи с амбиция за повече',
    price: '240',
    featured: true,
    services: [
      { label: 'Фирма регистрирана по ДДС – 200 евро/м до 30 фактури/м', price: '200', features: ['Счетоводно обслужване до 30 фактури/м', 'ТРЗ до 3 служители', 'Годишно счетоводно приключване'] },
      { label: 'Фирма регистрирана по ДДС – 250 евро/м до 50 фактури/м', price: '250', features: ['Счетоводно обслужване до 50 фактури/м', 'ТРЗ до 5 служители', 'Годишно счетоводно приключване'] },
      { label: 'Фирма регистрирана по ДДС – 300 евро/м до 80 фактури/м', price: '300', features: ['Счетоводно обслужване до 80 фактури/м', 'ТРЗ до 10 служители', 'Годишно счетоводно приключване'] },
    ],
    features: ['До 100 документа месечно', 'ТРЗ до 5 служители', 'Приоритетна комуникация'],
  },
  {
    name: 'Партньор',
    description: 'За компании със специфични нужди',
    price: 'По запитване',
    features: ['Индивидуален план', 'ТРЗ за целия екип', 'Финансови срещи и анализ', 'Интрастат', 'ВОП/ВОД', 'Данъчно планиране'],
  },
];

function Brand({ footer = false }) {
  return (
    <a className={`brand${footer ? ' brand-footer' : ''}`} href="#home" aria-label="Иванов акаунтинг — начало">
      <span className="brand-mark">ИА</span>
      <span className="brand-name">Иванов<span> акаунтинг</span><small>СЧЕТОВОДСТВО С ПОГЛЕД НАПРЕД</small></span>
    </a>
  );
}

function Eyebrow({ children, light = false }) {
  return <div className={`eyebrow${light ? ' eyebrow-light' : ''}`}><span />{children}</div>;
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [contactSending, setContactSending] = useState(false);
  const [contactError, setContactError] = useState('');
  const [startService, setStartService] = useState('50');
  const [growthService, setGrowthService] = useState('200');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatVisitor, setChatVisitor] = useState({ name: '', company: '', bulstat: '' });
  const [chatRoomId, setChatRoomId] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatNotice, setChatNotice] = useState('');
  const [chatConnection, setChatConnection] = useState('disconnected');
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [adminOnline, setAdminOnline] = useState(false);
  const chatOpenRef = useRef(chatOpen);
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen) setChatUnreadCount(0);
  }, [chatOpen]);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    async function restoreChat() {
      const savedRoomId = window.sessionStorage.getItem('balans-chat-room-id');
      if (!savedRoomId) return;
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!active || sessionError) return;
      const user = sessionData.session?.user;
      if (!user?.is_anonymous || user.id !== savedRoomId) {
        window.sessionStorage.removeItem('balans-chat-room-id');
        return;
      }
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('id, name, company, bulstat')
        .eq('id', savedRoomId)
        .maybeSingle();
      if (!active || error || !data) return;
      setChatVisitor(data);
      setChatRoomId(savedRoomId);
      setChatStarted(true);
    }
    restoreChat();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!supabase || !chatRoomId) return undefined;

    let active = true;
    const channel = supabase
      .channel(`chat:${chatRoomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${chatRoomId}`,
      }, ({ new: message }) => {
        if (!active) return;
        setChatMessages((current) => mergeChatMessages(current, [message]));
        if (message.sender_role === 'staff') {
          if (!chatOpenRef.current) setChatUnreadCount((count) => count + 1);
        }
      })
      .subscribe((status) => {
        if (!active) return;
        if (status === 'SUBSCRIBED') {
          setChatConnection('connected');
          supabase
            .from('chat_messages')
            .select('id, conversation_id, sender_id, sender_role, body, created_at')
            .eq('conversation_id', chatRoomId)
            .order('created_at', { ascending: true })
            .limit(100)
            .then(({ data, error }) => {
              if (!active) return;
              if (error) {
                setChatNotice('Не успяхме да заредим съобщенията. Опитайте да затворите и отворите чата отново.');
                return;
              }
              setChatMessages((current) => mergeChatMessages(current, data ?? []));
            });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setChatConnection('error');
        }
      });

    return () => {
      active = false;
      setChatConnection('disconnected');
      supabase.removeChannel(channel);
    };
  }, [chatRoomId]);

  useEffect(() => {
    if (!supabase) {
      setAdminOnline(false);
      return undefined;
    }

    let active = true;
    let channel;
    let offlineTimer;
    let handleVisibilityChange;
    async function watchAdminPresence() {
      let { data: sessionData, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Could not check chat visitor session:', error);
        return;
      }

      if (!sessionData.session) {
        const result = await supabase.auth.signInAnonymously();
        sessionData = result.data;
        error = result.error;
      }
      if (!active) return;
      if (error || !sessionData?.session) {
        console.error('Could not start chat visitor session:', error);
        return;
      }

      channel = supabase.channel('chat-admin-presence', {
        config: { private: true, presence: { enabled: true } },
      });
      const syncPresence = () => {
        const presenceState = channel.presenceState();
        const online = Object.values(presenceState).flat().some((presence) => presence.role === 'admin');
        if (!active) return;
        if (online) {
          window.clearTimeout(offlineTimer);
          setAdminOnline(true);
        } else {
          window.clearTimeout(offlineTimer);
          offlineTimer = window.setTimeout(() => {
            if (active) setAdminOnline(false);
          }, ADMIN_PRESENCE_GRACE_MS);
        }
      };

      channel
        .on('presence', { event: 'sync' }, syncPresence)
        .subscribe((status, error) => {
          if (status === 'SUBSCRIBED') syncPresence();
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            window.clearTimeout(offlineTimer);
            offlineTimer = window.setTimeout(() => {
              if (active) setAdminOnline(false);
            }, ADMIN_PRESENCE_GRACE_MS);
            console.error('Chat admin presence channel failed:', status, error);
          }
        });

      handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') syncPresence();
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
    };

    watchAdminPresence();

    return () => {
      active = false;
      window.clearTimeout(offlineTimer);
      if (handleVisibilityChange) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      setAdminOnline(false);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  async function handleChatStart(event) {
    event.preventDefault();
    if (!supabase) {
      setChatNotice('Чатът още не е свързан към Supabase. Добавете publishable key в .env.local и рестартирайте сайта.');
      return;
    }

    const formData = new FormData(event.currentTarget);
    const visitor = {
      name: String(formData.get('name') ?? '').trim(),
      company: String(formData.get('company') ?? '').trim(),
      bulstat: String(formData.get('bulstat') ?? '').trim(),
    };

    setChatLoading(true);
    setChatNotice('');
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const savedRoomId = window.sessionStorage.getItem('balans-chat-room-id');
      let user = sessionData.session?.user;
      if (!user?.is_anonymous || user.id !== savedRoomId) {
        if (user) {
          const { error } = await supabase.auth.signOut({ scope: 'local' });
          if (error) throw error;
        }
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        user = data.user;
      }
      if (!user) throw new Error('Anonymous chat session unavailable');

      const { data: existingConversation, error: readError } = await supabase
        .from('chat_conversations')
        .select('id, name, company, bulstat')
        .eq('id', user.id)
        .maybeSingle();
      if (readError) throw readError;

      if (!existingConversation) {
        const { error: insertError } = await supabase
          .from('chat_conversations')
          .insert({ id: user.id, ...visitor });
        if (insertError) throw insertError;
      }

      setChatVisitor(existingConversation ?? visitor);
      setChatMessages([]);
      setChatRoomId(user.id);
      window.sessionStorage.setItem('balans-chat-room-id', user.id);
      setChatStarted(true);
    } catch (error) {
      if (error?.code === 'anonymous_provider_disabled') {
        setChatNotice('Анонимният вход е изключен в Supabase. Включете Anonymous Sign-Ins в настройките за Auth.');
      } else {
        setChatNotice('Не успяхме да започнем разговора. Проверете настройките за Auth в Supabase.');
      }
    } finally {
      setChatLoading(false);
    }
  }

  async function handleChatSend(event) {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message || !supabase || !chatRoomId || chatSending) return;

    setChatSending(true);
    setChatNotice('');
    const { error } = await supabase.from('chat_messages').insert({
      conversation_id: chatRoomId,
      sender_id: chatRoomId,
      sender_role: 'visitor',
      body: message,
    });
    setChatSending(false);
    if (error) {
      setChatNotice('Съобщението не беше изпратено. Проверете връзката и опитайте отново.');
      return;
    }
    setChatInput('');
  }
  async function handleNewChat() {
    setChatLoading(true);
    window.sessionStorage.removeItem('balans-chat-room-id');
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    setChatLoading(false);
    if (error) {
      setChatNotice(error.message || 'Не успяхме да започнем нов разговор.');
      return;
    }
    setChatRoomId(null);
    setChatMessages([]);
    setChatInput('');
    setChatVisitor({ name: '', company: '', bulstat: '' });
    setChatNotice('');
    setChatStarted(false);
    setChatUnreadCount(0);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!supabase || contactSending) {
      setContactError('Формата временно не може да се изпрати. Моля, пишете ни на hello@balans.bg.');
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    setContactSending(true);
    setSent(false);
    setContactError('');
    try {
      const { error } = await supabase.functions.invoke('send-contact-email', {
        body: {
          name: String(formData.get('name') ?? '').trim(),
          email: String(formData.get('email') ?? '').trim(),
          service: String(formData.get('service') ?? '').trim(),
          message: String(formData.get('message') ?? '').trim(),
          website: String(formData.get('website') ?? '').trim(),
        },
      });
      if (error) throw error;
      form.reset();
      setSent(true);
    } catch (error) {
      console.error('Contact form email failed:', error);
      setContactError('Заявката не беше изпратена. Опитайте отново или ни пишете на hello@balans.bg.');
    } finally {
      setContactSending(false);
    }
  }

  return (
    <>
      <header className="site-header">
        <Brand />
        <button className="menu-toggle" aria-label={menuOpen ? 'Затвори менюто' : 'Отвори менюто'} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X /> : <Menu />}
        </button>
        <nav className={`main-nav${menuOpen ? ' is-open' : ''}`} aria-label="Основна навигация">
          <a href="#services" onClick={closeMenu}>Услуги</a>
          <a href="#about" onClick={closeMenu}>За нас</a>
          <a href="#pricing" onClick={closeMenu}>Цени</a>
          <a className="nav-contact" href="#contact" onClick={closeMenu}>Да поговорим <ArrowUpRight size={15} /></a>
        </nav>
      </header>

      <main id="home">
        <section className="hero">
          <div className="hero-copy">
            <Eyebrow>ОНЛАЙН СЧЕТОВОДСТВО, КЪДЕТО И ДА СТЕ</Eyebrow>
            <h1><span className="hero-title-line">Счетоводството ви.</span><br /><span>Изцяло онлайн.</span></h1>
            <p>Документите, отчетите и комуникацията — онлайн. Получавате професионално счетоводно обслужване без излишно ходене до офис.</p>            <div className="hero-details">
              <p>Онлайн счетоводните услуги предоставят удобен и модерен начин за управление на счетоводството на Вашия бизнес, независимо от местоположението Ви.</p>
              <p>Цялостното счетоводно обслужване се извършва дистанционно, без необходимост от посещение в счетоводен офис.</p>
              <p>Необходимите счетоводни документи могат да бъдат изпращани по имейл, чрез Viber или посредством електронна система за документооборот.</p>
              <p>Това позволява бързо и организирано предаване на фактури, банкови извлечения, договори и други документи, необходими за счетоводното обслужване.</p>
              <p>Електронната система за документооборот осигурява структурирано съхранение и проследяване на предоставените документи.</p>
              <p>По този начин информацията е достъпна и подредена, а обработката на документите може да се извършва своевременно.</p>
              <p>Комуникацията между счетоводителя и клиента също се осъществява дистанционно, което улеснява ежедневното обслужване и обмена на необходимата информация.</p>
              <p>Онлайн моделът е подходящ както за новосъздадени предприятия, така и за компании с установена дейност и документооборот.</p>
              <p>Целта е да получите професионално счетоводно обслужване с минимална административна тежест и без значение къде се намирате.</p>
              <p>Вие развивате бизнеса си, а ние се грижим за своевременното и организирано обработване на счетоводната информация.</p>
            </div>
            <div className="hero-actions">
              <a className="button button-primary" href="#contact">Заявете онлайн обслужване <ArrowRight size={17} /></a>
              <a className="hero-secondary" href="#services">Разгледайте услугите <ArrowDownRight size={17} /></a>
            </div>
          </div>

          <div className="hero-art">
            <div className="hero-photo-wrap">
              <img src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=88" alt="Работа с документи и услуги онлайн от лаптоп" className="hero-photo" />
              <div className="photo-overlay" />
              <div className="photo-stamp"><span>БИЗНЕСЪТ<br />ВИ Е В ДОБРИ<br />РЪЦЕ</span><ArrowUpRight size={21} /></div>
            </div>
            <span className="hero-orbit orbit-one" /><span className="hero-orbit orbit-two" />
          </div>
          <div className="hero-number">01 <span /> 04</div>
        </section>

        <section className="client-strip" aria-label="Онлайн счетоводство за различни бизнеси">
          <span>ОНЛАЙН ОБСЛУЖВАНЕ ЗА</span>
          <div><i>✳</i> малък бизнес</div><div><i>◌</i> свободни професии</div><div><i>↗</i> растящи компании</div><div><i>＋</i> нови начинания</div>
        </section>

        <section className="online-flow section" aria-labelledby="online-flow-title">
          <div className="section-heading">
            <div><Eyebrow>РАБОТИМ ДИГИТАЛНО</Eyebrow><h2 id="online-flow-title">Счетоводство онлайн.<br /><span>Лесно и подредено.</span></h2></div>
            <p>Без папки и излишно пътуване. Работим дистанционно с ясен процес и човек отсреща, когато имате въпрос.</p>
          </div>
          <div className="online-steps">
            <article><span className="step-number">01</span><span className="step-icon">↥</span><h3>Изпращате документите</h3><p>Споделяте документите си дигитално, когато ви е удобно.</p></article>
            <article><span className="step-number">02</span><span className="step-icon">⌘</span><h3>Ние поемаме числата</h3><p>Обработваме документите и следим важните счетоводни срокове.</p></article>
            <article><span className="step-number">03</span><span className="step-icon">↗</span><h3>Получавате яснота</h3><p>Получавате отчети и отговори онлайн, без да губите време.</p></article>
          </div>
        </section>

        <section className="services section" id="services">
          <div className="section-heading">
            <div><Eyebrow>УСЛУГИ</Eyebrow><h2>По-малко бумащина.<br /><span>Повече бизнес.</span></h2></div>
            <p>Поемаме числата, сроковете и детайлите, за да насочите енергията си там, където има значение.</p>
          </div>
          <div className="service-grid">
            {services.map((service) => (
              <article className="service-card" key={service.number}>
                <div className="service-top"><span>{service.number} / 03</span><span className="service-symbol">{service.symbol}</span></div>
                <h3><a href={service.href}>{service.title}</a></h3><p>{service.description}</p>
                <a href={service.href} aria-label={`Научете повече за ${service.title}`}><ArrowUpRight size={18} /></a>
              </article>
            ))}
          </div>
          <div className="service-note"><span>Имате по-специфичен казус?</span><a href="#contact">Разкажете ни <ArrowRight size={15} /></a></div>
        </section>

        <section className="about" id="about">
          <div className="about-image">
            <img src="https://images.unsplash.com/photo-1772588627527-db42040f3a8b?auto=format&fit=crop&w=1200&q=88" alt="Счетоводни документи, калкулатор и химикал върху работна маса" />
            <div className="about-image-label">ВНИМАНИЕ КЪМ ВСЕКИ ДЕТАЙЛ <span>✳</span></div>
          </div>
          <div className="about-copy">
            <Eyebrow>ХОРА ПРЕДИ ТАБЛИЦИ</Eyebrow>
            <h2>Добрите решения<br />започват с <span>добър разговор.</span></h2>
            <p>За нас счетоводството не е просто цифри. То е да познаваме бизнеса ви, да отговаряме навреме и да бъдем до вас, когато трябва да вземете важно решение.</p>
            <a className="underlined-link" href="#contact">Запознайте се с нас <ArrowRight size={16} /></a>
            <small className="about-footnote">*Защото сроковете са важни за всички.</small>
          </div>
        </section>

        <section className="manifesto"><Sparkles size={19} /><p>Вие създавате стойност.<br /><span>Ние се грижим числата да я показват.</span></p><small>БАЛАНС · СЧЕТОВОДСТВО С ПОГЛЕД НАПРЕД</small></section>

        <section className="pricing section" id="pricing">
          <div className="section-heading">
            <div><Eyebrow>ЯСНИ УСЛОВИЯ</Eyebrow><h2>План според<br /><span>вашия ритъм.</span></h2></div>
            <p>Започнете с услугите, от които имате нужда днес. Когато бизнесът расте, растем заедно.</p>
          </div>
          <div className="pricing-grid">
            {plans.map((plan) => (
              <article className={`price-card${plan.featured ? ' is-featured' : ''}`} key={plan.name}>
                <h3>{plan.name}</h3><p>{plan.description}</p>
                {plan.services && <label className="plan-service-label">Изберете услуга
                  <select className="plan-service-select" value={plan.featured ? growthService : startService} onChange={(event) => plan.featured ? setGrowthService(event.target.value) : setStartService(event.target.value)}>
                    {plan.services.map((service) => <option key={service.price} value={service.price}>{service.label}</option>)}
                  </select>
                </label>}
                <div className="price">{plan.services ? <><strong>{plan.featured ? growthService : startService}<sup> {String.fromCharCode(8364)}</sup></strong><span>{"/м"}</span></> : plan.price.length > 5 ? <strong className="custom-price">{plan.price}</strong> : <><strong>{plan.price}<sup> лв.</sup></strong><span>/ месец</span></>}</div>
                {plan.services ? (plan.featured ? <ul>{plan.services.find((service) => service.price === growthService).features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul> : startService === '50' ? <ul>{['Самоосигуряващо се лице', 'Декларации 1 и 6', 'Годишна данъчна декларация', 'Без ДДС'].map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul> : plan.services.find((service) => service.price === startService)?.features && <ul>{plan.services.find((service) => service.price === startService).features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul>) : <ul>{plan.features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul>}
              </article>
            ))}
          </div>
          <p className="pricing-footnote"><Sparkles size={15} /> Посочените цени са ориентировъчни. Точната оферта зависи от обема документи и дейността на фирмата.</p>
        </section>

        <section className="contact" id="contact">
          <div className="contact-copy">
            <Eyebrow light>ДА ЗАПОЧНЕМ ОТТУК</Eyebrow>
            <h2>Вашият бизнес<br />заслужава <span>сигурност.</span></h2>
            <p>Разкажете ни какво ви е нужно. Ще се свържем с вас до един работен ден.</p>
            <div className="contact-links"><a href="tel:+359888123456">+359 888 123 456 <ArrowUpRight size={15} /></a><a href="mailto:hello@balans.bg">hello@balans.bg <ArrowUpRight size={15} /></a></div>
            <div className="contact-aside">СОФИЯ · РАБОТИМ НАВСЯКЪДЕ</div>
          </div>
          <form className="contact-form" onSubmit={handleSubmit}>
            <div className="form-row"><label>Име<input name="name" required maxLength="120" placeholder="Вашето име" /></label><label>Имейл<input name="email" required type="email" maxLength="254" placeholder="name@company.bg" /></label></div>
            <label>Услуга<select name="service" defaultValue="" required><option value="" disabled>Изберете услуга</option><option>Онлайн счетоводно обслужване</option><option>ТРЗ и личен състав</option><option>Данъчни консултации</option><option>Друго</option></select><ChevronDown className="select-chevron" size={16} /></label>
            <label>Съобщение<textarea name="message" rows="3" maxLength="4000" placeholder="Няколко думи за бизнеса ви (по желание)" /></label>
            <label className="contact-honeypot" aria-hidden="true">Website<input name="website" tabIndex="-1" autoComplete="off" /></label>
            {contactError && <p className="contact-form-error" role="alert">{contactError}</p>}
            {sent && <p className="contact-form-success" role="status">Благодарим! Ще се свържем скоро.</p>}
            <button type="submit" className="button button-acid" disabled={contactSending}>{contactSending ? 'Изпращаме...' : sent ? 'Изпратете друго запитване' : <>Изпратете запитване <ArrowRight size={17} /></>}</button>
            <small>Изпращайки формата, се съгласявате да се свържем с вас по посочените данни.</small>
          </form>
        </section>

        <aside className={`site-chat ${adminOnline ? 'admin-online' : 'admin-offline'}${chatOpen ? ' is-open' : ''}`} aria-label="Чат с Иванов акаунтинг">
          {chatOpen && <section className="chat-panel" aria-labelledby="chat-title">
            <header className={`chat-header ${adminOnline ? 'admin-online' : 'admin-offline'}`}>
              <div><span className="chat-status-dot" /><div><h2 id="chat-title">{adminOnline ? 'Чат с нас' : 'Оставете съобщение'}</h2><p>{adminOnline ? 'Администраторът е онлайн' : 'Ще отговорим при първа възможност'}</p></div></div>
              <button type="button" className="chat-close" aria-label="Затвори чата" onClick={() => setChatOpen(false)}><X size={19} /></button>
            </header>
            {!chatStarted ? <form className="chat-start-form" onSubmit={handleChatStart}>
              <p>За да започнете разговор, попълнете данните си.</p>
              <label>Име<input name="name" autoComplete="name" maxLength="120" required /></label>
              <label>Фирма<input name="company" autoComplete="organization" maxLength="160" required /></label>
              <label>Булстат<input name="bulstat" autoComplete="off" maxLength="20" required /></label>
              <small>Данните се пазят към разговора и са достъпни само за вас и одобрен екип.</small>
              {chatNotice && <div className="chat-error-notice" role="alert">{chatNotice}</div>}
              <button type="submit" className="chat-submit" disabled={chatLoading}>{chatLoading ? 'Свързваме...' : <>Започни чат <ArrowRight size={16} /></>}</button>
            </form> : <>
              <div className="chat-welcome">Здравейте, {chatVisitor.name}! <span>{chatVisitor.company} · Булстат {chatVisitor.bulstat}</span></div>
              <div className={`chat-connection ${chatConnection}`}><span className="chat-status-dot" />{chatConnection === 'connected' ? 'Свързано · съобщенията пристигат на живо' : chatConnection === 'error' ? 'Връзката прекъсна · опитваме отново' : 'Свързваме чата...'}</div>
              {chatNotice && <div className="chat-error-notice" role="alert">{chatNotice}</div>}
              <div className="chat-messages" aria-live="polite">{chatMessages.map((message) => <article className={`chat-message ${message.sender_role === 'staff' ? 'staff' : 'visitor'}`} key={message.id}><p>{message.body}</p><time>{new Date(message.created_at).toLocaleString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></article>)}</div>
              <button type="button" className="chat-new-thread" onClick={handleNewChat} disabled={chatLoading}>Нов разговор</button>
              <form className="chat-compose" onSubmit={handleChatSend}>
                <input aria-label="Вашето съобщение" placeholder="Напишете съобщение..." maxLength="4000" value={chatInput} onChange={(event) => setChatInput(event.target.value)} />
                <button type="submit" aria-label="Изпрати съобщение" disabled={!chatInput.trim() || chatSending}><ArrowRight size={18} /></button>
              </form>
            </>}
          </section>}
          <button type="button" className="chat-launcher" aria-expanded={chatOpen} onClick={() => setChatOpen((open) => !open)}>
            {chatOpen ? <X size={21} /> : <><span className="chat-launcher-dot" />Чат с нас</>}
          </button>
          {chatUnreadCount > 0 && <span className="chat-unread-badge" role="status">{chatUnreadCount}</span>}
        </aside>
      </main>

      <footer className="site-footer"><Brand footer /><span>© 2025 Иванов акаунтинг · Счетоводни услуги</span><div><a href="#contact">Поверителност</a><a href="mailto:hello@balans.bg">Имейл</a><a href="#home">Нагоре ↑</a></div></footer>
    </>
  );
}

if (window.location.pathname.replace(/\/+$/, '') === '/staff-chat') {
  document.title = 'Вътрешен чат — Иванов Акаунтинг';
  let robots = document.querySelector('meta[name="robots"]');
  if (!robots) {
    robots = document.createElement('meta');
    robots.name = 'robots';
    document.head.append(robots);
  }
  robots.content = 'noindex, nofollow';
}

createRoot(document.getElementById('root')).render(
  window.location.pathname === '/staff-chat' ? <StaffChat /> : <App />
);
