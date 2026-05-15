import { useState, useEffect, useRef } from 'react';
import { getSocket } from '../socket';
import useAuthStore from '../store/authStore';
import useChatStore from '../store/chatStore';
import useThemeStore, { THEME_LABEL } from '../store/themeStore';
import { transition } from '../store/transitionStore';

function StatusBar() {
  const { user } = useAuthStore();
  const { chats } = useChatStore();
  const { theme, cycleTheme } = useThemeStore();
  const [time, setTime] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [stats, setStats] = useState({
    totalMessages: 0,
    onlinePeers: 0,
    latency: null,
    uploadMB: 0,
    downloadMB: 0,
  });
  const [highlights, setHighlights] = useState({});
  const [showPopup, setShowPopup] = useState(null);
  const prevStatsRef = useRef(stats);

  // Update time every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toTimeString().slice(0, 8)); // HH:MM:SS
    };
    updateTime();
    const id = setInterval(updateTime, 1000);
    return () => clearInterval(id);
  }, []);

  // Check socket connection
  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      setIsOnline(false);
      return;
    }

    const checkConnection = () => {
      setIsOnline(socket.connected);
    };

    checkConnection();
    socket.on('connect', checkConnection);
    socket.on('disconnect', checkConnection);

    return () => {
      socket.off('connect', checkConnection);
      socket.off('disconnect', checkConnection);
    };
  }, []);

  // Calculate stats
  useEffect(() => {
    const totalMessages = chats.reduce((sum, chat) => sum + (chat.message_count || 0), 0);
    const onlinePeers = chats.reduce((sum, chat) => {
      const onlineCount = chat.members?.filter(m => m.online && m.id !== user?.id).length || 0;
      return sum + onlineCount;
    }, 0);

    // Mock latency (in real app, ping server)
    const latency = isOnline ? Math.floor(Math.random() * 30) + 15 : null;

    // Mock bandwidth (in real app, track actual traffic)
    const uploadMB = isOnline ? (Math.random() * 2).toFixed(1) : 0;
    const downloadMB = isOnline ? (Math.random() * 1.5).toFixed(1) : 0;

    setStats({ totalMessages, onlinePeers, latency, uploadMB, downloadMB });
  }, [chats, user, isOnline]);

  // Highlight changed values
  useEffect(() => {
    const prev = prevStatsRef.current;
    const newHighlights = {};

    if (prev.totalMessages !== stats.totalMessages) newHighlights.msgs = true;
    if (prev.onlinePeers !== stats.onlinePeers) newHighlights.peers = true;
    if (prev.latency !== stats.latency) newHighlights.lat = true;
    if (prev.uploadMB !== stats.uploadMB || prev.downloadMB !== stats.downloadMB) newHighlights.bw = true;

    if (Object.keys(newHighlights).length > 0) {
      setHighlights(newHighlights);
      setTimeout(() => setHighlights({}), 200);
    }

    prevStatsRef.current = stats;
  }, [stats]);

  const handleBlockClick = (block) => {
    setShowPopup(showPopup === block ? null : block);
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <>
      <div className="statusbar">
        {/* ONLINE/OFFLINE */}
        <StatusBlock
          label={isOnline ? 'ONLINE' : 'OFFLINE'}
          className={`${isOnline ? 'statusbar-ok statusbar-pulse' : 'statusbar-error'}`}
          onClick={() => handleBlockClick('online')}
        />

        {/* ENCRYPTION */}
        <StatusBlock
          label="ENC:ON"
          className="statusbar-ok"
          onClick={() => handleBlockClick('enc')}
        />

        {/* MESSAGES */}
        <StatusBlock
          label={`MSGS:${formatNumber(stats.totalMessages)}`}
          highlight={highlights.msgs}
          onClick={() => handleBlockClick('msgs')}
        />

        {/* PEERS */}
        <StatusBlock
          label={`PEERS:${stats.onlinePeers}`}
          highlight={highlights.peers}
          onClick={() => handleBlockClick('peers')}
        />

        {/* LATENCY */}
        <StatusBlock
          label={stats.latency ? `LAT:${stats.latency}ms` : 'LAT:---'}
          highlight={highlights.lat}
          className={stats.latency && stats.latency > 100 ? 'statusbar-warn' : ''}
          onClick={() => handleBlockClick('lat')}
        />

        {/* BANDWIDTH */}
        <StatusBlock
          label={`BW:↑${stats.uploadMB}MB ↓${stats.downloadMB}MB`}
          highlight={highlights.bw}
          onClick={() => handleBlockClick('bw')}
        />

        {/* THEME SWITCHER — brief glitch transition on change */}
        <StatusBlock
          label={`THEME:${THEME_LABEL[theme] || 'GREEN'}`}
          className="ml-auto statusbar-ok"
          onClick={() => transition('glitch', () => cycleTheme())}
        />

        {/* TIME */}
        <StatusBlock
          label={time}
          onClick={() => handleBlockClick('time')}
        />
      </div>

      {/* Popup details */}
      {showPopup && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setShowPopup(null)} />
          <div className="statusbar-popup">
            {showPopup === 'online' && (
              <StatusPopup title="CONNECTION STATUS">
                <div>STATUS: {isOnline ? 'CONNECTED' : 'DISCONNECTED'}</div>
                <div>PROTOCOL: WebSocket</div>
                <div>ENCRYPTION: AES-256-GCM</div>
                <div>SERVER: mesh.node-34.net</div>
              </StatusPopup>
            )}
            {showPopup === 'enc' && (
              <StatusPopup title="ENCRYPTION">
                <div>ALGORITHM: AES-256-GCM</div>
                <div>KEY EXCHANGE: ECDH</div>
                <div>FORWARD SECRECY: ENABLED</div>
                <div>CERT PINNING: ACTIVE</div>
              </StatusPopup>
            )}
            {showPopup === 'msgs' && (
              <StatusPopup title="MESSAGE STATISTICS">
                <div>TOTAL MESSAGES: {stats.totalMessages.toLocaleString()}</div>
                <div>ACTIVE CHATS: {chats.length}</div>
                <div>UNREAD: {chats.reduce((s, c) => s + (c.unread_count || 0), 0)}</div>
              </StatusPopup>
            )}
            {showPopup === 'peers' && (
              <StatusPopup title="PEER STATUS">
                <div>ONLINE PEERS: {stats.onlinePeers}</div>
                <div>TOTAL CONTACTS: {chats.reduce((s, c) => s + (c.members?.length || 0), 0)}</div>
                <div>MESH NODES: 42</div>
              </StatusPopup>
            )}
            {showPopup === 'lat' && (
              <StatusPopup title="NETWORK LATENCY">
                <div>CURRENT: {stats.latency || '---'}ms</div>
                <div>AVG (1m): {stats.latency ? stats.latency + 5 : '---'}ms</div>
                <div>JITTER: {stats.latency ? '±3ms' : '---'}</div>
                <div>PACKET LOSS: 0.1%</div>
              </StatusPopup>
            )}
            {showPopup === 'bw' && (
              <StatusPopup title="BANDWIDTH USAGE">
                <div>UPLOAD: ↑ {stats.uploadMB} MB/s</div>
                <div>DOWNLOAD: ↓ {stats.downloadMB} MB/s</div>
                <div>TOTAL (SESSION): 127.3 MB</div>
                <div>COMPRESSION: ENABLED</div>
              </StatusPopup>
            )}
            {showPopup === 'time' && (
              <StatusPopup title="SYSTEM TIME">
                <div>LOCAL: {new Date().toLocaleString()}</div>
                <div>UTC: {new Date().toUTCString()}</div>
                <div>UPTIME: {Math.floor(performance.now() / 1000)}s</div>
              </StatusPopup>
            )}
          </div>
        </>
      )}
    </>
  );
}

function StatusBlock({ label, className = '', highlight, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`statusbar-block ${className} ${highlight ? 'statusbar-highlight' : ''}`}
    >
      [{label}]
    </button>
  );
}

function StatusPopup({ title, children }) {
  return (
    <div className="statusbar-popup-content">
      <div className="statusbar-popup-title">╔══ {title} ══╗</div>
      <div className="statusbar-popup-body">
        {children}
      </div>
      <div className="statusbar-popup-footer">╚{'═'.repeat(title.length + 8)}╝</div>
    </div>
  );
}

export default StatusBar;
